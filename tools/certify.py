"""Certificación básica de las relaciones del grafo y de los matches.

Pruebas que fallan (exit 1) si los datos rompen el contrato de web/src/data/graph.json o de matches.json,
y una cola de revisión para las conexiones por similitud que aún no tienen veredicto en
Conexiones_validadas.csv (por ejemplo, las de empresas nuevas).

  uv run --with pandas --with scikit-learn python tools/certify.py             # certifica y escribe Conexiones_por_revisar.csv
  uv run --with pandas --with scikit-learn python tools/certify.py --registrar # además guarda los veredictos automáticos

Los veredictos automáticos son reglas simples y quedan marcados "Automática" en Motivo para poder revisarlos:
texto idéntico entre dos empresas → dudosa; al menos 2 términos en común → ok; si no → dudosa.
"""
import csv
import json
import sys
from collections import Counter
from pathlib import Path

import pandas as pd

sys.path.insert(0, str(Path(__file__).parent))
import build_graph as bg  # noqa: E402

ROOT = bg.ROOT
MATCHES_JSON = ROOT / "web" / "src" / "data" / "matches.json"
REVIEW_CSV = ROOT / "Conexiones_por_revisar.csv"
RELATIONS = {"Proveedor", "Posible cliente", "Alianza comercial"}
AFFINITIES = {"Alta", "Media"}
MIN_SHARED_TERMS = 2  # términos (raíces o pares de raíces) en común para dar una conexión por buena sin revisarla
TOLERANCE = 0.0005  # la similitud del grafo está redondeada a 3 decimales
VALIDATION_COLUMNS = ["Id empresa A", "Id empresa B", "Empresa A", "Empresa B", "Sector A", "Sector B",
                      "Similitud", "Veredicto", "Motivo"]


def check(name, failures):
    """Una prueba: pasa si no hay casos que fallen; guarda los primeros para mostrarlos."""
    return {"name": name, "ok": not failures, "failures": failures, "count": len(failures)}


def certify_graph(graph, rejected=frozenset()):
    nodes = graph["nodes"]
    by_id = {n["id"]: n for n in nodes}
    sectors = {s["name"] for s in graph["sectors"]}
    edges = graph["edges"]
    degree = Counter()
    seen, duplicated, dangling, unordered = set(), [], [], []
    for e in edges:
        if e["a"] not in by_id or e["b"] not in by_id:
            dangling.append(f"{e['a']} - {e['b']}")
            continue
        if e["a"] >= e["b"]:
            unordered.append(f"{e['a']} - {e['b']}")
        pair = (e["a"], e["b"])
        if pair in seen:
            duplicated.append(f"{e['a']} - {e['b']}")
        seen.add(pair)
        degree[e["a"]] += 1
        degree[e["b"]] += 1

    def weak(e):
        a, b = by_id[e["a"]], by_id[e["b"]]
        same = a["sector"] == b["sector"]
        if e.get("fallback"):
            return not same
        return e["w"] < (bg.MIN_SIMILARITY if same else bg.MIN_SIMILARITY_CROSS) - TOLERANCE

    valid = [e for e in edges if e["a"] in by_id and e["b"] in by_id]
    per_sector = Counter(n["sector"] for n in nodes)
    return [
        check("Ids de empresa únicos y con nombre", [n["id"] for n in nodes if not n["name"].strip()]
              + [i for i, c in Counter(n["id"] for n in nodes).items() if c > 1]),
        check("Todo sector de una empresa está en la leyenda", [n["id"] for n in nodes if n["sector"] not in sectors]),
        check("Toda conexión une empresas que existen", dangling),
        check("Conexiones sin repetir y con a < b", duplicated + unordered),
        check("Ninguna empresa se conecta consigo misma", [e["a"] for e in valid if e["a"] == e["b"]]),
        check(f"Ninguna empresa pasa de {bg.MAX_DEGREE} conexiones", [i for i, d in degree.items() if d > bg.MAX_DEGREE]),
        check("Similitud mínima (0,15 en el mismo sector, 0,30 entre sectores) y respaldo solo del mismo sector",
              [f"{e['a']} - {e['b']} ({e['w']})" for e in valid if weak(e)]),
        check("Ninguna conexión que la validación rechazó", [f"{e['a']} - {e['b']}" for e in valid
                                                              if (e["a"], e["b"]) in rejected]),
        check("Toda empresa tiene conexiones (salvo la única de su sector)",
              [n["id"] for n in nodes if degree[n["id"]] == 0 and per_sector[n["sector"]] > 1]),
    ]


