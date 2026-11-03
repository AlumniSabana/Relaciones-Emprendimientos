"""Genera web/src/data/graph.json a partir de los CSV del proyecto.

Reglas y decisiones: specs/001-grafo-empresas-similares/{data-model.md,research.md}.
Uso: uv run --with pandas --with scikit-learn python tools/build_graph.py
"""
import json
import re
import sys
import unicodedata
from collections import Counter
from datetime import date
from pathlib import Path

import numpy as np
import pandas as pd
from sklearn.feature_extraction.text import TfidfVectorizer

ROOT = Path(__file__).resolve().parents[1]
BASE_CSV = ROOT / "Base_emprendedores_2026_2_limpia.csv"
SECTOR_CSV = ROOT / "Sector_relacionado_ia.csv"
OUT_JSON = ROOT / "web" / "src" / "data" / "graph.json"
CONNECTIONS_CSV = ROOT / "Conexiones_empresas.csv"
VALIDATION_CSV = ROOT / "Conexiones_validadas.csv"  # veredicto por conexión (ok, dudosa, mala)
# Empresas nuevas (tools/clean_new_companies.py), con las mismas columnas que la base.
EXTRA_CSVS = [ROOT / "Emprendedores_nuevos_2026_2_limpia.csv"]

MIN_SIMILARITY = 0.15        # empresas del mismo sector (research D4)
MIN_SIMILARITY_CROSS = 0.30  # sectores distintos: se exige más evidencia de que se parecen
MAX_DEGREE = 10
FALLBACK_LINKS = 3  # conexiones que se dan a una empresa sin ninguna, con empresas de su mismo sector

ID_COL = "Eloqua Unique Identifier"
NAME_COL = "Nombre de empresa"
SECTOR_COL = "Sector relacionado"

# Solo las palabras que la empresa escribió sobre lo que ofrece (research D2). Quedan fuera la forma
# legal, el sector y el código de actividad declarados, y las frases automáticas de "Descripción
# completa": son trámites o datos mal declarados, no la oferta.
SIMILARITY_COLUMNS = ["Servicio que ofrece", "Descripción"]

# Campos de la tarjeta, en orden (data-model.md). Excluidos a propósito: Descripción,
# Eloqua Unique Identifier, Mapped to Contact, Volumen de Ingresos y Tamaño Empresa.
FIELD_ORDER = [
    "Servicio que ofrece", "Descripción completa", "Tipo de Empresa", "Sector", "Razón Social",
    "ID de Empresa (NIT)", "Fecha de Fundación", "Emprendimiento activo", "Empresa propia",
    "Incubado en la Universidad", "Tamaño", "Volumen", "ODS", "País", "Departamento", "Ciudad",
    "Dirección", "Página Web", "Redes Sociales", "Dirección de correo electrónico", "Teléfono",
    "Cargo",
]

# Columnas donde "No" es una respuesta real y no relleno.
YES_NO_COLUMNS = {"Empresa propia", "Incubado en la Universidad", "Emprendimiento activo"}

# Textos que solo indican ausencia de dato (research D6b); se comparan sin tildes ni mayúsculas.
PLACEHOLDERS = {
    "no informa", "noinforma", "no tiene", "no hay cargo todavia", "n/a", "na", "ninguno",
    "ninguna", "no aplica",
}

GRAYS = {"#c8ccd0", "#d0d4d8", "#9aa0a6", "#808080", "#a9a9a9", "#d3d3d3"}
# shortcut: 16 colores elegidos a ojo, no optimizados perceptualmente; revisar si se añaden sectores.
PALETTE = [
    "#e6194b", "#3cb44b", "#4363d8", "#f58231", "#911eb4", "#0e9aa7", "#f032e6", "#9a6324",
    "#800000", "#808000", "#000075", "#e0a800", "#7fb800", "#ff7aa2", "#00bfff", "#b57edc",
]


def normalize(text):
    """Minúsculas y sin tildes."""
    text = unicodedata.normalize("NFD", str(text).lower())
    return re.sub(r"[̀-ͯ]", "", text).strip()


