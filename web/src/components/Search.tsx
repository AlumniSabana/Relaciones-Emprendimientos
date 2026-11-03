import { useMemo, useState } from "react";
import { search, type SearchResult } from "../lib/search";
import type { Graph, Selection } from "../types";

const LIMIT = 8;

interface Props {
  graph: Graph;
  onSelect: (selection: Selection) => void;
}

export default function Search({ graph, onSelect }: Props) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const { results, total } = useMemo(() => search(graph, query, LIMIT), [graph, query]);
  const searching = open && query.trim() !== "";

  const choose = (result: SearchResult) => {
    onSelect(result.kind === "sector" ? { type: "sector", name: result.name } : { type: "company", id: result.id });
    setQuery(result.name);
    setOpen(false);
  };
  const clear = () => {
    setQuery("");
    setOpen(false);
  };

  return (
    <div className="search">
      <input
        type="text"
        aria-label="Buscar empresa o sector"
        placeholder="Buscar empresa, sector o palabras"
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={(e) => {
          if (e.key === "Escape") clear();
          if (e.key === "Enter" && results[0]) choose(results[0]);
        }}
      />
      {query && (
        <button type="button" className="clear" aria-label="Limpiar búsqueda" onClick={clear}>
          ×
        </button>
      )}
      {searching &&
        (results.length > 0 ? (
          <ul className="results">
            {results.map((r) => (
              <li key={r.kind === "sector" ? `s-${r.name}` : r.id}>
                <button type="button" onClick={() => choose(r)}>
                  <span className="result-line">
                    <span className="result-name">{r.name}</span>
                    <span className={`tag ${r.kind}`}>{r.kind === "sector" ? "Sector" : "Empresa"}</span>
                  </span>
                  {r.kind === "company" && r.snippet && (
                    <span className="snippet">
                      {r.snippet.before}
                      <mark>{r.snippet.match}</mark>
                      {r.snippet.after}
                    </span>
                  )}
                </button>
              </li>
            ))}
            {total > results.length && (
              <li className="more">y {total - results.length} más (primero las de información más completa): sigue escribiendo</li>
            )}
          </ul>
        ) : (
          <p className="results empty">Sin resultados</p>
        ))}
    </div>
  );
}
