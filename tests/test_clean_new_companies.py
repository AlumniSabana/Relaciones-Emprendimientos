"""Limpieza del Excel de graduados participantes (tools/clean_new_companies.py)."""
import sys
from pathlib import Path

import pandas as pd
import pytest

openpyxl = pytest.importorskip("openpyxl")

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "tools"))

import clean_new_companies as cn  # noqa: E402

COLUMNS = list(pd.read_csv(ROOT / "Base_emprendedores_2026_2_limpia.csv", nrows=0, encoding="utf-8-sig").columns) \
    if (ROOT / "Base_emprendedores_2026_2_limpia.csv").exists() else ["Eloqua Unique Identifier", "Nombre de empresa",
                                                                       "Cargo", "Descripción", "Descripción completa",
                                                                       "Servicio que ofrece", "Sector relacionado"]


def make_xlsx(path, rows, header=("No.", "Día", "Nombre", "Programa de grado", "Cargo",
                                  "Nombre de emprendimiento", "Descrición")):
    wb = openpyxl.Workbook()
    ws = wb.active
    ws.title = cn.SHEET
    ws["D2"], ws["D3"] = "Alumni Sabana", "Jefatura de Desarrollo Profesional"
    ws["B7"] = "Participantes en la Semana de Innovación y Emprendimiento"
    for j, h in enumerate(header):
        ws.cell(row=8, column=2 + j, value=h)
    for i, r in enumerate(rows):
        for j, v in enumerate(r):
            ws.cell(row=9 + i, column=2 + j, value=v)
    wb.create_sheet("Listas")["B2"] = "Si / No"  # hojas auxiliares: se ignoran
    wb.save(path)


ROWS = [
    (1, "3 de noviembre", "Persona Uno", "Psicología", "Owner & CEO ", "  Café Uno ", "Libras de café,\xa0cacao\n artesanal 🍅"),
    (2, "4 de noviembre", "Persona Dos", "Ingeniería", "CEO", "Dos SAS", None),
    (None, None, None, None, None, None, None),
]


@pytest.mark.parametrize("raw,expected", [
    ("  hola\xa0 mundo \n ", "hola mundo"), ("a\n\n* b", "a * b"), ("Mia 🍅 Cappella", "Mia Cappella"),
    ("", None), ("   ", None), (None, None), (float("nan"), None),
])
def test_clean_text(raw, expected):
    assert cn.clean_text(raw) == expected


def test_read_participants_finds_the_table_below_the_title_rows_and_cleans_it(tmp_path):
    path = tmp_path / "g.xlsx"
    make_xlsx(path, ROWS)
    table = cn.read_participants(path)
    assert list(table.columns) == ["No", "Nombre de empresa", "Cargo", "Descripción"]
    assert table["No"].tolist() == [1, 2], "la fila vacía del final no cuenta"
    assert table.loc[0, "Nombre de empresa"] == "Café Uno"
    assert table.loc[0, "Cargo"] == "Owner & CEO"
    assert table.loc[0, "Descripción"] == "Libras de café, cacao artesanal"
    assert pd.isna(table.loc[1, "Descripción"])


def test_person_names_and_degree_are_not_kept(tmp_path):
    path = tmp_path / "g.xlsx"
    make_xlsx(path, ROWS)
    assert not {"Nombre", "Programa de grado", "Persona"} & set(cn.read_participants(path).columns)


def test_accepts_the_correctly_spelled_description_header(tmp_path):
    path = tmp_path / "g.xlsx"
    make_xlsx(path, ROWS[:1], header=("No.", "Día", "Nombre", "Programa de grado", "Cargo",
                                     "Nombre de emprendimiento", "Descripción"))
    assert cn.read_participants(path).loc[0, "Descripción"].startswith("Libras de café")


def test_missing_table_is_an_error(tmp_path):
    path = tmp_path / "g.xlsx"
    wb = openpyxl.Workbook()
    wb.active.title = cn.SHEET
    wb.save(path)
    with pytest.raises(ValueError, match="No."):
        cn.read_participants(path)


