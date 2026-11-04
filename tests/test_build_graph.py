"""Reglas de datos de tools/build_graph.py (ver specs/001-grafo-empresas-similares/data-model.md)."""
import json
import sys
from pathlib import Path

import pandas as pd
import pytest

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "tools"))

import build_graph as bg  # noqa: E402

BASE_CSV = ROOT / "Base_emprendedores_2026_2_limpia.csv"
SECTOR_CSV = ROOT / "Sector_relacionado_ia.csv"
VALIDATION_CSV = ROOT / "Conexiones_validadas.csv"
NEW_CSV = ROOT / "Emprendedores_nuevos_2026_2_limpia.csv"
EXCLUDED_LABELS = {
    "Descripción", "Eloqua Unique Identifier", "Mapped to Contact",
    "Volumen de Ingresos", "Tamaño Empresa", "Sector relacionado", "Nombre de empresa",
}


def write_csvs(tmp_path, companies):
    """companies: lista de dicts con 'id', 'name', 'sector' y otras columnas opcionales."""
    columns = ["Eloqua Unique Identifier", "Nombre de empresa", *bg.FIELD_ORDER,
               "Descripción", "Mapped to Contact", "Volumen de Ingresos", "Tamaño Empresa"]
    base_rows, sector_rows = [], []
    for c in companies:
        row = {col: "" for col in columns}
        row["Eloqua Unique Identifier"] = c["id"]
        row["Nombre de empresa"] = c["name"]
        row.update(c.get("extra", {}))
        base_rows.append(row)
        if c.get("sector") is not None:
            sector_rows.append({"Eloqua Unique Identifier": c["id"],
                                "Nombre de empresa": c["name"],
                                "Sector relacionado": c["sector"]})
    base, sector = tmp_path / "base.csv", tmp_path / "sector.csv"
    pd.DataFrame(base_rows, columns=columns).to_csv(base, index=False)
    pd.DataFrame(sector_rows, columns=["Eloqua Unique Identifier", "Nombre de empresa",
                                       "Sector relacionado"]).to_csv(sector, index=False)
    return base, sector


# (a) nombres inválidos
@pytest.mark.parametrize("name", ["No", "no", ".", "", "  ", "No Tiene Nombre",
                                  "no tiene nombre como tal", "ab"])
def test_invalid_names_are_rejected(name):
    assert not bg.is_valid_name(name)


@pytest.mark.parametrize("name", ["Meuf By Ana Paternina", "CDO MARKETING TURISTICO", "Pro"])
def test_valid_names_are_kept(name):
    assert bg.is_valid_name(name)


def test_invalid_names_and_duplicates_and_missing_sector(tmp_path):
    base, sector = write_csvs(tmp_path, [
        {"id": "A1", "name": " Empresa Uno ", "sector": "Moda"},
        {"id": "A1", "name": "Empresa Uno Duplicada", "sector": "Moda"},  # (b) duplicado
        {"id": "A2", "name": "No", "sector": "Moda"},                    # (a) inválido
        {"id": "A3", "name": "Empresa Sin Sector", "sector": None},      # (c) sin sector
        {"id": "A4", "name": "Empresa Cuatro", "sector": "Salud"},
    ])
    graph, stats = bg.build_graph(base, sector)
    names = {n["id"]: n["name"] for n in graph["nodes"]}
    assert names == {"A1": "Empresa Uno", "A4": "Empresa Cuatro"}
    assert stats["invalid_names"] == 1 and stats["no_sector"] == 1 and stats["duplicates"] == 1


# (d) campos de la tarjeta
@pytest.mark.parametrize("column,value", [
    ("Cargo", "No hay cargo todavia"), ("Volumen", "No informa"), ("Página Web", "no"),
    ("Redes Sociales", "----"), ("Razón Social", "---"), ("Dirección", "No tiene"),
    ("Incubado en la Universidad", "NOINFORMA"), ("ID de Empresa (NIT)", "."),
    ("Teléfono", "N/A"), ("Cargo", "  "),
])
def test_placeholders_are_not_data(column, value):
    assert bg.is_placeholder(value, column)


