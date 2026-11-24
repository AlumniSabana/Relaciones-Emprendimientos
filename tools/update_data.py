"""Actualiza la página con un Excel nuevo de emprendedores, de punta a punta.

  uv run --with pandas --with scikit-learn --with openpyxl python tools/update_data.py NUEVO.xlsx
  uv run --with pandas --with scikit-learn --with openpyxl python tools/update_data.py NUEVO.xlsx --dry-run

1. Limpia el Excel (misma hoja y columnas que Graduados_participantes_Sem_Inn_2026_2.xlsx).
2. Deja fuera las empresas que ya están (mismo ID o mismo nombre) y las que no traen descripción.
3. Asigna sector a las nuevas parecidas a las que ya tienen (las más cercanas por texto) y revisa que lo vean.
4. Escribe las filas nuevas al final de Base_emprendedores_2026_2_limpia.csv y de Sector_relacionado_ia.csv.
5. Regenera grafo, conexiones, matches/catálogo del chat y el Excel de resumen, y certifica las relaciones.

Los IDs son PREFIJO + número del Excel (SIE-2026-2-01). El prefijo sale del nombre del archivo
(…_2026_2.xlsx → SIE-2026-2-); si no se puede deducir, se da con --prefix.
"""
import argparse
import csv
import re
import sys
from pathlib import Path

import pandas as pd
from sklearn.feature_extraction.text import TfidfVectorizer

sys.path.insert(0, str(Path(__file__).parent))
import build_graph as bg  # noqa: E402
import build_matches  # noqa: E402
import certify  # noqa: E402
import clean_new_companies as cn  # noqa: E402
import export_excel  # noqa: E402

NEIGHBORS = 5  # empresas parecidas que votan el sector de una nueva
FALLBACK_SECTOR = "Otros servicios"
CONFIDENT = 0.5  # parte de los votos que debe llevar el sector elegido para no pedir revisión


def default_prefix(xlsx):
    m = re.search(r"(\d{4})[_-](\d)(?!\d)", Path(xlsx).stem)
    return f"SIE-{m[1]}-{m[2]}-" if m else None


def known_companies(csvs):
    """IDs y nombres (sin tildes ni mayúsculas) de las empresas que ya están en las bases."""
    table = pd.concat([pd.read_csv(p, dtype=str, keep_default_na=False, encoding="utf-8-sig",
                                   usecols=[bg.ID_COL, bg.NAME_COL]) for p in csvs if Path(p).exists()])
    return set(table[bg.ID_COL].str.strip()), {bg.normalize(n) for n in table[bg.NAME_COL]}


def select_new(participants, prefix, known_ids, known_names):
    """Participantes nuevos (con su ID) y los que se dejan fuera con el motivo."""
    keep, skipped = [], []
    seen = set(known_names)
    for _, p in participants.iterrows():
        id_, name = f"{prefix}{p['No']:02d}", bg.normalize(p["Nombre de empresa"])
        if id_ in known_ids:
            skipped.append((id_, p["Nombre de empresa"], "el ID ya está en la base"))
        elif name in seen:
            skipped.append((id_, p["Nombre de empresa"], "ya hay una empresa con ese nombre"))
        else:
            keep.append(p)
            seen.add(name)
    return pd.DataFrame(keep, columns=participants.columns), skipped


def predict_sectors(new_texts, known_texts, known_sectors):
    """Sector de cada texto nuevo por votación de las empresas conocidas más parecidas: [(sector, seguro)]."""
    if not new_texts:
        return []
    vectorizer = TfidfVectorizer(analyzer=bg.similarity_tokens, sublinear_tf=True)
    try:
        known = vectorizer.fit_transform(known_texts)
    except ValueError:
        return [(FALLBACK_SECTOR, False)] * len(new_texts)
    sims = (vectorizer.transform(new_texts) @ known.T).toarray()
    result = []
    for row in sims:
        votes = {}
        for j in row.argsort()[::-1][:NEIGHBORS]:
            if row[j] > 0:
                votes[known_sectors[j]] = votes.get(known_sectors[j], 0) + row[j]
        if not votes:
            result.append((FALLBACK_SECTOR, False))
            continue
        best = max(votes, key=votes.get)
        result.append((best, votes[best] / sum(votes.values()) >= CONFIDENT))
    return result


def append_rows(path, rows, columns):
    """Agrega filas al final del CSV sin reescribirlo (mismo orden de columnas y fin de línea que el archivo)."""
    path = Path(path)
    raw = path.read_bytes()
    eol = "\r\n" if b"\r\n" in raw else "\n"
    with open(path, "a", encoding="utf-8", newline="") as f:
        if raw and not raw.endswith(b"\n"):
            f.write(eol)
        csv.DictWriter(f, columns, lineterminator=eol, extrasaction="ignore").writerows(rows)


