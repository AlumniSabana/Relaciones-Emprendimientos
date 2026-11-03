import type { Sector } from "../types";

interface Props {
  sectors: Sector[];
  counts: Map<string, number>;
  active: string | null;
  onSelect: (name: string | null) => void;
}

export default function Legend({ sectors, counts, active, onSelect }: Props) {
  return (
    <ul className="legend" aria-label="Sectores">
      {sectors.map(({ name, color }) => (
        <li key={name}>
          <button
            type="button"
            className={active === name ? "active" : undefined}
            aria-pressed={active === name}
            onClick={() => onSelect(active === name ? null : name)}
          >
            <span className="swatch" style={{ backgroundColor: color }} />
            <span className="name">{name}</span>
            <span className="count">{counts.get(name) ?? 0}</span>
          </button>
        </li>
      ))}
    </ul>
  );
}
