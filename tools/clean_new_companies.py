"""Limpia el Excel de graduados participantes y lo deja con el esquema de la base de emprendedores.

Lee Graduados_participantes_Sem_Inn_2026_2.xlsx (hoja "Lista graduados participantes"), aplica las
descripciones revisadas a mano de Descripciones_corregidas.csv y escribe
Emprendedores_nuevos_2026_2_limpia.csv, que tools/build_graph.py suma a la base.

El Excel solo trae nombre del emprendimiento, cargo y descripción (no hay NIT, correo ni ubicación),
así que esas columnas quedan vacías. Los nombres de las personas y su programa de grado no se guardan,
igual que el cuaderno Data_relaciones.ipynb descartó Nombres y Apellidos.

Uso: uv run --with pandas --with openpyxl python tools/clean_new_companies.py
"""
import re
import sys
from pathlib import Path

import pandas as pd

ROOT = Path(__file__).resolve().parents[1]
XLSX = ROOT / "Graduados_participantes_Sem_Inn_2026_2.xlsx"
BASE_CSV = ROOT / "Base_emprendedores_2026_2_limpia.csv"
CORRECTIONS_CSV = ROOT / "Descripciones_corregidas.csv"
SECTOR_CSV = ROOT / "Sector_relacionado_ia.csv"
OUT_CSV = ROOT / "Emprendedores_nuevos_2026_2_limpia.csv"
# Datos que el Excel no trae y se aportan a mano por ID (ciudad, departamento, etc.), con columnas de la base.
ADDITIONAL_CSV = ROOT / "Datos_adicionales_nuevas.csv"

SHEET = "Lista graduados participantes"
ID_PREFIX = "SIE-2026-2-"  # Semana de Innovación y Emprendimiento; el Excel no trae el ID de Eloqua
ID_COL = "Eloqua Unique Identifier"
# El Excel escribe "Descrición" (sin p) en el encabezado de la descripción.
HEADERS = {"No.": "No", "Nombre de emprendimiento": "Nombre de empresa", "Cargo": "Cargo",
           "Descrición": "Descripción", "Descripción": "Descripción"}
EMOJI = re.compile("[\U0001F300-\U0001FAFF☀-➿️]")


def clean_text(value):
    """Texto en una sola línea, sin espacios duros, repetidos ni emojis; None si queda vacío."""
    if value is None or (isinstance(value, float) and value != value):
        return None
    text = EMOJI.sub("", str(value)).replace(" ", " ")
    text = re.sub(r"\s+", " ", text).strip()
    return text or None


def read_participants(path):
    """Filas de participantes: No, Nombre de empresa, Cargo, Descripción (ya con texto limpio)."""
    sheet = pd.read_excel(path, sheet_name=SHEET, header=None, dtype=str)
    # La tabla empieza bajo unas filas de título: se busca la fila cuyo primer encabezado es "No.".
    header_row = next((i for i in sheet.index if "No." in sheet.loc[i].astype(str).str.strip().values), None)
    if header_row is None:
        raise ValueError(f'No se encontró la fila de encabezados ("No.") en la hoja "{SHEET}"')
    names = sheet.loc[header_row].map(lambda v: HEADERS.get(str(v).strip()))
    table = sheet.loc[header_row + 1:, names.notna().values]
    table.columns = names.dropna().values
    table = table.map(clean_text)
    table = table.dropna(subset=["Nombre de empresa"]).reset_index(drop=True)
    table["No"] = table["No"].astype(float).astype(int)
    return table[["No", "Nombre de empresa", "Cargo", "Descripción"]]


def full_description(description, service):
    """Misma construcción que el cuaderno: la descripción y, si no la repite, 'Ofrece: servicio'."""
    parts = [description.rstrip(" .;,!") + "."]
    if service and service.lower() not in description.lower():
        parts.append(f"Ofrece: {service.rstrip(' .;,!')}.")
    return " ".join(p[:1].upper() + p[1:] for p in parts)


def build_new_base(participants, corrections, sectors, columns, additional=None):
    """DataFrame con las columnas de la base; solo se llenan las que el Excel (o la revisión) aporta.

    `additional` son datos aportados a mano por ID (por ejemplo la ciudad): {id: {columna: valor}}; solo se
    usan las columnas que existen en la base y los valores con texto, y nunca cambian el ID ni el nombre.
    """
    additional = additional or {}
    known = {f"{ID_PREFIX}{no:02d}" for no in participants["No"]}
    if unknown := set(additional) - known:
        raise ValueError(f"Datos adicionales de empresas que no están en el Excel: {sorted(unknown)}")
    rows = []
    for _, p in participants.iterrows():
        id_ = f"{ID_PREFIX}{p['No']:02d}"
        fix = corrections.get(id_, {})
        # pandas guarda las celdas vacías como NaN (que cuenta como verdadero): clean_text las vuelve None.
        description = clean_text(fix.get("Descripción")) or clean_text(p["Descripción"])
        service = clean_text(fix.get("Servicio que ofrece"))
        if not description:
            continue  # sin descripción no hay con qué compararla (igual que en la base)
        rows.append({
            ID_COL: id_, "Nombre de empresa": p["Nombre de empresa"], "Cargo": clean_text(p["Cargo"]),
            "Servicio que ofrece": service, "Descripción": description,
            "Descripción completa": full_description(description, service),
            "Sector relacionado": sectors.get(id_),
        })
        rows[-1].update({c: clean_text(v) for c, v in additional.get(id_, {}).items()
                         if c in columns and c not in (ID_COL, "Nombre de empresa") and clean_text(v)})
    return pd.DataFrame(rows).reindex(columns=columns)


def read_additional(path):
    """Datos aportados a mano ({id: {columna: valor}}); sin archivo, ninguno."""
    if not Path(path).exists():
        return {}
    return pd.read_csv(path, dtype=str, keep_default_na=False, encoding="utf-8-sig").set_index(ID_COL).to_dict("index")


def main():
    sys.stdout.reconfigure(encoding="utf-8")
    columns = list(pd.read_csv(BASE_CSV, nrows=0, encoding="utf-8-sig").columns)
    corr = pd.read_csv(CORRECTIONS_CSV, dtype=str, keep_default_na=False, encoding="utf-8-sig").set_index(ID_COL)
    sectors = pd.read_csv(SECTOR_CSV, dtype=str, encoding="utf-8-sig").set_index(ID_COL)["Sector relacionado"]
    participants = read_participants(XLSX)
    base = build_new_base(participants, corr.to_dict("index"), sectors.to_dict(), columns,
                          read_additional(ADDITIONAL_CSV))
    base.to_csv(OUT_CSV, index=False, encoding="utf-8-sig", lineterminator="\r\n")
    print(f"Participantes en el Excel: {len(participants)} | empresas escritas: {len(base)}")
    print(f"Con descripción revisada: {base[ID_COL].isin(corr.index).sum()} | sin sector asignado: "
          f"{base['Sector relacionado'].isna().sum()}")
    print(f"Escrito: {OUT_CSV}")


if __name__ == "__main__":
    main()
