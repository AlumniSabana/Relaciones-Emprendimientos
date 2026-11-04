import type { ReactNode } from "react";
import type { Company } from "../types";

interface Props {
  company: Company;
  color: string;
  onClose: () => void;
  /** Controles bajo el encabezado (por ejemplo, el filtro de conexiones). */
  children?: ReactNode;
}

export default function Card({ company, color, onClose, children }: Props) {
  return (
    <aside className="card" style={{ borderColor: color }}>
      <header>
        <div>
          <h2>{company.name}</h2>
          <p className="sector" style={{ color }}>
            {company.sector}
          </p>
        </div>
        <button type="button" aria-label="Cerrar" onClick={onClose}>
          ×
        </button>
      </header>
      {children}
      <dl>
        {company.fields.map(([label, value]) => (
          <div key={label}>
            <dt>{label}</dt>
            <dd>{value}</dd>
          </div>
        ))}
      </dl>
    </aside>
  );
}
