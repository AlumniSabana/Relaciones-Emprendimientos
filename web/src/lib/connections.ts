import type { Company, Edge } from "../types";

/** Filtro de las conexiones de la empresa seleccionada. */
export interface NeighborFilter {
  /** Similitud mínima (0 = todas). Las conexiones de respaldo por sector valen 0 o casi. */
  minCloseness: number;
  sameSize: boolean;
}

export const ALL_NEIGHBORS: NeighborFilter = { minCloseness: 0, sameSize: false };

export const CLOSENESS_LEVELS = [
  { min: 0, label: "Todas" },
  { min: 0.3, label: "Media o más (0,30 o más)" },
  { min: 0.5, label: "Alta (0,50 o más)" },
];

export interface Connection {
  other: string;
  w: number;
}

export function connectionsOf(id: string, edges: Edge[]): Connection[] {
  return edges.flatMap((e) => (e.a === id ? [{ other: e.b, w: e.w }] : e.b === id ? [{ other: e.a, w: e.w }] : []));
}

/** Las conexiones que cumplen el filtro; "mismo tamaño" exige que ambas empresas tengan tamaño y sea igual. */
export function visibleConnections(
  company: Company,
  edges: Edge[],
  byId: Map<string, Company>,
  filter: NeighborFilter,
): Connection[] {
  return connectionsOf(company.id, edges).filter(
    ({ other, w }) =>
      w >= filter.minCloseness &&
      (!filter.sameSize || (company.size !== undefined && byId.get(other)?.size === company.size)),
  );
}
