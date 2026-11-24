import { useEffect, useState } from "react";

const SEEN_KEY = "welcome-seen-v1";

/** Si la persona pidió no ver las instrucciones al iniciar. */
export function welcomeSeen(): boolean {
  try {
    return localStorage.getItem(SEEN_KEY) === "1";
  } catch {
    return false;
  }
}

const STEPS: [string, string][] = [
  ["Qué ves", "Cada punto es un emprendimiento de graduados. Una línea continua une empresas que ofrecen cosas parecidas; una línea punteada, empresas que solo comparten sector."],
  ["Moverte", "Arrastra para mover el grafo y usa la rueda del ratón para acercar o alejar."],
  ["Ver una empresa", "Haz clic en un punto: se abre su tarjeta (con su página web como enlace) y se colorean las empresas con las que se parece. En la tarjeta puedes filtrar sus conexiones por cercanía o por mismo tamaño."],
  ["Ver un sector", "Haz clic en un sector de la barra izquierda para resaltar todas sus empresas. Otro clic lo quita."],
  ["Buscar", "Escribe un nombre, un sector o palabras de la descripción (por ejemplo \"pastelería\"). Salen primero las empresas con información más completa."],
  ["Filtrar el grafo", "En \"Filtrar el grafo\" elige departamento, ciudad o tamaño: se arma un grafo nuevo solo con esas empresas."],
  ["Preguntar al asistente", "Pregunta en lenguaje natural, por ejemplo \"emprendimientos de Cajicá que ofrezcan pastelería\": el asistente resalta en el grafo las que encuentra. Es una IA: verifica antes de contactar."],
  ["Buscar matches", "Elige tu empresa y te sugerimos, una a una, con quién podrías hacer negocios (proveedores, clientes, alianzas). Di \"Me interesa\" o \"Pasar\"."],
];

interface Props {
  onClose: () => void;
}

/** Ventana de instrucciones: se abre al iniciar y desde el final de la barra lateral. */
export default function Welcome({ onClose }: Props) {
  const [dontShow, setDontShow] = useState(welcomeSeen());

  const close = () => {
    try {
      if (dontShow) localStorage.setItem(SEEN_KEY, "1");
      else localStorage.removeItem(SEEN_KEY);
    } catch {
      /* sin almacenamiento: se vuelve a mostrar la próxima vez */
    }
    onClose();
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && close();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  return (
    <div className="welcome-backdrop" onClick={close}>
      <div className="welcome" role="dialog" aria-modal="true" aria-labelledby="welcome-title" onClick={(e) => e.stopPropagation()}>
        <h2 id="welcome-title">Cómo usar Emprendedores Alumni</h2>
        <ol>
          {STEPS.map(([title, text]) => (
            <li key={title}>
              <strong>{title}.</strong> {text}
            </li>
          ))}
        </ol>
        <footer>
          <label>
            <input type="checkbox" checked={dontShow} onChange={(e) => setDontShow(e.target.checked)} />
            No mostrar al iniciar
          </label>
          <button type="button" autoFocus onClick={close}>
            Entendido, empezar
          </button>
        </footer>
        <p className="reopen">Puedes volver a abrir esta guía con "¿Cómo usar la herramienta?", al final de la barra izquierda.</p>
      </div>
    </div>
  );
}
