/** Matches complementarios entre empresas (web/src/data/matches.json, generado por tools/build_matches.py). */
export type Relation = "Proveedor" | "Posible cliente" | "Alianza comercial";
export type Affinity = "Alta" | "Media";

export interface MatchRow {
  id: string;
  /** Empresa para la que se hizo la sugerencia y empresa sugerida. `rel` se lee desde `a`. */
  a: string;
  b: string;
  rel: Relation;
  aff: Affinity;
  why: string;
  check: string;
}
export interface Offer {
  summary?: string;
  nature?: string;
  category?: string;
}
export interface MatchData {
  offers: Record<string, Offer>;
  matches: MatchRow[];
}

/** Una empresa sugerida vista desde la empresa que busca match. */
export interface Candidate {
  other: string;
  rel: Relation;
  aff: Affinity;
  why: string;
  check: string;
}

// Si B podría ser proveedor de A, A podría ser cliente de B.
const INVERSE: Record<Relation, Relation> = {
  Proveedor: "Posible cliente",
  "Posible cliente": "Proveedor",
  "Alianza comercial": "Alianza comercial",
};

export const RELATION_LABEL: Record<Relation, string> = {
  Proveedor: "Podría ser tu proveedor",
  "Posible cliente": "Podría ser tu cliente",
  "Alianza comercial": "Posible alianza comercial",
};

/** Empresas que encajan con `id` (las que él tiene como origen y las que lo tienen a él), las de afinidad alta primero. */
export function candidatesFor(id: string, matches: MatchRow[], available?: Set<string>): Candidate[] {
  const best = new Map<string, Candidate>();
  for (const m of matches) {
    if (m.a !== id && m.b !== id) continue;
    const mine = m.a === id;
    const other = mine ? m.b : m.a;
    if (available && !available.has(other)) continue;
    const candidate: Candidate = { other, rel: mine ? m.rel : INVERSE[m.rel], aff: m.aff, why: m.why, check: m.check };
    const current = best.get(other);
    if (!current || (current.aff === "Media" && candidate.aff === "Alta")) best.set(other, candidate);
  }
  return [...best.values()].sort((x, y) => Number(y.aff === "Alta") - Number(x.aff === "Alta"));
}
