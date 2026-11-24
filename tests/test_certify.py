"""Certificación de relaciones (tools/certify.py): casos que deben fallar y los datos reales, que deben pasar."""
import json
import sys
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "tools"))

import build_graph as bg  # noqa: E402
import certify  # noqa: E402


def node(i, sector="S1", name=None):
    return {"id": i, "name": name or f"Empresa {i}", "sector": sector}


def graph(nodes, edges):
    return {"sectors": [{"name": s} for s in {n["sector"] for n in nodes}], "nodes": nodes, "edges": edges}


def failed(checks):
    return {c["name"] for c in checks if not c["ok"]}


GOOD = graph([node("A"), node("B"), node("C", "S2"), node("D", "S2")],
             [{"a": "A", "b": "B", "w": 0.4}, {"a": "C", "b": "D", "w": 0.2, "fallback": True},
              {"a": "A", "b": "C", "w": 0.5}])


def test_a_consistent_graph_passes_every_check():
    assert failed(certify.certify_graph(GOOD)) == set()


@pytest.mark.parametrize("edges, expected", [
    ([{"a": "A", "b": "Z", "w": 0.5}], "Toda conexión une empresas que existen"),
    ([{"a": "A", "b": "B", "w": 0.5}, {"a": "A", "b": "B", "w": 0.5}], "Conexiones sin repetir y con a < b"),
    ([{"a": "B", "b": "A", "w": 0.5}], "Conexiones sin repetir y con a < b"),
    ([{"a": "A", "b": "A", "w": 0.5}], "Ninguna empresa se conecta consigo misma"),
    ([{"a": "A", "b": "B", "w": 0.1}], "Similitud mínima (0,15 en el mismo sector, 0,30 entre sectores) y respaldo solo del mismo sector"),
    ([{"a": "A", "b": "C", "w": 0.2}], "Similitud mínima (0,15 en el mismo sector, 0,30 entre sectores) y respaldo solo del mismo sector"),
    ([{"a": "A", "b": "C", "w": 0, "fallback": True}], "Similitud mínima (0,15 en el mismo sector, 0,30 entre sectores) y respaldo solo del mismo sector"),
])
def test_a_bad_edge_is_caught(edges, expected):
    assert expected in failed(certify.certify_graph(graph([node("A"), node("B"), node("C", "S2")], edges)))


def test_a_company_with_too_many_connections_is_caught():
    hub = [node("H")] + [node(f"N{i:02d}") for i in range(bg.MAX_DEGREE + 1)]
    edges = [{"a": "H", "b": n["id"], "w": 0.5} for n in hub[1:]]
    assert f"Ninguna empresa pasa de {bg.MAX_DEGREE} conexiones" in failed(certify.certify_graph(graph(hub, edges)))


def test_a_rejected_pair_still_in_the_graph_is_caught():
    assert "Ninguna conexión que la validación rechazó" in failed(certify.certify_graph(GOOD, {("A", "B")}))


def test_an_isolated_company_is_caught_unless_it_is_alone_in_its_sector():
    g = graph([node("A"), node("B"), node("C", "S2")], [])
    assert failed(certify.certify_graph(g)) == {"Toda empresa tiene conexiones (salvo la única de su sector)"}
    alone = graph([node("A"), node("B", "S3"), node("C", "S2")], [])  # cada una sola en su sector
    assert failed(certify.certify_graph(alone)) == set()


def test_unknown_sector_and_duplicate_ids_are_caught():
    g = graph([node("A"), node("A")], [])
    g["nodes"][0]["sector"] = "Inexistente"
    assert {"Ids de empresa únicos y con nombre", "Todo sector de una empresa está en la leyenda"} <= failed(certify.certify_graph(g))


MATCH = {"id": "M1", "a": "A", "b": "B", "rel": "Proveedor", "aff": "Alta", "why": "porque sí", "check": ""}


