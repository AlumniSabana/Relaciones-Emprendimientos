import type { Company, Edge, Graph } from "../types";

/** Filtro del grafo completo: solo quedan las empresas que cumplen todo lo elegido. */
export interface GraphFilter {
  department: string | null;
  city: string | null;
  size: string | null;
}

export const NO_FILTER: GraphFilter = { department: null, city: null, size: null };

export const isFiltering = (f: GraphFilter) => f.department !== null || f.city !== null || f.size !== null;

const KEYS = ["department", "city", "size"] as const;
type Key = (typeof KEYS)[number];

const matches = (n: Company, f: GraphFilter, skip: Key[] = []) =>
  KEYS.every((k) => skip.includes(k) || f[k] === null || n[k] === f[k]);

// Igual que tools/build_graph.py: cada empresa sin conexiones recibe hasta 3 de su sector, con tope de 10.
const FALLBACK_LINKS = 3;
const MAX_DEGREE = 10;

/** Posición relativa de completitud entre las empresas dadas: 0 la más completa, 1 la menos (desempate por id). */
function rerank(nodes: Company[]): Company[] {
  const order = [...nodes].sort((a, b) => b.fields.length - a.fields.length || (a.id < b.id ? -1 : 1));
  const last = Math.max(order.length - 1, 1);
  const rank = new Map(order.map((n, i) => [n.id, i / last]));
  return nodes.map((n) => ({ ...n, rank: rank.get(n.id)! }));
}

/**
 * Conexiones de respaldo dentro del grupo filtrado: lo que se ve aquí no recalcula similitudes (no hay
 * veredicto para pares nuevos), así que quien se queda sin conexiones se une, con línea punteada, a
 * las empresas más completas de su sector que sí tienen.
 * shortcut: elige por completitud y no por parecido; para elegir por parecido habría que enviar la similitud.
 */
function sectorFallback(nodes: Company[], edges: Edge[]): Edge[] {
  const degree = new Map<string, number>();
  for (const e of edges) {
    degree.set(e.a, (degree.get(e.a) ?? 0) + 1);
    degree.set(e.b, (degree.get(e.b) ?? 0) + 1);
  }
  const isolated = nodes.filter((n) => !degree.has(n.id));
  const connected = new Set(nodes.filter((n) => degree.has(n.id)).map((n) => n.id));
  const added: Edge[] = [];
  const linked = new Set<string>(); // parejas ya unidas: dos empresas sueltas del mismo sector no se repiten
  for (const n of isolated) {
    const peers = nodes.filter((m) => m.id !== n.id && m.sector === n.sector);
    const pool = peers.some((m) => connected.has(m.id)) ? peers.filter((m) => connected.has(m.id)) : peers;
    pool.sort((a, b) => a.rank - b.rank || (a.id < b.id ? -1 : 1));
    for (const m of pool) {
      if ((degree.get(n.id) ?? 0) >= FALLBACK_LINKS) break;
      if ((degree.get(m.id) ?? 0) >= MAX_DEGREE) continue;
      const [a, b] = n.id < m.id ? [n.id, m.id] : [m.id, n.id];
      if (linked.has(`${a}|${b}`)) continue;
      linked.add(`${a}|${b}`);
      added.push({ a, b, w: 0, fallback: true });
      degree.set(n.id, (degree.get(n.id) ?? 0) + 1);
      degree.set(m.id, (degree.get(m.id) ?? 0) + 1);
    }
    connected.add(n.id);
  }
  return added;
}

/** Grafo nuevo con solo las empresas del filtro: sus conexiones entre sí y la completitud recalculada. */
export function applyFilter(graph: Graph, filter: GraphFilter): Graph {
  if (!isFiltering(filter)) return graph;
  const kept = graph.nodes.filter((n) => matches(n, filter));
  const ids = new Set(kept.map((n) => n.id));
  const edges = graph.edges.filter((e) => ids.has(e.a) && ids.has(e.b));
  const nodes = rerank(kept);
  return { ...graph, nodes, edges: [...edges, ...sectorFallback(nodes, edges)] };
}

export interface Option {
  value: string;
  count: number;
}

/**
 * Opciones de cada filtro con cuántas empresas dejaría, contando solo las que cumplen los otros.
 * Los departamentos no dependen de la ciudad elegida: así se puede saltar a otro departamento sin quitarla antes
 * (al cambiar de departamento la ciudad vuelve a "todas").
 */
export function filterOptions(graph: Graph, filter: GraphFilter): Record<Key, Option[]> {
  const result = {} as Record<Key, Option[]>;
  for (const key of KEYS) {
    const skip: Key[] = key === "department" ? ["department", "city"] : [key];
    const counts = new Map<string, number>();
    for (const n of graph.nodes) {
      const value = n[key];
      if (value !== undefined && matches(n, filter, skip)) counts.set(value, (counts.get(value) ?? 0) + 1);
    }
    result[key] = [...counts]
      .map(([value, count]) => ({ value, count }))
      .sort((a, b) => b.count - a.count || a.value.localeCompare(b.value, "es"));
  }
  return result;
}
