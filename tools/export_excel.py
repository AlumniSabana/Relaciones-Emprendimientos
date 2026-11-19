"""Escribe Empresas_en_la_pagina.xlsx: las empresas del grafo con todos sus datos y sus conexiones.

Hoja "Empresas": una fila por empresa (datos de la tarjeta, datos de la base que la página no muestra,
cuántas conexiones tiene y con quiénes). Hoja "Conexiones": una fila por empresa y vecina.
Uso: uv run --with pandas --with scikit-learn --with openpyxl python tools/export_excel.py
"""
import sys
from pathlib import Path

import pandas as pd
from openpyxl.utils import get_column_letter

sys.path.insert(0, str(Path(__file__).parent))
import build_graph as bg  # noqa: E402

OUT = bg.ROOT / "Empresas_en_la_pagina.xlsx"
# Columnas de la base que la tarjeta no muestra a propósito (se quitaron de la página).
BASE_ONLY = ["Volumen de Ingresos", "Tamaño Empresa", "Descripción"]


def companies_table(graph, rows, connections):
    raw = {r[bg.ID_COL]: r for r in rows}
    related = connections.groupby("Id empresa")
    table = []
    for n in graph["nodes"]:
        mine = related.get_group(n["id"]) if n["id"] in related.groups else connections.iloc[0:0]
        fallback = mine["Tipo"] != "Similitud"
        row = {"Id empresa": n["id"], "Empresa": n["name"], "Sector (grafo)": n["sector"],
               "Completitud (0-1)": n["rank"],
               "Departamento (filtro)": n.get("department", ""), "Ciudad (filtro)": n.get("city", ""),
               "Tamaño (filtro)": n.get("size", ""),
               "Conexiones": len(mine), "Conexiones por similitud": int((~fallback).sum()),
               "Conexiones de respaldo (mismo sector)": int(fallback.sum()),
               "Empresas conectadas": "; ".join(mine["Empresa conectada"]),
               "Enlace de la página web bloqueado": "sí" if n.get("nolink") else ""}
        row.update({label: value for label, value in n["fields"]})
        row.update({c: bg._text(raw[n["id"]].get(c)) for c in BASE_ONLY})
        table.append(row)
    return pd.DataFrame(table)


def write_excel(companies, connections, path):
    with pd.ExcelWriter(path, engine="openpyxl") as writer:
        for name, table in (("Empresas", companies), ("Conexiones", connections)):
            table.to_excel(writer, sheet_name=name, index=False)
            sheet = writer.sheets[name]
            sheet.freeze_panes = "C2"
            sheet.auto_filter.ref = sheet.dimensions
            for i, col in enumerate(table.columns, 1):
                width = max([len(str(col))] + [len(str(v)) for v in table[col].head(200)])
                sheet.column_dimensions[get_column_letter(i)].width = min(max(width + 2, 10), 50)


def main():
    sys.stdout.reconfigure(encoding="utf-8")
    graph, _ = bg.build_graph(bg.BASE_CSV, bg.SECTOR_CSV, bg.VALIDATION_CSV, bg.EXTRA_CSVS)
    rows, _ = bg.load_companies(bg.BASE_CSV, bg.SECTOR_CSV, bg.EXTRA_CSVS)
    connections = bg.connections_table(graph, bg.load_validation(bg.VALIDATION_CSV))
    companies = companies_table(graph, rows, connections)
    write_excel(companies, connections, OUT)
    print(f"Empresas: {len(companies)}  Conexiones (filas): {len(connections)}  Columnas: {len(companies.columns)}")
    print(f"Escrito: {OUT}")


if __name__ == "__main__":
    main()