@pytest.mark.parametrize("column,value", [
    ("Empresa propia", "NO"), ("Incubado en la Universidad", "No"),
    ("Emprendimiento activo", "Si"), ("Cargo", "Gerente"),
])
def test_real_answers_are_data(column, value):
    assert not bg.is_placeholder(value, column)


def test_fields_exclude_empty_placeholders_and_excluded_columns(tmp_path):
    base, sector = write_csvs(tmp_path, [{
        "id": "A1", "name": "Empresa Uno", "sector": "Moda",
        "extra": {
            "Servicio que ofrece": "Venta de ropa", "Cargo": "No hay cargo todavia",
            "Página Web": "no", "Empresa propia": "NO", "Descripción": "Texto corto",
            "Descripción completa": "Texto corto. Actividad económica registrada.",
            "Mapped to Contact": "a@b.co", "Volumen de Ingresos": "V1", "Tamaño Empresa": "T1",
            "Dirección de correo electrónico": "a@b.co",
        },
    }])
    graph, _ = bg.build_graph(base, sector)
    fields = dict(graph["nodes"][0]["fields"])
    assert fields == {
        "Servicio que ofrece": "Venta de ropa",
        "Descripción completa": "Texto corto. Actividad económica registrada.",
        "Empresa propia": "NO",
        "Dirección de correo electrónico": "a@b.co",
    }
    assert not set(fields) & EXCLUDED_LABELS


# (e) orden de los campos
def test_fields_follow_the_documented_order(tmp_path):
    extra = {label: f"valor {i}" for i, label in enumerate(reversed(bg.FIELD_ORDER))}
    base, sector = write_csvs(tmp_path, [
        {"id": "A1", "name": "Empresa Uno", "sector": "Moda", "extra": extra}])
    graph, _ = bg.build_graph(base, sector)
    assert [label for label, _ in graph["nodes"][0]["fields"]] == bg.FIELD_ORDER


def test_documented_field_order_has_no_excluded_columns():
    assert len(bg.FIELD_ORDER) == len(set(bg.FIELD_ORDER))
    assert not set(bg.FIELD_ORDER) & EXCLUDED_LABELS


# (f) conexiones
TOPICS = ["astronomia", "botanica", "cerveceria", "dentistas", "escultura", "ferreteria",
          "geologia", "heladeria", "imprenta", "joyeria", "kinesiologia", "lavanderia"]


def _grouped_corpus(size=13):
    """12 grupos de 13 empresas con el mismo texto: cada palabra aparece en 8 % de los 156 textos."""
    texts, ids = [], []
    for topic in TOPICS:
        for i in range(size):
            texts.append(f"{topic} {topic}")
            ids.append(f"{topic}-{i}")
    return texts, ids


def test_edges_respect_max_degree_and_shape():
    texts, ids = _grouped_corpus()
    edges = bg.build_edges(texts, ids)
    degree = {}
    seen = set()
    for e in edges:
        assert e["a"] < e["b"], "a < b"
        assert (e["a"], e["b"]) not in seen, "sin pares repetidos"
        seen.add((e["a"], e["b"]))
        assert 0.15 <= e["w"] <= 1
        for k in (e["a"], e["b"]):
            degree[k] = degree.get(k, 0) + 1
    assert edges, "debe haber conexiones"
    assert bg.MAX_DEGREE == 10
    # Cada empresa del grupo tiene 12 candidatas: el tope se alcanza y no se supera.
    assert max(degree.values()) == bg.MAX_DEGREE


def test_edges_only_join_similar_companies():
    texts, ids = _grouped_corpus()
    for e in bg.build_edges(texts, ids):
        assert e["a"].split("-")[0] == e["b"].split("-")[0]


def test_tokens_drop_connectors_and_generic_words_and_stay_within_sentences():
    tokens = bg.similarity_tokens("Venta de ropa para mujeres. Sociedad limitada")
    assert "ropa" in tokens and "ropa mujeres" in tokens
    for junk in ("venta", "de", "para", "mujeres sociedad"):
        assert junk not in tokens