# Palabras que no distinguen qué ofrece una empresa (research D2b). Los conectores unen
# "maquinaria para" con "herramientas para"; las genéricas de comercio, "comercio de textiles" con
# "comercio de motocicletas". Van sin tildes y en minúsculas; se comparan por su raíz.
# shortcut: listas hechas a mano con los datos de 2026-2; revisar si llegan rubros nuevos.
STOPWORDS = frozenset("""
    de la el los las un una unos unas y e o u a en con sin por para del al que se su sus es son lo como
    mas muy entre sobre desde hasta ya ha han esta este estos estas nuestro nuestra nuestros nuestras
    tambien ser cada todo toda todos todas otro otra otros otras tipo tipos donde cuales cual tiene
    tienen hace hacen cuenta mediante traves parte tanto ademas asi mismo si no ni les le nos he hay
    puede pueden realiza realizamos
""".split())
GENERIC_WORDS = frozenset("""
    venta ventas comercializacion comercializadora comercializar comercializamos comercio distribucion
    distribuidora distribuidor importacion importadora servicio servicios empresa empresas producto
    productos prestacion presta prestamos ofrece ofrecemos dedicada dedica dedicamos actividad
    actividades clientes cliente calidad somos general generales integral integrales
    empresarial fabricacion fabrica elaboracion produccion productora productor administracion
    proyecto proyectos desarrollo realiza
    mayor mayores menor menores mayorista mayoristas detal colombia colombiano colombiana
    colombianos colombianas linea online virtual internet partes piezas accesorios articulos
    agencia agencias vende venden vendemos elabora elaboran elaboramos brinda brindan brindamos
    ofrecen
""".split())
STEM_LENGTH = 7  # shortcut: raíz = primeras 7 letras ("hotel/hotelería", "jurídico/jurídicas"); sin lematizador
_GENERIC_STEMS = frozenset(w[:STEM_LENGTH] for w in GENERIC_WORDS)


def similarity_tokens(text):
    """Raíces y pares de raíces de un texto, sin palabras vacías ni genéricas.

    El texto se parte en frases (puntuación y saltos de línea) y los pares no cruzan de una a otra.
    """
    tokens = []
    for chunk in re.split(r"[.;:!?\n|()\[\]/,]|\s-\s", normalize(text)):
        words = [w[:STEM_LENGTH] for w in re.findall(r"[a-z0-9]+", chunk)
                 if len(w) > 2 and w not in STOPWORDS]
        words = [w for w in words if w not in _GENERIC_STEMS]
        tokens += words + [f"{a} {b}" for a, b in zip(words, words[1:])]
    return tokens


def _text(value):
    if value is None or (isinstance(value, float) and value != value):
        return ""
    return str(value).strip()


def is_valid_name(name):
    name = _text(name)
    return len(name) >= 3 and not normalize(name).startswith("no tiene nombre")


def is_placeholder(value, column):
    s = normalize(_text(value))
    if not s or re.fullmatch(r"[-._\s]+", s):
        return True
    if s == "no":
        return column not in YES_NO_COLUMNS
    return s in PLACEHOLDERS


def clean_value(value, column):
    """Texto recortado, o None si falta el dato."""
    text = _text(value)
    if is_placeholder(text, column):
        return None
    if column == "Fecha de Fundación":
        text = re.sub(r"\s+0:00(:00)?$", "", text)
    return text


def build_fields(row, discarded=None):
    fields = []
    for label in FIELD_ORDER:
        value = clean_value(row.get(label), label)
        if value is None:
            if discarded is not None and _text(row.get(label)):
                discarded[label] += 1
            continue
        fields.append([label, value])
    return fields


def load_companies(base_csv, sector_csv, extra_csvs=()):
    """Filas de empresas válidas con su sector, más un resumen de lo excluido.

    `extra_csvs` son bases con las mismas columnas (empresas nuevas) que se suman a `base_csv`.
    """
    base = pd.concat([pd.read_csv(p, dtype=str, keep_default_na=False)
                      for p in (base_csv, *extra_csvs) if Path(p).exists()], ignore_index=True)
    sectors = pd.read_csv(sector_csv, dtype=str, keep_default_na=False)
    base[ID_COL] = base[ID_COL].str.strip()
    sector_of = (sectors.assign(**{ID_COL: sectors[ID_COL].str.strip()})
                 .drop_duplicates(ID_COL).set_index(ID_COL)[SECTOR_COL].str.strip())

    stats = {"rows": len(base)}
    unique = base.drop_duplicates(ID_COL)
    stats["duplicates"] = len(base) - len(unique)
    named = unique[unique[NAME_COL].map(is_valid_name)]
    stats["invalid_names"] = len(unique) - len(named)
    named = named.assign(**{NAME_COL: named[NAME_COL].str.strip(),
                            "_sector": named[ID_COL].map(sector_of).fillna("")})
    valid = named[named["_sector"] != ""]
    stats["no_sector"] = len(named) - len(valid)
    return valid.to_dict("records"), stats


