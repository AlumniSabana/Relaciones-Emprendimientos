export interface Sector {
  name: string;
  color: string;
}

export interface Company {
  id: string;
  name: string;
  sector: string;
  rank: number;
  fields: [string, string][];
  /** Para los filtros; solo están si la empresa tiene el dato. */
  department?: string;
  city?: string;
  size?: string;
  /** La tarjeta muestra su página web como texto, sin enlace (Paginas_sin_enlace.csv). */
  nolink?: boolean;
}

export interface Edge {
  a: string;
  b: string;
  w: number;
  /** Presente (true) en las conexiones de respaldo por sector, que no alcanzaron el umbral de similitud. */
  fallback?: boolean;
}

/** Lo que está seleccionado en la app: una empresa, un sector o nada. */
export type Selection = { type: "company"; id: string } | { type: "sector"; name: string } | null;

export interface Graph {
  generated: string;
  sectors: Sector[];
  nodes: Company[];
  edges: Edge[];
}
