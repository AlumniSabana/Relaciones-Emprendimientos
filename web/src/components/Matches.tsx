import { useMemo, useState } from "react";
import matchData from "../data/matches.json";
import { candidatesFor, RELATION_LABEL, type MatchData } from "../lib/matches";
import { search } from "../lib/search";
import type { Graph } from "../types";

const data = matchData as MatchData;
const STORAGE_KEY = "matches-v1";

/** Decisión por empresa: a quién le dijo "me interesa" y a quién "pasar". */
type Decisions = Record<string, { liked: string[]; passed: string[] }>;

function loadDecisions(): Decisions {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "{}") as Decisions;
  } catch {
    return {};
  }
}

function saveDecisions(decisions: Decisions) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(decisions));
  } catch {
    /* sin almacenamiento (ventana privada): las decisiones duran mientras la página esté abierta */
  }
}

interface Props {
  graph: Graph;
  colors: Map<string, string>;
  /** Empresa con la que se abre (la que estaba seleccionada). */
  initialId?: string;
  /** Abre una empresa en el grafo (tarjeta y vista centrada). */
  onShow: (id: string) => void;
  onClose: () => void;
}

/** "Citas" entre emprendimientos: sugiere de a una las empresas que encajan con la elegida. */
export default function Matches({ graph, colors, initialId, onShow, onClose }: Props) {
  const [id, setId] = useState<string | undefined>(initialId);
  const [query, setQuery] = useState("");
  const [decisions, setDecisions] = useState<Decisions>(loadDecisions);
  const byId = useMemo(() => new Map(graph.nodes.map((n) => [n.id, n])), [graph]);
  const me = id ? byId.get(id) : undefined;

  const candidates = useMemo(() => (me ? candidatesFor(me.id, data.matches, new Set(byId.keys())) : []), [me, byId]);
  const mine = (me && decisions[me.id]) || { liked: [], passed: [] };
  const pending = candidates.filter((c) => !mine.liked.includes(c.other) && !mine.passed.includes(c.other));
  const current = pending[0];
  const other = current && byId.get(current.other)!;

  const update = (next: Decisions) => {
    setDecisions(next);
    saveDecisions(next);
  };
  const decide = (kind: "liked" | "passed") => {
    if (me && current) update({ ...decisions, [me.id]: { ...mine, [kind]: [...mine[kind], current.other] } });
  };
  const restart = () => {
    if (!me) return;
    const rest = { ...decisions };
    delete rest[me.id];
    update(rest);
  };

  const results = useMemo(() => search(graph, query, 8).results.filter((r) => r.kind === "company"), [graph, query]);

  return (
    <section className="panel matches" aria-label="Matches">
      <header>
        <h2>Matches entre emprendimientos</h2>
        <button type="button" aria-label="Cerrar matches" onClick={onClose}>
          ×
        </button>
      </header>

      {!me ? (
        <div className="picker">
          <p>Elige tu empresa y te sugerimos con quién podría hacer negocios: proveedores, clientes y alianzas.</p>
          <input
            type="text"
            aria-label="Buscar tu empresa"
            placeholder="Nombre de tu empresa"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <ul>
            {results.map((r) => (
              <li key={r.kind === "company" ? r.id : r.name}>
                <button type="button" onClick={() => r.kind === "company" && setId(r.id)}>
                  {r.name}
                </button>
              </li>
            ))}
          </ul>
          {query.trim() !== "" && results.length === 0 && <p className="empty">Sin resultados</p>}
        </div>
      ) : (
        <div className="deck">
          <div className="me">
            <p>
              Matches para <strong>{me.name}</strong>
            </p>
            {data.offers[me.id]?.summary && <p className="offer">{data.offers[me.id].summary}</p>}
            <button type="button" className="link" onClick={() => setId(undefined)}>
              Cambiar empresa
            </button>
          </div>

          {candidates.length === 0 && <p className="empty">No hay sugerencias para esta empresa en el grafo que se ve.</p>}

          {current && other && (
            <article className="candidate" style={{ borderColor: colors.get(other.sector) }}>
              <p className="progress">
                {candidates.length - pending.length + 1} de {candidates.length}
              </p>
              <h3>{other.name}</h3>
              <p className="sector" style={{ color: colors.get(other.sector) }}>
                {other.sector}
                {other.city ? ` · ${other.city}` : ""}
              </p>
              <p className="badges">
                <span className="badge relation">{RELATION_LABEL[current.rel]}</span>
                <span className={`badge affinity ${current.aff === "Alta" ? "high" : "medium"}`}>
                  Afinidad {current.aff.toLowerCase()}
                </span>
              </p>
              {data.offers[other.id]?.summary && <p className="offer">{data.offers[other.id].summary}</p>}
              <p>
                <strong>Por qué encaja: </strong>
                {current.why}
              </p>
              <p className="check">
                <strong>Antes de avanzar: </strong>
                {current.check}
              </p>
              <div className="actions">
                <button type="button" className="pass" onClick={() => decide("passed")}>
                  Pasar
                </button>
                <button type="button" className="like" onClick={() => decide("liked")}>
                  Me interesa
                </button>
              </div>
              <button type="button" className="link" onClick={() => onShow(other.id)}>
                Ver en el grafo
              </button>
            </article>
          )}

          {!current && candidates.length > 0 && <p className="empty">Ya viste todas las sugerencias.</p>}

          {mine.liked.some((o) => byId.has(o)) && (
            <div className="liked">
              <h3>Te interesan ({mine.liked.filter((o) => byId.has(o)).length})</h3>
              <ul>
                {mine.liked
                  .filter((o) => byId.has(o))
                  .map((o) => (
                    <li key={o}>
                      <button type="button" onClick={() => onShow(o)}>
                        {byId.get(o)!.name}
                      </button>
                    </li>
                  ))}
              </ul>
            </div>
          )}
          {(mine.liked.length > 0 || mine.passed.length > 0) && (
            <button type="button" className="link" onClick={restart}>
              Volver a empezar
            </button>
          )}
        </div>
      )}
    </section>
  );
}
