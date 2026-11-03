import type { Company, Edge, Sector } from "../types";

export function buildAdjacency(edges: Edge[]): Map<string, Set<string>> {
  const adjacency = new Map<string, Set<string>>();
  const link = (from: string, to: string) => {
    const neighbors = adjacency.get(from) ?? new Set<string>();
    neighbors.add(to);
    adjacency.set(from, neighbors);
  };
  for (const { a, b } of edges) {
    link(a, b);
    link(b, a);
  }
  return adjacency;
}

export function countBySector(nodes: Company[]): Map<string, number> {
  const counts = new Map<string, number>();
  for (const { sector } of nodes) counts.set(sector, (counts.get(sector) ?? 0) + 1);
  return counts;
}

export function sectorColors(sectors: Sector[]): Map<string, string> {
  return new Map(sectors.map((s) => [s.name, s.color]));
}