def test_tokens_share_a_root_across_word_forms():
    assert set(bg.similarity_tokens("asesoría jurídica")) & set(bg.similarity_tokens("servicios juridicos"))


def test_only_the_companys_own_words_link_companies(tmp_path):
    """Forma legal, sector y actividad registrada compartidos no conectan; el texto propio sí."""
    companies = []
    for i in range(40):
        extra = {"Servicio que ofrece": f"unica{i:02d}"}
        if i < 4:  # comparten solo campos que no describen la oferta
            extra.update({"Tipo de Empresa": "Cerveceria artesanal", "Sector": "Cerveceria",
                          "Descripción completa": "Cerveceria artesanal registrada"})
        if i in (4, 5):  # comparten texto propio
            extra["Descripción"] = "Cerveceria artesanal"
        companies.append({"id": f"A{i}", "name": f"Empresa {i}", "sector": "Moda", "extra": extra})
    base, sector = write_csvs(tmp_path, companies)
    graph, _ = bg.build_graph(base, sector)
    similar = [(e["a"], e["b"]) for e in graph["edges"] if not e.get("fallback")]
    assert similar == [("A4", "A5")]


def test_other_sector_links_need_more_similarity(monkeypatch):
    texts = ["astronomia astronomia"] * 26 + [f"relleno{i}" for i in range(234)]
    ids = [f"E{i}" for i in range(260)]
    sectors = ["S0" if i % 2 == 0 else "S1" for i in range(26)] + ["Z"] * 234
    edges = bg.build_edges(texts, ids, sectors)
    assert any(sectors[int(e["a"][1:])] != sectors[int(e["b"][1:])] for e in edges)
    monkeypatch.setattr(bg, "MIN_SIMILARITY_CROSS", 1.1)
    edges = bg.build_edges(texts, ids, sectors)
    assert edges and all(sectors[int(e["a"][1:])] == sectors[int(e["b"][1:])] for e in edges)


def test_connections_csv_lists_each_edge_from_both_companies(tmp_path):
    graph = {"nodes": [{"id": "A", "name": "Ana", "sector": "S1"},
                       {"id": "B", "name": "Beto", "sector": "S2"}],
             "edges": [{"a": "A", "b": "B", "w": 0.5}]}
    out = tmp_path / "c.csv"
    bg.write_connections_csv(graph, out)
    table = pd.read_csv(out, encoding="utf-8-sig")
    assert table[["Empresa", "Empresa conectada", "Similitud"]].values.tolist() == [
        ["Ana", "Beto", 0.5], ["Beto", "Ana", 0.5]]
    assert set(table["Validación"]) == {"sin revisar"}


def test_connections_csv_shows_the_validation_verdict(tmp_path):
    graph = {"nodes": [{"id": "A", "name": "Ana", "sector": "S1"},
                       {"id": "B", "name": "Beto", "sector": "S1"},
                       {"id": "C", "name": "Cata", "sector": "S1"}],
             "edges": [{"a": "A", "b": "B", "w": 0.5},
                       {"a": "A", "b": "C", "w": 0, "fallback": True}]}
    out = tmp_path / "c.csv"
    bg.write_connections_csv(graph, out, {("A", "B"): ("dudosa", False)})
    table = pd.read_csv(out, encoding="utf-8-sig")
    verdict = dict(zip(zip(table["Empresa"], table["Empresa conectada"]), table["Validación"]))
    assert verdict[("Ana", "Beto")] == "dudosa"
    assert verdict[("Ana", "Cata")] == "no aplica (respaldo)"


def test_unrelated_companies_have_no_edges():
    texts = [f"unica{i} otra{i}" for i in range(10)]
    assert bg.build_edges(texts, [f"U{i}" for i in range(10)]) == []


# (g) rank
def test_rank_is_relative_completeness_with_id_tiebreak():
    ranks = bg.completeness_ranks({"B": 10, "A": 10, "C": 5, "D": 20})
    assert ranks["D"] == 0
    assert ranks["C"] == 1
    assert ranks["A"] < ranks["B"] < ranks["C"]
    assert all(0 <= r <= 1 for r in ranks.values())


