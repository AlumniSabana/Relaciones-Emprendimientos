"""Matches y catálogo del chat (tools/build_matches.py)."""
import sys
from pathlib import Path

import pandas as pd

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "tools"))

import build_matches as bm  # noqa: E402

IDS = {"A", "B", "C"}


def match(a, b, rel="Proveedor", aff="Alta", id_="M1"):
    return {"ID match": id_, "ID empresa origen": a, "ID contraparte": b, "Relación para origen": rel,
            "Afinidad estimada": aff, "Motivo del match": " insumos \n baratos ", "Validación previa": "Confirmar"}


def test_matches_keep_valid_rows_and_drop_unknown_repeated_or_self_pairs():
    rows = pd.DataFrame([match("A", "B"), match("A", "B", id_="M2"), match("A", "A", id_="M3"),
                         match("A", "Z", id_="M4"), match("B", "C", rel="Otra", id_="M5"),
                         match("B", "C", aff="Baja", id_="M6"), match("C", "A", "Alianza comercial", "Media", "M7")])
    result = bm.load_matches(rows, IDS)
    assert [(m["id"], m["a"], m["b"], m["rel"], m["aff"]) for m in result] == [
        ("M1", "A", "B", "Proveedor", "Alta"), ("M7", "C", "A", "Alianza comercial", "Media")]
    assert result[0]["why"] == "insumos baratos"  # espacios y saltos de línea se compactan


def test_offers_skip_companies_outside_the_graph_or_without_data():
    companies = pd.DataFrame({"Id empresa": ["A", "B", "Z"], "Producto o servicio resumido": ["Pasteles", None, "x"],
                              "Naturaleza de la oferta": ["Producto", None, "Servicio"],
                              "Tipo de producto o servicio": ["Alimentos", None, "y"]})
    assert bm.load_offers(companies, IDS) == {"A": {"summary": "Pasteles", "nature": "Producto", "category": "Alimentos"}}


def test_catalog_has_one_line_per_company_with_the_offer_and_no_separator_inside_values():
    graph = {"nodes": [{"id": "A", "name": "Dulce|Cájica", "sector": "Alimentos", "city": "Cájica",
                        "department": "Cundinamarca", "fields": [["Servicio que ofrece", "Postres " * 100]]},
                       {"id": "B", "name": "Sin datos", "sector": "S", "fields": []}]}
    lines = bm.catalog_lines(graph, {"A": {"category": "Pastelería"}})
    assert len(lines) == 2
    first = lines[0].split("|")
    assert len(first) == 8 and first[1] == "Dulce/Cájica" and first[3] == "Cájica" and first[6] == "Pastelería"
    assert len(first[7]) <= bm.MAX_OFFER
    assert lines[1] == "B|Sin datos|S||||" + "|"
