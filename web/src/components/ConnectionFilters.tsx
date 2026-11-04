import { CLOSENESS_LEVELS, type NeighborFilter } from "../lib/connections";

interface Props {
  filter: NeighborFilter;
  onChange: (filter: NeighborFilter) => void;
  total: number;
  shown: number;
  /** Tamaño de la empresa seleccionada; sin él no se puede filtrar por mismo tamaño. */
  size?: string;
}

/** Filtros de las conexiones de la empresa seleccionada: cercanía y mismo tamaño. */
export default function ConnectionFilters({ filter, onChange, total, shown, size }: Props) {
  return (
    <section className="connection-filters" aria-label="Filtrar conexiones">
      <p className="shown">
        Mostrando {shown} de {total} conexiones
      </p>
      <label>
        Cercanía
        <select
          value={String(filter.minCloseness)}
          onChange={(e) => onChange({ ...filter, minCloseness: Number(e.target.value) })}
        >
          {CLOSENESS_LEVELS.map(({ min, label }) => (
            <option key={min} value={String(min)}>
              {label}
            </option>
          ))}
        </select>
      </label>
      <label className="check">
        <input
          type="checkbox"
          checked={filter.sameSize}
          disabled={size === undefined}
          onChange={(e) => onChange({ ...filter, sameSize: e.target.checked })}
        />
        Solo del mismo tamaño
      </label>
      {size === undefined && <p className="hint">Esta empresa no tiene el tamaño registrado.</p>}
      {size !== undefined && <p className="hint">Tamaño: {size}</p>}
    </section>
  );
}
