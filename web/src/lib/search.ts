import type { Company, Graph } from "../types";

/** Fragmento de la descripción donde aparece lo buscado, para mostrarlo bajo el nombre. */
export interface Snippet {
  before: string;
  match: string;
  after: string;
}

export type SearchResult =
  | { kind: "sector"; name: string }
  | { kind: "company"; id: string; name: string; sector: string; via: "name" | "description"; snippet?: Snippet };

// Campos donde se busca "dentro de la descripción".
const DESCRIPTION_FIELDS = ["Descripción completa", "Servicio que ofrece"];
const MIN_WORD = 2; // una sola letra coincidiría con casi todo
const CONTEXT = 40;

const normalize = (text: string) =>
  text.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();

const wordsOf = (text: string) => [...text.matchAll(/[a-z0-9]+/g)];

function descriptionOf(company: Company): string {
  return DESCRIPTION_FIELDS.flatMap((label) => company.fields.filter(([l]) => l === label).map(([, v]) => v)).join(" · ");
}

/** Si cada palabra buscada empieza alguna palabra del texto, devuelve el fragmento de la primera. */
function findInDescription(description: string, tokens: string[]): Snippet | null {
  const normalized = normalize(description);
  const words = wordsOf(normalized);
  const first = tokens.map((t) => words.find((w) => w[0].startsWith(t)));
  if (first.some((w) => !w)) return null;
  const hit = first.reduce((a, b) => (a!.index! <= b!.index! ? a : b))!;
  const start = hit.index!;
  const end = start + tokens[first.indexOf(hit)].length;
  // La normalización conserva el largo; si algún día no fuera así, se muestra sin resaltar.
  if (normalized.length !== description.length) return { before: "", match: "", after: description.slice(0, CONTEXT * 2) };
  const from = Math.max(0, start - CONTEXT);
  const to = Math.min(description.length, end + CONTEXT);
  return {
    before: (from > 0 ? "…" : "") + description.slice(from, start),
    match: description.slice(start, end),
    after: description.slice(end, to) + (to < description.length ? "…" : ""),
  };
}

/**
 * Sectores y empresas que coinciden con el texto, sin distinguir mayúsculas ni tildes.
 * Orden: sectores; empresas cuyo nombre contiene el texto (las que empiezan por él antes); y empresas
 * que tienen todas las palabras al inicio de alguna palabra de su descripción, las más completas
 * primero (`rank` bajo).
 */
export function search(graph: Graph, query: string, limit = 8): { results: SearchResult[]; total: number } {
  const q = normalize(query);
  if (!q) return { results: [], total: 0 };
  const tokens = q.split(/\s+/).filter((t) => t.length >= MIN_WORD);

  const sectors: SearchResult[] = graph.sectors
    .filter((s) => normalize(s.name).includes(q))
    .map((s) => ({ kind: "sector", name: s.name }));

  const byName: { n: Company; startsWith: boolean }[] = [];
  const byDescription: { n: Company; snippet: Snippet }[] = [];
  for (const n of graph.nodes) {
    const name = normalize(n.name);
    if (name.includes(q)) {
      byName.push({ n, startsWith: name.startsWith(q) });
      continue;
    }
    const snippet = tokens.length > 0 ? findInDescription(descriptionOf(n), tokens) : null;
    if (snippet) byDescription.push({ n, snippet });
  }
  byName.sort((a, b) => Number(b.startsWith) - Number(a.startsWith));
  byDescription.sort((a, b) => a.n.rank - b.n.rank);

  const companies: SearchResult[] = [
    ...byName.map(({ n }) => ({ kind: "company" as const, id: n.id, name: n.name, sector: n.sector, via: "name" as const })),
    ...byDescription.map(({ n, snippet }) => ({
      kind: "company" as const, id: n.id, name: n.name, sector: n.sector, via: "description" as const, snippet,
    })),
  ];
  const all = [...sectors, ...companies];
  return { results: all.slice(0, limit), total: all.length };
}