def completeness_ranks(counts):
    """Posición relativa de 0 (más campos) a 1 (menos); desempate por id."""
    order = sorted(counts, key=lambda i: (-counts[i], i))
    last = max(len(order) - 1, 1)
    return {i: pos / last for pos, i in enumerate(order)}


def load_validation(path):
    """Veredictos de Conexiones_validadas.csv: {(id a, id b) con a < b: (veredicto, entre sectores)}.

    El archivo se puede corregir a mano: basta cambiar la columna Veredicto (ok, dudosa o mala).
    Sin archivo no hay veredictos y no se quita ninguna conexión.
    """
    path = Path(path)
    if not path.exists():
        return {}
    table = pd.read_csv(path, dtype=str, keep_default_na=False, encoding="utf-8-sig")
    return {tuple(sorted((r["Id empresa A"], r["Id empresa B"]))):
            (r["Veredicto"].strip().lower(), r["Sector A"] != r["Sector B"])
            for _, r in table.iterrows()}


def rejected_pairs(validation):
    """Parejas que se quitan: las malas y, entre sectores distintos, también las dudosas."""
    return {pair for pair, (verdict, cross) in validation.items()
            if verdict == "mala" or (verdict == "dudosa" and cross)}


def _link_isolated(sim, ids, sectors, ranks, degree, edges, rejected=frozenset()):
    """Une cada empresa sin conexiones con las más parecidas de su sector, aunque se parezcan poco.

    Prefiere empresas que ya están conectadas (para sumarla al grafo y no a una isla aparte) y,
    si la similitud empata (por ejemplo 0), las más completas. Estas conexiones llevan `fallback`.
    """
    isolated = [i for i in range(len(ids)) if degree[i] == 0]
    connected = set(range(len(ids))) - set(isolated)
    for i in isolated:
        peers = [j for j in range(len(ids)) if j != i and sectors[j] == sectors[i]
                 and tuple(sorted((ids[i], ids[j]))) not in rejected]
        pool = [j for j in peers if j in connected] or peers
        pool.sort(key=lambda j: (-sim[i, j], ranks[j], ids[j]))
        linked = 0
        for j in pool:
            if linked == FALLBACK_LINKS:
                break
            if degree[j] >= MAX_DEGREE:
                continue
            degree[i] += 1
            degree[j] += 1
            linked += 1
            a, b = sorted((ids[i], ids[j]))
            edges.append({"a": a, "b": b, "w": round(float(sim[i, j]), 3), "fallback": True})
        connected.add(i)


def build_edges(texts, ids, sectors=None, ranks=None, rejected=frozenset()):
    """Conexiones por similitud coseno TF-IDF, voraz de mayor a menor con grado máximo.

    Con `sectors`, entre sectores distintos se exige MIN_SIMILARITY_CROSS en vez de MIN_SIMILARITY,
    y toda empresa que quede sin conexiones se une a otras de su sector (`ranks` desempata).
    `rejected` son parejas (a < b) validadas como malas: se quitan sin reponerlas con otras sin
    revisar, y el respaldo por sector tampoco las vuelve a crear.
    """
    vectorizer = TfidfVectorizer(analyzer=similarity_tokens, sublinear_tf=True, min_df=2, max_df=0.1)
    try:
        matrix = vectorizer.fit_transform(texts)
        sim = (matrix @ matrix.T).toarray()
    except ValueError:  # vocabulario vacío: ninguna palabra compartida
        if sectors is None:
            return []
        sim = np.zeros((len(ids), len(ids)))
    rows, cols = np.triu_indices(len(ids), 1)
    weights = sim[rows, cols]
    if sectors is None:
        minimum = MIN_SIMILARITY
    else:
        sector = np.asarray(sectors)
        minimum = np.where(sector[rows] == sector[cols], MIN_SIMILARITY, MIN_SIMILARITY_CROSS)
    keep = weights >= minimum
    rows, cols, weights = rows[keep], cols[keep], weights[keep]
    degree = Counter()
    edges = []
    for k in np.argsort(-weights, kind="stable"):
        i, j = rows[k], cols[k]
        if degree[i] >= MAX_DEGREE or degree[j] >= MAX_DEGREE:
            continue
        degree[i] += 1
        degree[j] += 1
        a, b = sorted((ids[i], ids[j]))
        edges.append({"a": a, "b": b, "w": round(float(weights[k]), 3)})
    if rejected:
        edges = [e for e in edges if (e["a"], e["b"]) not in rejected]
        position = {k: i for i, k in enumerate(ids)}
        degree = Counter()
        for e in edges:
            degree[position[e["a"]]] += 1
            degree[position[e["b"]]] += 1
    if sectors is not None:
        _link_isolated(sim, ids, sectors, ranks if ranks is not None else list(range(len(ids))),
                       degree, edges, rejected)
    return edges


