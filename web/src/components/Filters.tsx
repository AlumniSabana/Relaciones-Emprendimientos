import { filterOptions, isFiltering, NO_FILTER, type GraphFilter } from "../lib/filters";
import type { Graph } from "../types";

interface Props {
  graph: Graph;
  filter: GraphFilter;
  onChange: (filter: GraphFilter) => void;
  /** Empresas que quedan con el filtro. */
  shown: number;
}

const LABELS = { department: "Departamento", city: "Ciudad", size: "Tamaño de empresa" } as const;

/** Filtros del grafo completo: ubicación y tamaño. Al elegirlos, el grafo se arma solo con esas empresas. */
export default function Filters({ graph, filter, onChange, shown }: Props) {
  const options = filterOptions(graph, filter);
  const active = isFiltering(filter);

  return (
    <details className="filters">
      <summary>Filtrar el grafo{active ? " (activo)" : ""}</summary>
      {(["department", "city", "size"] as const).map((key) => (
        <label key={key}>
          {LABELS[key]}
          <select
            value={filter[key] ?? ""}
            // Al cambiar de departamento la ciudad elegida puede no pertenecerle: se vuelve a "todas".
            onChange={(e) =>
              onChange({ ...filter, [key]: e.target.value || null, ...(key === "department" ? { city: null } : {}) })
            }
          >
            <option value="">Todos</option>
            {options[key].map(({ value, count }) => (
              <option key={value} value={value}>
                {value} ({count})
              </option>
            ))}
          </select>
        </label>
      ))}
      <p className="shown">
        Mostrando {shown} de {graph.nodes.length} empresas
      </p>
      <button type="button" disabled={!active} onClick={() => onChange(NO_FILTER)}>
        Quitar filtros
      </button>
    </details>
  );
}