def test_full_description_follows_the_notebook_rules():
    assert cn.full_description("repostería artesanal", None) == "Repostería artesanal."
    assert cn.full_description("Café y tortas.;", "Venta de café") == "Café y tortas. Ofrece: Venta de café."
    # No se repite lo que la descripción ya dice.
    assert cn.full_description("Venta de café y tortas", "venta de café") == "Venta de café y tortas."


def test_build_new_base_uses_corrections_ids_sectors_and_base_schema():
    participants = pd.DataFrame([
        {"No": 1, "Nombre de empresa": "Café Uno", "Cargo": "CEO", "Descripción": "cafe sin tildes"},
        {"No": 2, "Nombre de empresa": "Dos", "Cargo": None, "Descripción": None},   # sin descripción: no entra
        {"No": 3, "Nombre de empresa": "Tres", "Cargo": "Socia", "Descripción": "Algo"},
    ])
    corrections = {"SIE-2026-2-01": {"Descripción": "Café sin tildes.", "Servicio que ofrece": ""}}
    base = cn.build_new_base(participants, corrections, {"SIE-2026-2-01": "Alimentos y bebidas"}, COLUMNS)
    assert list(base.columns) == COLUMNS
    assert base["Eloqua Unique Identifier"].tolist() == ["SIE-2026-2-01", "SIE-2026-2-03"]
    uno = base.iloc[0]
    assert uno["Descripción"] == "Café sin tildes." and uno["Descripción completa"] == "Café sin tildes."
    assert uno["Sector relacionado"] == "Alimentos y bebidas" and uno["Cargo"] == "CEO"
    assert pd.isna(uno["Servicio que ofrece"]) and pd.isna(uno["Dirección de correo electrónico"])
    assert base.iloc[1]["Descripción"] == "Algo", "sin corrección se usa la descripción limpia"


# Archivo real del proyecto
REAL = cn.XLSX
OUT = cn.OUT_CSV


@pytest.mark.skipif(not (REAL.exists() and cn.CORRECTIONS_CSV.exists() and cn.SECTOR_CSV.exists() and OUT.exists()),
                    reason="faltan los archivos")
def test_real_file_has_12_companies_each_reviewed_and_with_a_sector():
    participants = cn.read_participants(REAL)
    assert len(participants) == 12 and participants["Nombre de empresa"].is_unique
    corr = pd.read_csv(cn.CORRECTIONS_CSV, dtype=str, keep_default_na=False, encoding="utf-8-sig").set_index(cn.ID_COL)
    sectors = pd.read_csv(cn.SECTOR_CSV, dtype=str, encoding="utf-8-sig").set_index(cn.ID_COL)["Sector relacionado"]
    built = cn.build_new_base(participants, corr.to_dict("index"), sectors.to_dict(), COLUMNS)
    assert len(built) == 12
    assert built[cn.ID_COL].isin(corr.index).all(), "todas tienen descripción revisada"
    assert built["Sector relacionado"].notna().all()
    for column in ("Descripción", "Descripción completa", "Nombre de empresa"):
        assert not built[column].str.contains(r"[\U0001F300-\U0001FAFF \n]", regex=True).any()


@pytest.mark.skipif(not (REAL.exists() and cn.CORRECTIONS_CSV.exists() and cn.SECTOR_CSV.exists() and OUT.exists()),
                    reason="faltan los archivos")
def test_committed_csv_matches_what_the_script_produces():
    corr = pd.read_csv(cn.CORRECTIONS_CSV, dtype=str, keep_default_na=False, encoding="utf-8-sig").set_index(cn.ID_COL)
    sectors = pd.read_csv(cn.SECTOR_CSV, dtype=str, encoding="utf-8-sig").set_index(cn.ID_COL)["Sector relacionado"]
    built = cn.build_new_base(cn.read_participants(REAL), corr.to_dict("index"), sectors.to_dict(), COLUMNS)
    saved = pd.read_csv(OUT, dtype=str, encoding="utf-8-sig")
    # Las celdas vacías son None al construir y NaN al leer el CSV: se comparan como texto vacío.
    pd.testing.assert_frame_equal(built.astype(object).fillna("").astype(str).reset_index(drop=True),
                                  saved.astype(object).fillna("").astype(str), check_dtype=False)