def matches(*rows):
    return {"matches": list(rows), "offers": {"A": {"summary": "x"}}}


def test_valid_matches_pass():
    assert failed(certify.certify_matches(GOOD, matches(MATCH))) == set()


@pytest.mark.parametrize("change, expected", [
    ({"b": "Z"}, "Todo match une empresas del grafo"),
    ({"b": "A"}, "Ningún match de una empresa consigo misma (ni con otra del mismo nombre)"),
    ({"rel": "Amigo"}, "Relación y afinidad conocidas"),
    ({"aff": "Baja"}, "Relación y afinidad conocidas"),
    ({"why": "  "}, "Todo match explica por qué encaja"),
])
def test_a_bad_match_is_caught(change, expected):
    assert expected in failed(certify.certify_matches(GOOD, matches({**MATCH, **change})))


def test_repeated_matches_and_same_name_companies_are_caught():
    assert "Matches sin repetir" in failed(certify.certify_matches(GOOD, matches(MATCH, {**MATCH, "id": "M2"})))
    twins = graph([node("A", name="Café Uno"), node("B", name="CAFÉ UNO")], [])
    assert "Ningún match de una empresa consigo misma (ni con otra del mismo nombre)" in failed(
        certify.certify_matches(twins, matches(MATCH)))


def test_matches_offers_must_belong_to_the_graph():
    data = matches(MATCH)
    data["offers"] = {"Z": {"summary": "x"}}
    assert "La oferta clasificada es de empresas del grafo" in failed(certify.certify_matches(GOOD, data))


def test_automatic_verdicts():
    same = "Venta de pasteles artesanales para eventos"
    assert certify.auto_verdict(same, same)[0] == "dudosa"
    assert certify.auto_verdict("pasteles artesanales para eventos", "tortas artesanales y pasteles para eventos")[0] == "ok"
    assert certify.auto_verdict("pasteles", "software contable")[0] == "dudosa"


def test_review_queue_skips_fallback_and_already_validated_edges():
    g = graph([node("A"), node("B"), node("C"), node("D")],
              [{"a": "A", "b": "B", "w": 0.4}, {"a": "A", "b": "C", "w": 0.3}, {"a": "A", "b": "D", "w": 0, "fallback": True}])
    texts = {i: "pasteles artesanales para eventos" for i in "ABCD"}
    queue = certify.review_queue(g, {("A", "B"): ("ok", False)}, texts)
    assert [(r["Id empresa A"], r["Id empresa B"]) for r in queue] == [("A", "C")]
    assert queue[0]["Veredicto"] == "dudosa" and queue[0]["Motivo"].startswith("Automática")


def test_register_appends_without_rewriting_the_file(tmp_path):
    path = tmp_path / "v.csv"
    header = ",".join(certify.VALIDATION_COLUMNS)
    original = f"﻿{header}\r\nA,B,x,y,S,S,0.5,ok,m"  # sin salto final: se agrega
    path.write_bytes(original.encode("utf-8"))
    row = {c: "v" for c in certify.VALIDATION_COLUMNS}
    certify.register([row], path)
    data = path.read_bytes().decode("utf-8")
    assert data.startswith(original) and data.count("\r\n") == 3 and data.endswith("v,v,v,v,v,v,v,v,v\r\n")


def test_the_real_data_passes_every_check():
    graph_json = ROOT / "web" / "src" / "data" / "graph.json"
    if not graph_json.exists():
        pytest.skip("falta graph.json")
    real = json.loads(graph_json.read_text(encoding="utf-8"))
    checks = certify.certify_graph(real, bg.rejected_pairs(bg.load_validation(bg.VALIDATION_CSV)))
    if certify.MATCHES_JSON.exists():
        checks += certify.certify_matches(real, json.loads(certify.MATCHES_JSON.read_text(encoding="utf-8")))
    assert [(c["name"], c["failures"][:3]) for c in checks if not c["ok"]] == []
