import { useEffect, useRef, useState, type FormEvent } from "react";
import type { Graph } from "../types";

interface Turn {
  role: "user" | "assistant";
  text: string;
  /** Empresas que el asistente encontró (solo las que están en el grafo que se ve). */
  ids?: string[];
  failed?: boolean;
}

interface Props {
  graph: Graph;
  /** Deja en primer plano, en el grafo, las empresas de una respuesta. */
  onShow: (ids: string[]) => void;
  /** Abre una empresa de la lista (tarjeta y vista centrada). */
  onPick: (id: string) => void;
  onClose: () => void;
}

const EXAMPLES = [
  "Emprendimientos de Cajicá que ofrezcan pastelería",
  "Empresas de marketing en Bogotá",
  "¿Quién puede hacer empaques para alimentos?",
];
const HISTORY = 8; // mensajes previos que se envían como contexto

export default function Chat({ graph, onShow, onPick, onClose }: Props) {
  const [turns, setTurns] = useState<Turn[]>([]);
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(false);
  const bottom = useRef<HTMLDivElement>(null);
  const byId = new Map(graph.nodes.map((n) => [n.id, n]));

  useEffect(() => {
    bottom.current?.scrollIntoView?.({ block: "end" });
  }, [turns, loading]);

  const ask = async (question: string) => {
    const asked = question.trim();
    if (!asked || loading) return;
    const history: Turn[] = [...turns, { role: "user", text: asked }];
    setTurns(history);
    setText("");
    setLoading(true);
    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: history.slice(-HISTORY).map(({ role, text }) => ({ role, text })) }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || typeof data.answer !== "string") throw new Error(data.error ?? "Error");
      const ids = (data.ids as string[]).filter((id) => byId.has(id));
      setTurns([...history, { role: "assistant", text: data.answer, ids }]);
      if (ids.length) onShow(ids);
    } catch (error) {
      const reason = error instanceof Error && error.message !== "Error" ? error.message : "No pude responder. Intenta de nuevo.";
      setTurns([...history, { role: "assistant", text: reason, failed: true }]);
    } finally {
      setLoading(false);
    }
  };

  const submit = (e: FormEvent) => {
    e.preventDefault();
    void ask(text);
  };

  return (
    <section className="panel chat" aria-label="Asistente">
      <header>
        <h2>Pregúntale al asistente</h2>
        <button type="button" aria-label="Cerrar asistente" onClick={onClose}>
          ×
        </button>
      </header>
      <div className="messages" role="log" aria-live="polite">
        {turns.length === 0 && (
          <div className="intro">
            <p>Pregunta en lenguaje natural por las empresas del grafo. Las que encuentre se resaltan en el grafo.</p>
            {EXAMPLES.map((example) => (
              <button key={example} type="button" className="example" onClick={() => void ask(example)}>
                {example}
              </button>
            ))}
          </div>
        )}
        {turns.map((turn, i) => (
          <div key={i} className={`turn ${turn.role}${turn.failed ? " failed" : ""}`}>
            <p>{turn.text}</p>
            {turn.ids && turn.ids.length > 0 && (
              <ul>
                {turn.ids.map((id) => {
                  const company = byId.get(id)!;
                  return (
                    <li key={id}>
                      <button type="button" onClick={() => onPick(id)}>
                        <span className="name">{company.name}</span>
                        <span className="meta">{[company.city, company.sector].filter(Boolean).join(" · ")}</span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        ))}
        {loading && <p className="turn assistant pending">Buscando…</p>}
        <div ref={bottom} />
      </div>
      <form onSubmit={submit}>
        <input
          type="text"
          aria-label="Tu pregunta"
          placeholder="Ej.: empresas de Cajicá que ofrezcan pastelería"
          maxLength={600}
          value={text}
          onChange={(e) => setText(e.target.value)}
        />
        <button type="submit" disabled={loading || !text.trim()}>
          Enviar
        </button>
      </form>
      <p className="disclaimer">Respuestas generadas por IA a partir de los datos del grafo: verifícalas antes de contactar.</p>
    </section>
  );
}