def test_rank_with_single_company_is_zero():
    assert bg.completeness_ranks({"A": 3}) == {"A": 0}


# (h) colores
def test_colors_are_unique_stable_and_not_gray():
    names = [f"Sector {chr(ord('A') + i)}" for i in range(16)][::-1]
    sectors = bg.assign_colors(names)
    assert [s["name"] for s in sectors] == sorted(names)
    colors = [s["color"] for s in sectors]
    assert len(set(colors)) == 16
    assert not set(colors) & bg.GRAYS
    assert bg.assign_colors(names) == sectors


def test_palette_has_distinct_valid_hex_colors():
    assert len(bg.PALETTE) >= 16 and len(set(bg.PALETTE)) == len(bg.PALETTE)
    assert all(len(c) == 7 and c.startswith("#") and int(c[1:], 16) >= 0 for c in bg.PALETTE)


def test_more_sectors_than_colors_fails():
    with pytest.raises(ValueError):
        bg.assign_colors([f"S{i}" for i in range(len(bg.PALETTE) + 1)])


# (i) contrato sobre los datos reales
@pytest.mark.skipif(not (BASE_CSV.exists() and SECTOR_CSV.exists()), reason="faltan los CSV")
def test_real_graph_meets_the_contract(tmp_path):
    graph, stats = bg.build_graph(BASE_CSV, SECTOR_CSV)
    out = tmp_path / "graph.json"
    bg.write_graph(graph, out)
    graph = json.loads(out.read_text(encoding="utf-8"))

    sector_names = [s["name"] for s in graph["sectors"]]
    assert len(sector_names) == 16 and sector_names == sorted(sector_names)
    assert len({s["color"] for s in graph["sectors"]}) == 16

    ids = [n["id"] for n in graph["nodes"]]
    assert len(ids) == len(set(ids)) > 0
    for n in graph["nodes"]:
        assert n["sector"] in sector_names
        assert 0 <= n["rank"] <= 1
        assert n["name"] == n["name"].strip() and bg.is_valid_name(n["name"])
        assert all(isinstance(v, str) and v.strip() for _, v in n["fields"])
        assert not {label for label, _ in n["fields"]} & EXCLUDED_LABELS

    degree = {}
    for e in graph["edges"]:
        assert e["a"] in ids and e["b"] in ids and e["a"] < e["b"]
        for k in (e["a"], e["b"]):
            degree[k] = degree.get(k, 0) + 1
    assert max(degree.values()) <= bg.MAX_DEGREE
    assert len({(e["a"], e["b"]) for e in graph["edges"]}) == len(graph["edges"])
    sector_of = {n["id"]: n["sector"] for n in graph["nodes"]}
    for e in graph["edges"]:
        if e.get("fallback"):  # conexión de respaldo: siempre dentro del mismo sector y sin piso de similitud
            assert sector_of[e["a"]] == sector_of[e["b"]]
            continue
        floor = bg.MIN_SIMILARITY if sector_of[e["a"]] == sector_of[e["b"]] else bg.MIN_SIMILARITY_CROSS
        assert e["w"] >= floor
    assert stats["invalid_names"] == 6


def linked_names(graph, name):
    by_id = {n["id"]: n for n in graph["nodes"]}
    company = next(n for n in graph["nodes"] if n["name"] == name)
    return {by_id[e["b"] if e["a"] == company["id"] else e["a"]]["name"]
            for e in graph["edges"] if company["id"] in (e["a"], e["b"])}


# Casos revisados con datos reales (research D2b): antes se unían por texto que no describe la oferta.
@pytest.mark.skipif(not (BASE_CSV.exists() and SECTOR_CSV.exists()), reason="faltan los CSV")
def test_rachid_style_is_not_linked_through_boilerplate():
    graph, _ = bg.build_graph(BASE_CSV, SECTOR_CSV)
    linked = linked_names(graph, "Rachid Style")
    assert not linked & {"CAVALO SALSAMENTARIA", "All Ferreteria", "Variedades Mailen"}
    assert {"Meuf By Ana Paternina", "Humming"} <= linked


