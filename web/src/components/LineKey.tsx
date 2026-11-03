/** Explica los dos tipos de línea del grafo. */
export default function LineKey() {
  return (
    <div className="line-key" aria-label="Tipos de línea">
      <p>
        <svg width="34" height="8" aria-hidden="true">
          <line x1="0" y1="4" x2="34" y2="4" stroke="currentColor" strokeWidth="2" />
        </svg>
        Línea continua: se parecen en lo que ofrecen
      </p>
      <p>
        <svg width="34" height="8" aria-hidden="true">
          <line x1="0" y1="4" x2="34" y2="4" stroke="currentColor" strokeWidth="2" strokeDasharray="3 3" />
        </svg>
        Línea punteada: solo comparten sector
      </p>
    </div>
  );
}
