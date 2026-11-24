"""Pipeline de un Excel nuevo (tools/update_data.py): lo que entra, lo que se deja fuera y cómo se escribe."""
import sys
from pathlib import Path

import pandas as pd
import pytest

pytest.importorskip("openpyxl")

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "tools"))
sys.path.insert(0, str(ROOT / "tests"))

import build_graph as bg  # noqa: E402
import update_data as ud  # noqa: E402
from test_clean_new_companies import make_xlsx  # noqa: E402

COLUMNS = list(pd.read_csv(ROOT / "Base_emprendedores_2026_2_limpia.csv", nrows=0, encoding="utf-8-sig").columns)
FOOD = "Pasteles artesanales y postres para eventos"
SOFT = "Desarrollo de software contable para pymes"


def write_base(path, companies):
    rows = [{**{c: "" for c in COLUMNS}, bg.ID_COL: i, bg.NAME_COL: n, "Descripción": d, "Servicio que ofrece": d}
            for i, n, d, _ in companies]
    pd.DataFrame(rows, columns=COLUMNS).to_csv(path, index=False, encoding="utf-8-sig", lineterminator="\r\n")


def write_sectors(path, companies):
    pd.DataFrame([{bg.ID_COL: i, bg.NAME_COL: n, bg.SECTOR_COL: s} for i, n, _, s in companies]).to_csv(
        path, index=False, encoding="utf-8-sig", lineterminator="\r\n")


@pytest.fixture
def world(tmp_path):
    known = [("K1", "Dulces Uno", FOOD, "Alimentos y bebidas"), ("K2", "Postres Dos", FOOD + " premium", "Alimentos y bebidas"),
             ("K3", "Soft Tres", SOFT, "Tecnología y software"), ("K4", "Soft Cuatro", SOFT + " y nube", "Tecnología y software")]
    paths = {"base_csv": tmp_path / "base.csv", "sector_csv": tmp_path / "sector.csv", "extra_csvs": [],
             "corrections_csv": tmp_path / "none1.csv", "additional_csv": tmp_path / "none2.csv"}
    write_base(paths["base_csv"], known)
    write_sectors(paths["sector_csv"], known)
    xlsx = tmp_path / "Nuevos_2027_1.xlsx"
    make_xlsx(xlsx, [(1, "d", "P", "x", "CEO", "Tortas Cinco", "Tortas y pasteles artesanales para fiestas"),
                     (2, "d", "P", "x", "CEO", "Contables Seis", "Software contable en la nube para pymes"),
                     (3, "d", "P", "x", "CEO", "dulces uno", "Otra vez los mismos dulces"),
                     (4, "d", "P", "x", "CEO", "Sin Texto", None)])
    return paths, xlsx


def test_the_prefix_comes_from_the_file_name():
    assert ud.default_prefix("Graduados_participantes_Sem_Inn_2026_2.xlsx") == "SIE-2026-2-"
    assert ud.default_prefix("nuevos-2027-1.xlsx") == "SIE-2027-1-"
    assert ud.default_prefix("emprendedores.xlsx") is None


def test_known_ids_and_repeated_names_stay_out(tmp_path):
    participants = pd.DataFrame({"No": [1, 2, 3], "Nombre de empresa": ["Café Uno", "CAFÉ UNO", "Otra"],
                                 "Cargo": [None] * 3, "Descripción": ["a", "b", "c"]})
    fresh, skipped = ud.select_new(participants, "P-", {"P-03"}, {"otra x"})
    assert fresh["Nombre de empresa"].tolist() == ["Café Uno"]
    assert [(i, why) for i, _, why in skipped] == [("P-02", "ya hay una empresa con ese nombre"), ("P-03", "el ID ya está en la base")]


def test_sector_is_voted_by_the_most_similar_known_companies():
    known = [FOOD, FOOD + " premium", SOFT, SOFT + " y nube"]
    sectors = ["Alimentos y bebidas"] * 2 + ["Tecnología y software"] * 2
    result = ud.predict_sectors(["Tortas y pasteles artesanales para fiestas", "astronomía amateur"], known, sectors)
    assert result == [("Alimentos y bebidas", True), (ud.FALLBACK_SECTOR, False)]
    assert ud.predict_sectors([], known, sectors) == []