@pytest.mark.skipif(not (BASE_CSV.exists() and SECTOR_CSV.exists()), reason="faltan los CSV")
def test_hepate_links_to_textiles_not_to_generic_commerce():
    graph, _ = bg.build_graph(BASE_CSV, SECTOR_CSV)
    linked = linked_names(graph, "HEPATE")
    assert not linked & {"Smart Process Factory", "Arepa e keso", "Tecno-Fix Sas"}
    assert {"Global Textiles", "Cosas de casa by Cava"} <= linked


def test_wholesale_retail_and_nationality_words_do_not_link_companies():
    tokens = bg.similarity_tokens("Venta al por mayor y al detal de productos colombianos en línea")
    for junk in ("mayor", "detal", "colombi", "linea"):
        assert not any(junk in t for t in tokens)


# Descripciones revisadas a mano de las empresas que quedaban sin conexiones (Descripciones_corregidas.csv)
CORRECTIONS_CSV = ROOT / "Descripciones_corregidas.csv"


@pytest.mark.skipif(not (BASE_CSV.exists() and CORRECTIONS_CSV.exists()), reason="faltan los CSV")
def test_reviewed_descriptions_are_applied_to_the_base():
    corr = pd.read_csv(CORRECTIONS_CSV, encoding="utf-8-sig", dtype=str, keep_default_na=False)
    base = pd.concat([pd.read_csv(p, encoding="utf-8-sig", dtype=str, keep_default_na=False)
                      for p in (BASE_CSV, NEW_CSV) if p.exists()], ignore_index=True)
    assert corr["Eloqua Unique Identifier"].is_unique
    assert set(corr["Eloqua Unique Identifier"]) <= set(base["Eloqua Unique Identifier"])
    applied = base.set_index("Eloqua Unique Identifier").loc[corr["Eloqua Unique Identifier"]]
    assert (applied["Descripción"].values == corr["Descripción"].values).all()


@pytest.mark.skipif(not (BASE_CSV.exists() and SECTOR_CSV.exists()), reason="faltan los CSV")
def test_no_company_is_left_without_connections():
    graph, stats = bg.build_graph(BASE_CSV, SECTOR_CSV)
    assert stats["isolated"] == 0
    assert stats["fallback_edges"] > 0
    assert linked_names(graph, "Hotel El Dorado Plaza")  # solo decía "Hoteleria"


# Filtros por ubicación y tamaño
@pytest.mark.parametrize("row,expected", [
    ({"Ciudad": "Chía", "Departamento": "Cundinamarca", "Tamaño": "Pequeña 1-50 empleados"},
     {"department": "Cundinamarca", "city": "Chía", "size": "Pequeña (1-50 empleados)"}),
    # Bogotá es también departamento: no se mezcla con Cundinamarca aunque la persona lo haya declarado así.
    ({"Ciudad": "Bogotá, D.C.", "Departamento": "Cundinamarca", "Tamaño": "Mediana 50-500 empleados"},
     {"department": "Bogotá, D.C.", "city": "Bogotá, D.C.", "size": "Mediana (50-500 empleados)"}),
    ({"Ciudad": "Bogotá, D.C.", "Departamento": "Bogotá, D.C.", "Tamaño": "Grande más de 500 empleados"},
     {"department": "Bogotá, D.C.", "city": "Bogotá, D.C.", "size": "Grande (más de 500 empleados)"}),
    # Relleno y códigos sin significado documentado no son ubicación ni tamaño.
    ({"Ciudad": "NOINFORMA", "Departamento": "Meta", "Tamaño": "T1"}, {"department": "Meta"}),
    ({"Ciudad": "", "Departamento": "", "Tamaño": "3"}, {}),
    ({"Tamaño": "No informa"}, {}),
])
def test_filter_attributes(row, expected):
    assert bg.filter_attributes(row) == expected