def certify_matches(graph, data):
    ids = {n["id"] for n in graph["nodes"]}
    name = {n["id"]: bg.normalize(n["name"]) for n in graph["nodes"]}
    matches = data["matches"]
    pairs = Counter((m["a"], m["b"]) for m in matches)
    return [
        check("Todo match une empresas del grafo", [m["id"] for m in matches if m["a"] not in ids or m["b"] not in ids]),
        check("Ningún match de una empresa consigo misma (ni con otra del mismo nombre)",
              [m["id"] for m in matches if m["a"] == m["b"] or (m["a"] in name and name.get(m["a"]) == name.get(m["b"]))]),
        check("Matches sin repetir", [f"{a} - {b}" for (a, b), c in pairs.items() if c > 1]),
        check("Relación y afinidad conocidas",
              [m["id"] for m in matches if m["rel"] not in RELATIONS or m["aff"] not in AFFINITIES]),
        check("Todo match explica por qué encaja", [m["id"] for m in matches if not m["why"].strip()]),
        check("La oferta clasificada es de empresas del grafo", [i for i in data["offers"] if i not in ids]),
    ]


def auto_verdict(text_a, text_b):
    """Veredicto automático de una conexión por similitud: (veredicto, motivo, términos en común)."""
    shared = sorted(set(bg.similarity_tokens(text_a)) & set(bg.similarity_tokens(text_b)))
    if bg.normalize(text_a) == bg.normalize(text_b):
        return "dudosa", "Automática: texto idéntico, no confirma oferta real", shared
    if len(shared) >= MIN_SHARED_TERMS:
        return "ok", f"Automática: comparten {', '.join(shared[:4])}", shared
    return "dudosa", "Automática: casi sin términos en común", shared


def review_queue(graph, validation, texts):
    """Conexiones por similitud sin veredicto (las de respaldo no se validan), con el veredicto automático."""
    by_id = {n["id"]: n for n in graph["nodes"]}
    rows = []
    for e in graph["edges"]:
        if e.get("fallback") or (e["a"], e["b"]) in validation:
            continue
        a, b = by_id[e["a"]], by_id[e["b"]]
        verdict, reason, _ = auto_verdict(texts.get(a["id"], ""), texts.get(b["id"], ""))
        rows.append({"Id empresa A": a["id"], "Id empresa B": b["id"], "Empresa A": a["name"], "Empresa B": b["name"],
                     "Sector A": a["sector"], "Sector B": b["sector"], "Similitud": e["w"],
                     "Veredicto": verdict, "Motivo": reason})
    return rows


def register(rows, path=bg.VALIDATION_CSV):
    """Agrega los veredictos al final de Conexiones_validadas.csv, sin reescribirlo."""
    path = Path(path)
    ends_with_newline = path.read_bytes().endswith(b"\n")
    with open(path, "a", encoding="utf-8", newline="") as f:
        if not ends_with_newline:
            f.write("\r\n")
        csv.DictWriter(f, VALIDATION_COLUMNS, lineterminator="\r\n").writerows(rows)


def print_report(checks):
    for c in checks:
        print(f"[{'OK' if c['ok'] else 'FALLA'}] {c['name']}" + ("" if c["ok"] else f" — {c['count']} caso(s), p. ej.: "
                                                                  + "; ".join(map(str, c["failures"][:3]))))


def main(argv=None):
    sys.stdout.reconfigure(encoding="utf-8")
    argv = sys.argv[1:] if argv is None else argv
    graph = json.loads(bg.OUT_JSON.read_text(encoding="utf-8"))
    validation = bg.load_validation(bg.VALIDATION_CSV)
    checks = certify_graph(graph, bg.rejected_pairs(validation))
    if MATCHES_JSON.exists():
        checks += certify_matches(graph, json.loads(MATCHES_JSON.read_text(encoding="utf-8")))
    print_report(checks)

    rows, _ = bg.load_companies(bg.BASE_CSV, bg.SECTOR_CSV, bg.EXTRA_CSVS)
    texts = {r[bg.ID_COL]: bg.similarity_text(r) for r in rows}
    queue = review_queue(graph, validation, texts)
    similarity_edges = sum(1 for e in graph["edges"] if not e.get("fallback"))
    print(f"Conexiones por similitud con veredicto: {similarity_edges - len(queue)} de {similarity_edges}; "
          f"por revisar: {len(queue)}")
    if queue and "--registrar" in argv:
        register(queue)
        print(f"Registradas {len(queue)} conexiones en {bg.VALIDATION_CSV.name} "
              f"({Counter(r['Veredicto'] for r in queue)}). Corre build_graph.py de nuevo para aplicarlas.")
        queue = []
    if queue:
        pd.DataFrame(queue, columns=VALIDATION_COLUMNS).to_csv(REVIEW_CSV, index=False, encoding="utf-8-sig",
                                                              lineterminator="\r\n")
        print(f"Escrito: {REVIEW_CSV.name} (revísalo y pásalo a Conexiones_validadas.csv, o usa --registrar)")
    elif REVIEW_CSV.exists():
        REVIEW_CSV.unlink()  # ya no hay nada pendiente: el archivo quedaría viejo
    failed = [c for c in checks if not c["ok"]]
    print(f"Pruebas: {len(checks) - len(failed)} de {len(checks)} pasan")
    return 1 if failed else 0


if __name__ == "__main__":
    sys.exit(main())
