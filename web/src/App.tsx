import { lazy, Suspense, useCallback, useMemo, useState } from "react";
import Card from "./components/Card";
import Chat from "./components/Chat";
import ConnectionFilters from "./components/ConnectionFilters";
import Filters from "./components/Filters";
import Graph, { type FocusRequest } from "./components/Graph";
import Header from "./components/Header";
import Legend from "./components/Legend";
import LineKey from "./components/LineKey";
import Search from "./components/Search";
import Welcome, { welcomeSeen } from "./components/Welcome";
import data from "./data/graph.json";
import { ALL_NEIGHBORS, connectionsOf, visibleConnections, type NeighborFilter } from "./lib/connections";
import { applyFilter, NO_FILTER, type GraphFilter } from "./lib/filters";
import { countBySector, sectorColors } from "./lib/graph";
import type { Graph as GraphData, Selection } from "./types";

// Los matches pesan bastante y solo se usan al abrir su panel: se descargan entonces.
const Matches = lazy(() => import("./components/Matches"));

const graph = data as GraphData;

/** Panel abierto sobre el grafo: el asistente, o los matches (con la empresa con la que se abrió, si hay). */
type Panel = { type: "chat" } | { type: "matches"; id?: string } | null;

export default function App() {
  const [chosen, setChosen] = useState<Selection>(null);
  const [focus, setFocus] = useState<FocusRequest | null>(null);
  const [filter, setFilter] = useState<GraphFilter>(NO_FILTER);
  const [neighborFilter, setNeighborFilter] = useState<NeighborFilter>(ALL_NEIGHBORS);
  const [panel, setPanel] = useState<Panel>(null);
  const [welcome, setWelcome] = useState(() => !welcomeSeen());

  // Con un filtro de ubicación o tamaño, todo (grafo, búsqueda, leyenda) trabaja solo con esas empresas.
  const shown = useMemo(() => applyFilter(graph, filter), [filter]);
  const byId = useMemo(() => new Map(shown.nodes.map((n) => [n.id, n])), [shown]);
  const colors = useMemo(() => sectorColors(graph.sectors), []);
  const counts = useMemo(() => countBySector(shown.nodes), [shown]);

  // Una empresa elegida que el filtro dejó fuera deja de estar seleccionada.
  const selection = chosen?.type === "company" && !byId.has(chosen.id) ? null : chosen;
  const selected = selection?.type === "company" ? byId.get(selection.id) : undefined;
  const connections = selected ? connectionsOf(selected.id, shown.edges).length : 0;
  const visible = selected ? visibleConnections(selected, shown.edges, byId, neighborFilter).length : 0;

  // Cambiar la selección también quita el filtro de conexiones, que es de la empresa anterior.
  const select = useCallback((next: Selection) => {
    setChosen(next);
    setNeighborFilter(ALL_NEIGHBORS);
  }, []);

  // Elegir una empresa en la búsqueda la deja visible; el click en el grafo no mueve la vista.
  const selectFromSearch = (next: Selection) => {
    select(next);
    if (next?.type === "company") setFocus((f) => ({ id: next.id, key: (f?.key ?? 0) + 1 }));
  };

  const openCompany = (id: string) => selectFromSearch({ type: "company", id });
  const toggle = (next: NonNullable<Panel>) => setPanel((current) => (current?.type === next.type ? null : next));

  return (
    <div className="shell">
      <Header />
      <main className="app">
        <section className="sidebar" aria-label="Búsqueda y sectores">
          <Search graph={shown} onSelect={selectFromSearch} />
          <div className="tools">
            <button type="button" aria-pressed={panel?.type === "chat"} onClick={() => toggle({ type: "chat" })}>
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="M21 12a8 8 0 0 1-11.6 7.1L4 20l1.1-4.4A8 8 0 1 1 21 12z" />
              </svg>
              Preguntar al asistente
            </button>
            <button type="button" aria-pressed={panel?.type === "matches"} onClick={() => toggle({ type: "matches" })}>
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z" />
              </svg>
              Buscar matches
            </button>
          </div>
          <Filters graph={graph} filter={filter} onChange={setFilter} shown={shown.nodes.length} />
          <Legend
            sectors={graph.sectors}
            counts={counts}
            active={selection?.type === "sector" ? selection.name : null}
            onSelect={(name) => select(name ? { type: "sector", name } : null)}
          />
          <LineKey />
          <button type="button" className="help-button" onClick={() => setWelcome(true)}>
            ¿Cómo usar la herramienta?
          </button>
        </section>
        <div className="canvas">
          <Graph graph={shown} selection={selection} onSelect={select} focus={focus} neighborFilter={neighborFilter} />
          {panel?.type === "chat" && (
            <Chat
              graph={shown}
              onShow={(ids) => select({ type: "group", ids })}
              onPick={openCompany}
              onClose={() => setPanel(null)}
            />
          )}
          {panel?.type === "matches" && (
            <Suspense fallback={<p className="panel loading">Cargando matches…</p>}>
              <Matches
                key={panel.id ?? "none"}
                graph={shown}
                colors={colors}
                initialId={panel.id}
                onShow={openCompany}
                onClose={() => setPanel(null)}
              />
            </Suspense>
          )}
          {selected && (
            <Card company={selected} color={colors.get(selected.sector)!} onClose={() => select(null)}>
              <ConnectionFilters
                filter={neighborFilter}
                onChange={setNeighborFilter}
                total={connections}
                shown={visible}
                size={selected.size}
              />
              <button
                type="button"
                className="find-matches"
                onClick={() => setPanel({ type: "matches", id: selected.id })}
              >
                Buscar matches para esta empresa
              </button>
            </Card>
          )}
        </div>
      </main>
      {welcome && <Welcome onClose={() => setWelcome(false)} />}
    </div>
  );
}