def assign_colors(sector_names):
    names = sorted(set(sector_names))
    if len(names) > len(PALETTE):
        raise ValueError(f"hay {len(names)} sectores y solo {len(PALETTE)} colores")
    return [{"name": n, "color": PALETTE[i]} for i, n in enumerate(names)]


def build_graph(base_csv, sector_csv, validation_csv=None, extra_csvs=()):
    rows, stats = load_companies(base_csv, sector_csv, extra_csvs)
    rejected = rejected_pairs(load_validation(validation_csv)) if validation_csv else set()
    discarded = Counter()
    fields = {r[ID_COL]: build_fields(r, discarded) for r in rows}
    ranks = completeness_ranks({i: len(f) for i, f in fields.items()})
    nodes = [{"id": r[ID_COL], "name": r[NAME_COL], "sector": r["_sector"],
              "rank": round(ranks[r[ID_COL]], 4), "fields": fields[r[ID_COL]]} for r in rows]
    texts = [" ".join(filter(None, (clean_value(r.get(c), c) for c in SIMILARITY_COLUMNS)))
             for r in rows]
    edges = build_edges(texts, [n["id"] for n in nodes], [n["sector"] for n in nodes],
                        [n["rank"] for n in nodes], rejected)
    connected = {e["a"] for e in edges} | {e["b"] for e in edges}
    stats.update(nodes=len(nodes), edges=len(edges), isolated=len(nodes) - len(connected),
                 fallback_edges=sum(1 for e in edges if e.get("fallback")),
                 rejected_pairs=len(rejected),
                 placeholders=dict(discarded))
    graph = {"generated": date.today().isoformat(),
             "sectors": assign_colors(n["sector"] for n in nodes),
             "nodes": nodes, "edges": edges}
    return graph, stats


def write_graph(graph, path):
    path = Path(path)
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(graph, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")


def write_connections_csv(graph, path, validation=None):
    """Una fila por empresa y vecina (cada conexión aparece dos veces) para filtrar por empresa.

    La columna Validación muestra el veredicto de Conexiones_validadas.csv (ok o dudosa).
    """
    by_id = {n["id"]: n for n in graph["nodes"]}
    validation = validation or {}
    rows = []
    for e in graph["edges"]:
        verdict = validation.get((e["a"], e["b"]), ("sin revisar",))[0]
        for src, dst in ((e["a"], e["b"]), (e["b"], e["a"])):
            rows.append({"Empresa": by_id[src]["name"], "Sector": by_id[src]["sector"],
                         "Empresa conectada": by_id[dst]["name"],
                         "Sector de la conectada": by_id[dst]["sector"],
                         "Similitud": e["w"],
                         "Tipo": "Mismo sector (respaldo)" if e.get("fallback") else "Similitud",
                         "Validación": "no aplica (respaldo)" if e.get("fallback") else verdict,
                         "Id empresa": src, "Id conectada": dst})
    table = pd.DataFrame(rows).sort_values(["Empresa", "Similitud"], ascending=[True, False])
    table.to_csv(path, index=False, encoding="utf-8-sig")  # con BOM para que Excel lea las tildes


def main():
    sys.stdout.reconfigure(encoding="utf-8")
    graph, s = build_graph(BASE_CSV, SECTOR_CSV, VALIDATION_CSV, EXTRA_CSVS)
    write_graph(graph, OUT_JSON)
    write_connections_csv(graph, CONNECTIONS_CSV, load_validation(VALIDATION_CSV))
    print(f"Filas de entrada: {s['rows']}")
    print(f"Excluidas: {s['duplicates']} duplicadas, {s['invalid_names']} con nombre inválido, "
          f"{s['no_sector']} sin sector")
    print("Valores de relleno descartados por columna:", s["placeholders"])
    print(f"Parejas rechazadas por la validación: {s['rejected_pairs']}")
    print(f"Nodos: {s['nodes']}  Aristas: {s['edges']} (de respaldo por sector: {s['fallback_edges']})  "
          f"Nodos sin conexiones: {s['isolated']}")
    print(f"Escrito: {OUT_JSON}")
    print(f"Escrito: {CONNECTIONS_CSV}")


if __name__ == "__main__":
    main()
