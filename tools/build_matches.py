"""Matches entre empresas y catálogo del chat, a partir de "Empresas clasificadas y matches.xlsx".

Escribe web/src/data/matches.json (hoja "Matches complementarios" + clasificación de cada empresa) y
web/api/_catalog.ts (una línea por empresa del grafo, que el chat de IA lee en el servidor).
Uso (después de tools/build_graph.py):
  uv run --with pandas --with openpyxl python tools/build_matches.py
"""
import json
import sys
from datetime import date
from pathlib import Path

import pandas as pd

ROOT = Path(__file__).resolve().parents[1]
XLSX = ROOT / "Empresas clasificadas y matches.xlsx"
GRAPH_JSON = ROOT / "web/src/data/graph.json"
OUT_JSON = ROOT / "web/src/data/matches.json"
OUT_CATALOG = ROOT / "web/api/_catalog.ts"

RELATIONS = {"Proveedor", "Posible cliente", "Alianza comercial"}
AFFINITIES = {"Alta", "Media"}
MAX_OFFER = 200  # caracteres de la oferta por empresa en el catálogo del chat


def text(value):
    return "" if pd.isna(value) else " ".join(str(value).split())


def load_offers(companies, ids):
    """Oferta resumida, naturaleza y categoría de cada empresa del grafo (solo las que tienen dato)."""
    offers = {}
    for _, r in companies.iterrows():
        i = text(r["Id empresa"])
        if i not in ids:
            continue
        offer = {k: text(r[col]) for k, col in (("summary", "Producto o servicio resumido"),
                                                ("nature", "Naturaleza de la oferta"),
                                                ("category", "Tipo de producto o servicio"))}
        offers[i] = {k: v for k, v in offer.items() if v}
    return {i: o for i, o in offers.items() if o}


def load_matches(rows, ids):
    """Matches válidos: ids del grafo, relación y afinidad conocidas, sin pares repetidos ni consigo misma."""
    matches, seen = [], set()
    for _, r in rows.iterrows():
        a, b = text(r["ID empresa origen"]), text(r["ID contraparte"])
        rel, aff = text(r["Relación para origen"]), text(r["Afinidad estimada"])
        if a == b or a not in ids or b not in ids or rel not in RELATIONS or aff not in AFFINITIES or (a, b) in seen:
            continue
        seen.add((a, b))
        matches.append({"id": text(r["ID match"]), "a": a, "b": b, "rel": rel, "aff": aff,
                        "why": text(r["Motivo del match"]), "check": text(r["Validación previa"])})
    return matches


def catalog_lines(graph, offers):
    """id|nombre|sector|ciudad|departamento|tamaño|categoría|oferta, una línea por empresa."""
    lines = []
    for n in graph["nodes"]:
        fields = dict(n["fields"])
        o = offers.get(n["id"], {})
        offer = o.get("summary") or fields.get("Servicio que ofrece") or fields.get("Descripción completa", "")
        row = [n["id"], n["name"], n["sector"], n.get("city", ""), n.get("department", ""), n.get("size", ""),
               o.get("category", ""), text(offer)[:MAX_OFFER]]
        lines.append("|".join(c.replace("|", "/") for c in map(text, row)))
    return lines


def main():
    sys.stdout.reconfigure(encoding="utf-8")
    graph = json.loads(GRAPH_JSON.read_text(encoding="utf-8"))
    ids = {n["id"] for n in graph["nodes"]}
    book = pd.read_excel(XLSX, sheet_name=["Empresas", "Matches complementarios"], dtype=str)
    offers = load_offers(book["Empresas"], ids)
    matches = load_matches(book["Matches complementarios"], ids)
    data = {"generated": date.today().isoformat(), "offers": offers, "matches": matches}
    OUT_JSON.write_text(json.dumps(data, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    catalog = "\n".join(catalog_lines(graph, offers))
    OUT_CATALOG.parent.mkdir(parents=True, exist_ok=True)
    OUT_CATALOG.write_text("// Generado por tools/build_matches.py: no editar a mano.\n"
                           f"export const CATALOG = {json.dumps(catalog, ensure_ascii=False)};\n", encoding="utf-8")
    print(f"Empresas con clasificación: {len(offers)}  Matches: {len(matches)} de {len(book['Matches complementarios'])} filas")
    print(f"Escrito: {OUT_JSON}\nEscrito: {OUT_CATALOG}  ({len(catalog)} caracteres)")


if __name__ == "__main__":
    main()