def test_nodes_carry_location_and_size_only_when_they_have_them(tmp_path):
    base, sector = write_csvs(tmp_path, [
        {"id": "A1", "name": "Con datos", "sector": "S", "extra": {"Ciudad": "Chía", "Departamento": "Cundinamarca",
                                                                  "Tamaño": "Pequeña 1-50 empleados"}},
        {"id": "A2", "name": "Sin datos", "sector": "S"},
    ])
    nodes = {n["id"]: n for n in bg.build_graph(base, sector)[0]["nodes"]}
    assert {k for k in nodes["A1"] if k in ("department", "city", "size")} == {"department", "city", "size"}
    assert not {"department", "city", "size"} & set(nodes["A2"])


@pytest.mark.skipif(not (BASE_CSV.exists() and SECTOR_CSV.exists()), reason="faltan los CSV")
def test_real_graph_has_consistent_locations_and_sizes():
    graph, _ = bg.build_graph(BASE_CSV, SECTOR_CSV, extra_csvs=[NEW_CSV])
    nodes = graph["nodes"]
    in_bogota = [n for n in nodes if n.get("city") == bg.BOGOTA]
    assert len(in_bogota) > 300 and all(n["department"] == bg.BOGOTA for n in in_bogota)
    assert not [n for n in nodes if n.get("department") == "Cundinamarca" and n.get("city") == bg.BOGOTA]
    assert {n["size"] for n in nodes if "size" in n} == set(bg.SIZE_LABELS.values())
    assert all("city" not in n or "department" in n for n in nodes), "toda ciudad tiene departamento"


# Empresas nuevas (Graduados_participantes_Sem_Inn_2026_2.xlsx → Emprendedores_nuevos_2026_2_limpia.csv)
def test_extra_bases_are_added_and_missing_ones_ignored(tmp_path):
    base, sector = write_csvs(tmp_path, [{"id": "A1", "name": "Empresa Uno", "sector": "Moda"}])
    extra_dir = tmp_path / "extra"
    extra_dir.mkdir()
    extra, extra_sector = write_csvs(extra_dir, [{"id": "N1", "name": "Empresa Nueva", "sector": "Salud"}])
    # El sector de las nuevas viene del mismo archivo de sectores que el de la base.
    merged = pd.concat([pd.read_csv(sector), pd.read_csv(extra_sector)])
    merged.to_csv(sector, index=False)
    graph, _ = bg.build_graph(base, sector, extra_csvs=[extra, tmp_path / "no_existe.csv"])
    assert {n["id"] for n in graph["nodes"]} == {"A1", "N1"}
    assert {n["id"]: n["sector"] for n in graph["nodes"]} == {"A1": "Moda", "N1": "Salud"}


@pytest.mark.skipif(not (BASE_CSV.exists() and SECTOR_CSV.exists() and VALIDATION_CSV.exists() and NEW_CSV.exists()),
                    reason="faltan los CSV")
def test_new_companies_are_in_the_graph_connected_and_every_similarity_edge_is_reviewed():
    graph, stats = bg.build_graph(BASE_CSV, SECTOR_CSV, VALIDATION_CSV, [NEW_CSV])
    new_ids = set(pd.read_csv(NEW_CSV, dtype=str, encoding="utf-8-sig")["Eloqua Unique Identifier"])
    assert new_ids and new_ids <= {n["id"] for n in graph["nodes"]}
    connected = {k for e in graph["edges"] for k in (e["a"], e["b"])}
    assert new_ids <= connected, "cada empresa nueva tiene al menos una conexión"
    assert stats["isolated"] == 0
    # Ninguna conexión por similitud queda sin revisar: si cambian los datos o el algoritmo, hay que validar las nuevas.
    reviewed = bg.load_validation(VALIDATION_CSV)
    unreviewed = [(e["a"], e["b"]) for e in graph["edges"] if not e.get("fallback") and (e["a"], e["b"]) not in reviewed]
    assert unreviewed == []