def ingest(xlsx, prefix, dry_run=False, base_csv=bg.BASE_CSV, sector_csv=bg.SECTOR_CSV, extra_csvs=bg.EXTRA_CSVS,
           corrections_csv=cn.CORRECTIONS_CSV, additional_csv=cn.ADDITIONAL_CSV):
    """Suma las empresas nuevas del Excel a las bases. Devuelve {'added': [...], 'skipped': [...], 'review': [...]}."""
    columns = list(pd.read_csv(base_csv, nrows=0, encoding="utf-8-sig").columns)
    participants = cn.read_participants(xlsx)
    known_ids, known_names = known_companies([base_csv, *extra_csvs])
    fresh, skipped = select_new(participants, prefix, known_ids, known_names)

    corrections = {}
    if Path(corrections_csv).exists():
        corrections = pd.read_csv(corrections_csv, dtype=str, keep_default_na=False,
                                  encoding="utf-8-sig").set_index(bg.ID_COL).to_dict("index")
    new_ids = {f"{prefix}{no:02d}" for no in fresh["No"]}
    additional = {k: v for k, v in cn.read_additional(additional_csv).items() if k in new_ids}
    rows = cn.build_new_base(fresh, corrections, {}, columns, additional, prefix) if len(fresh) else pd.DataFrame(columns=columns)
    described = set(rows[bg.ID_COL])
    skipped += [(f"{prefix}{p['No']:02d}", p["Nombre de empresa"], "no trae descripción")
                for _, p in fresh.iterrows() if f"{prefix}{p['No']:02d}" not in described]

    # Sector: por votación de las empresas que ya lo tienen (Sector_relacionado_ia.csv manda sobre cualquier otra fuente).
    known_rows, _ = bg.load_companies(base_csv, sector_csv, extra_csvs)
    guesses = predict_sectors([bg.similarity_text(r) for _, r in rows.iterrows()],
                              [bg.similarity_text(r) for r in known_rows], [r["_sector"] for r in known_rows])
    review = []
    for i, (sector, sure) in zip(rows.index, guesses):
        rows.loc[i, "Sector relacionado"] = sector
        if not sure:
            review.append((rows.loc[i, bg.ID_COL], rows.loc[i, bg.NAME_COL], sector))

    added = [(r[bg.ID_COL], r[bg.NAME_COL], r["Sector relacionado"]) for _, r in rows.iterrows()]
    if not dry_run and len(rows):
        records = rows.astype(object).fillna("").to_dict("records")
        append_rows(base_csv, records, columns)
        append_rows(sector_csv, [{bg.ID_COL: i, bg.NAME_COL: n, bg.SECTOR_COL: s} for i, n, s in added],
                    [bg.ID_COL, bg.NAME_COL, bg.SECTOR_COL])
    return {"added": added, "skipped": skipped, "review": review}


def rebuild():
    """Regenera todo lo que lee la página y certifica las relaciones; devuelve el código de salida de la certificación."""
    bg.main()
    # Los veredictos automáticos de las conexiones nuevas pueden quitar alguna: se regenera para aplicarlas.
    certify.main(["--registrar"])
    bg.main()
    build_matches.main()
    export_excel.main()
    return certify.main([])


def main(argv=None):
    sys.stdout.reconfigure(encoding="utf-8")
    parser = argparse.ArgumentParser(description="Suma un Excel nuevo de emprendedores y actualiza la página.")
    parser.add_argument("xlsx", type=Path)
    parser.add_argument("--prefix", help="prefijo de los IDs nuevos, por ejemplo SIE-2027-1-")
    parser.add_argument("--dry-run", action="store_true", help="muestra qué se agregaría, sin escribir nada")
    args = parser.parse_args(argv)
    prefix = args.prefix or default_prefix(args.xlsx)
    if not prefix:
        parser.error("no pude deducir el prefijo del nombre del archivo: usa --prefix SIE-AAAA-S-")
    result = ingest(args.xlsx, prefix, args.dry_run)
    print(f"Empresas nuevas: {len(result['added'])} | fuera: {len(result['skipped'])}")
    for i, name, sector in result["added"]:
        print(f"  + {i} {name} → {sector}")
    for i, name, why in result["skipped"]:
        print(f"  - {i} {name}: {why}")
    if result["review"]:
        print("Sector asignado sin mucha seguridad (corrígelo en Sector_relacionado_ia.csv y regenera):")
        for i, name, sector in result["review"]:
            print(f"  ? {i} {name} → {sector}")
    if args.dry_run:
        print("Sin cambios (--dry-run).")
        return 0
    if not result["added"]:
        print("No hay empresas nuevas: no se regenera nada.")
        return 0
    return rebuild()


if __name__ == "__main__":
    sys.exit(main())