def test_append_keeps_the_file_and_its_line_endings(tmp_path):
    path = tmp_path / "a.csv"
    original = "﻿a,b\r\n1,2\r\n".encode("utf-8")
    path.write_bytes(original)
    ud.append_rows(path, [{"a": "x", "b": "y,z"}], ["a", "b"])
    assert path.read_bytes() == original + b'x,"y,z"\r\n'
    path.write_bytes(b"a,b\n1,2")  # sin salto final y con \n
    ud.append_rows(path, [{"a": "x", "b": "y"}], ["a", "b"])
    assert path.read_bytes() == b"a,b\n1,2\nx,y\n"


def test_ingest_adds_new_companies_with_their_sector_and_skips_the_rest(world):
    paths, xlsx = world
    before = paths["base_csv"].read_bytes()
    result = ud.ingest(xlsx, "SIE-2027-1-", **paths)
    assert [(i, n, s) for i, n, s in result["added"]] == [
        ("SIE-2027-1-01", "Tortas Cinco", "Alimentos y bebidas"), ("SIE-2027-1-02", "Contables Seis", "Tecnología y software")]
    assert {(n, why) for _, n, why in result["skipped"]} == {("dulces uno", "ya hay una empresa con ese nombre"), ("Sin Texto", "no trae descripción")}
    assert result["review"] == []
    base = pd.read_csv(paths["base_csv"], dtype=str, keep_default_na=False, encoding="utf-8-sig")
    assert paths["base_csv"].read_bytes().startswith(before)  # lo anterior queda tal cual
    assert base[bg.NAME_COL].tolist()[-2:] == ["Tortas Cinco", "Contables Seis"]
    assert base["Sector relacionado"].tolist()[-2:] == ["Alimentos y bebidas", "Tecnología y software"]
    assert "Descripción completa" in base.columns and base["Descripción completa"].iloc[-2].endswith(".")
    sectors = pd.read_csv(paths["sector_csv"], dtype=str, encoding="utf-8-sig")
    assert sectors[bg.ID_COL].tolist()[-2:] == ["SIE-2027-1-01", "SIE-2027-1-02"]
    # Con lo escrito, el grafo ya reconoce a las nuevas.
    rows, _ = bg.load_companies(paths["base_csv"], paths["sector_csv"])
    assert {"Tortas Cinco", "Contables Seis"} <= {r[bg.NAME_COL] for r in rows}


def test_running_the_same_excel_twice_adds_nothing_the_second_time(world):
    paths, xlsx = world
    ud.ingest(xlsx, "SIE-2027-1-", **paths)
    snapshot = paths["base_csv"].read_bytes(), paths["sector_csv"].read_bytes()
    again = ud.ingest(xlsx, "SIE-2027-1-", **paths)
    assert again["added"] == []
    assert (paths["base_csv"].read_bytes(), paths["sector_csv"].read_bytes()) == snapshot


def test_dry_run_writes_nothing(world):
    paths, xlsx = world
    before = paths["base_csv"].read_bytes(), paths["sector_csv"].read_bytes()
    result = ud.ingest(xlsx, "SIE-2027-1-", dry_run=True, **paths)
    assert len(result["added"]) == 2
    assert (paths["base_csv"].read_bytes(), paths["sector_csv"].read_bytes()) == before


def test_manual_corrections_and_extra_data_apply_to_new_companies_only(world, tmp_path):
    paths, xlsx = world
    pd.DataFrame([{bg.ID_COL: "SIE-2027-1-01", "Descripción": "Descripción revisada de tortas", "Servicio que ofrece": "Tortas"}]
                 ).to_csv(paths["corrections_csv"], index=False, encoding="utf-8-sig")
    pd.DataFrame([{bg.ID_COL: "SIE-2027-1-01", "Ciudad": "Cajicá"}, {bg.ID_COL: "OTRA-99", "Ciudad": "Cali"}]
                 ).to_csv(paths["additional_csv"], index=False, encoding="utf-8-sig")
    ud.ingest(xlsx, "SIE-2027-1-", **paths)
    base = pd.read_csv(paths["base_csv"], dtype=str, keep_default_na=False, encoding="utf-8-sig").set_index(bg.ID_COL)
    assert base.loc["SIE-2027-1-01", "Descripción"] == "Descripción revisada de tortas"
    assert base.loc["SIE-2027-1-01", "Servicio que ofrece"] == "Tortas"
    assert base.loc["SIE-2027-1-01", "Ciudad"] == "Cajicá"