# Con la validación aplicada (revisión de las 1.640 conexiones por similitud)
@pytest.mark.skipif(not (BASE_CSV.exists() and SECTOR_CSV.exists() and VALIDATION_CSV.exists()),
                    reason="faltan los CSV")
def test_validated_graph_has_no_rejected_connection_and_no_isolated_company():
    graph, stats = bg.build_graph(BASE_CSV, SECTOR_CSV, VALIDATION_CSV)
    rejected = bg.rejected_pairs(bg.load_validation(VALIDATION_CSV))
    assert stats["rejected_pairs"] == len(rejected) > 0
    assert not {(e["a"], e["b"]) for e in graph["edges"]} & rejected
    assert stats["isolated"] == 0


# Caso que motivó la revisión: Ecodefense (bacteria para aguas residuales) solo se unía con ikigai
# (talleres de relajación) por la palabra "manejo".
@pytest.mark.skipif(not (BASE_CSV.exists() and SECTOR_CSV.exists() and VALIDATION_CSV.exists()),
                    reason="faltan los CSV")
def test_ecodefense_is_not_linked_to_ikigai():
    graph, _ = bg.build_graph(BASE_CSV, SECTOR_CSV, VALIDATION_CSV)
    assert not any(n.lower().startswith("ikigai") for n in linked_names(graph, "Ecodefense"))


# Caso revisado (Agro y medio ambiente): no compartían palabras con su sector y quedaban sin conexión.
@pytest.mark.skipif(not (BASE_CSV.exists() and SECTOR_CSV.exists()), reason="faltan los CSV")
@pytest.mark.parametrize("name", ["Viveroonline Sas"])
def test_isolated_agro_companies_link_to_their_own_sector(name):
    graph, _ = bg.build_graph(BASE_CSV, SECTOR_CSV)
    sector_of = {n["name"]: n["sector"] for n in graph["nodes"]}
    linked = linked_names(graph, name)
    assert 1 <= len(linked) <= bg.MAX_DEGREE
    assert {sector_of[n] for n in linked} == {"Agro y medio ambiente"}


# Validación de conexiones (Conexiones_validadas.csv)
def test_load_validation_and_rejected_pairs(tmp_path):
    path = tmp_path / "v.csv"
    pd.DataFrame([
        {"Id empresa A": "B", "Id empresa B": "A", "Sector A": "S1", "Sector B": "S1", "Veredicto": "mala"},
        {"Id empresa A": "C", "Id empresa B": "D", "Sector A": "S1", "Sector B": "S2", "Veredicto": "dudosa"},
        {"Id empresa A": "E", "Id empresa B": "F", "Sector A": "S1", "Sector B": "S1", "Veredicto": "dudosa"},
        {"Id empresa A": "G", "Id empresa B": "H", "Sector A": "S1", "Sector B": "S2", "Veredicto": "OK"},
    ]).to_csv(path, index=False, encoding="utf-8-sig")
    validation = bg.load_validation(path)
    assert set(validation) == {("A", "B"), ("C", "D"), ("E", "F"), ("G", "H")}, "parejas con a < b"
    # Se quitan las malas y las dudosas entre sectores; las dudosas del mismo sector y las ok se quedan.
    assert bg.rejected_pairs(validation) == {("A", "B"), ("C", "D")}


def test_validation_without_file_rejects_nothing(tmp_path):
    assert bg.load_validation(tmp_path / "no_existe.csv") == {}


def test_rejected_pairs_are_removed_without_refilling_with_unreviewed_edges():
    texts, ids = _grouped_corpus()
    before = bg.build_edges(texts, ids)
    pair = (before[0]["a"], before[0]["b"])
    after = bg.build_edges(texts, ids, rejected={pair})
    assert {(e["a"], e["b"]) for e in after} == {(e["a"], e["b"]) for e in before} - {pair}


# Respaldo por sector (empresas que no comparten palabras con nadie)
def _sector_corpus(isolated=1):
    """10 empresas de S0 con el mismo texto, `isolated` de S0 sin palabras en común y relleno de Z."""
    texts = ["astronomia astronomia"] * 10 + [f"unico{i}" for i in range(isolated)]
    ids = [f"A{i}" for i in range(10)] + [f"L{i}" for i in range(isolated)]
    sectors = ["S0"] * (10 + isolated)
    filler = 120 - len(texts)
    texts += [f"relleno{i}" for i in range(filler)]
    ids += [f"Z{i}" for i in range(filler)]
    sectors += ["Z"] * filler
    return texts, ids, sectors


def test_isolated_company_links_to_the_most_similar_of_its_own_sector():
    texts, ids, sectors = _sector_corpus()
    mine = [e for e in bg.build_edges(texts, ids, sectors) if "L0" in (e["a"], e["b"])]
    assert len(mine) == bg.FALLBACK_LINKS == 3
    for e in mine:
        assert e["fallback"] is True and e["w"] == 0
        other = e["b"] if e["a"] == "L0" else e["a"]
        assert other.startswith("A"), "solo con empresas de su sector"


def test_fallback_ties_go_to_the_most_complete_companies():
    texts, ids, sectors = _sector_corpus()
    ranks = [1 - i / 100 for i in range(10)] + [0.5] + [0.9] * 109  # A9 es la más completa
    mine = [e for e in bg.build_edges(texts, ids, sectors, ranks) if "L0" in (e["a"], e["b"])]
    assert {e["b"] if e["a"] == "L0" else e["a"] for e in mine} == {"A9", "A8", "A7"}


def test_fallback_never_repeats_a_pair_when_a_whole_sector_is_loose():
    # Las tres de S0 no comparten palabras con nadie y no hay ninguna conectada en su sector.
    texts = [f"unico{i}" for i in range(120)]
    ids = [f"E{i:03d}" for i in range(120)]
    sectors = ["S0"] * 3 + [f"Z{i}" for i in range(117)]
    edges = bg.build_edges(texts, ids, sectors)
    pairs = [(e["a"], e["b"]) for e in edges if e["a"] in ("E000", "E001", "E002")]
    assert pairs and len(pairs) == len(set(pairs))
    assert len(edges) == len({(e["a"], e["b"]) for e in edges})
    assert {k for p in pairs for k in p} == {"E000", "E001", "E002"}


def test_fallback_does_not_recreate_rejected_pairs():
    texts, ids, sectors = _sector_corpus()
    ranks = [1 - i / 100 for i in range(10)] + [0.5] + [0.9] * 109
    edges = bg.build_edges(texts, ids, sectors, ranks, rejected={("A9", "L0")})
    mine = {e["b"] if e["a"] == "L0" else e["a"] for e in edges if "L0" in (e["a"], e["b"])}
    assert mine == {"A8", "A7", "A6"}


def test_similarity_edges_are_not_marked_as_fallback():
    texts, ids, sectors = _sector_corpus()
    edges = bg.build_edges(texts, ids, sectors)
    similar = [e for e in edges if e["a"].startswith("A") and e["b"].startswith("A")]
    assert similar and not any(e.get("fallback") for e in similar)


def test_no_fallback_without_sector_information():
    texts, ids, _ = _sector_corpus()
    assert not any("L0" in (e["a"], e["b"]) for e in bg.build_edges(texts, ids))


def test_fallback_never_exceeds_max_degree_and_leaves_no_island():
    texts, ids, sectors = _sector_corpus(isolated=30)
    degree = {}
    for e in bg.build_edges(texts, ids, sectors):
        for k in (e["a"], e["b"]):
            degree[k] = degree.get(k, 0) + 1
    assert max(degree.values()) <= bg.MAX_DEGREE
    # Las 30 empresas sin palabras en común quedan conectadas aunque las 10 originales se llenen.
    assert all(f"L{i}" in degree for i in range(30))


def test_a_sector_with_a_single_company_stays_alone():
    texts, ids, sectors = _sector_corpus()
    sectors[10] = "Solo"
    assert not any("L0" in (e["a"], e["b"]) for e in bg.build_edges(texts, ids, sectors))
