import { useMemo, useState } from "react";
import Card from "./components/Card";
import Graph, { type FocusRequest } from "./components/Graph";
import Legend from "./components/Legend";
import LineKey from "./components/LineKey";
import Search from "./components/Search";
import data from "./data/graph.json";
import { countBySector, sectorColors } from "./lib/graph";
import type { Graph as GraphData, Selection } from "./types";

const graph = data as GraphData;

export default function App() {
  const [selection, setSelection] = useState<Selection>(null);
  const [focus, setFocus] = useState<FocusRequest | null>(null);
  const colors = useMemo(() => sectorColors(graph.sectors), []);
  const counts = useMemo(() => countBySector(graph.nodes), []);
  const selected = selection?.type === "company" ? graph.nodes.find((n) => n.id === selection.id) : undefined;

  // Elegir una empresa en la búsqueda la deja visible; el click en el grafo no mueve la vista.
  const selectFromSearch = (next: Selection) => {
    setSelection(next);
    if (next?.type === "company") setFocus((f) => ({ id: next.id, key: (f?.key ?? 0) + 1 }));
  };

  return (
    <main className="app">
      <section className="sidebar" aria-label="Búsqueda y sectores">
        <Search graph={graph} onSelect={selectFromSearch} />
        <Legend
          sectors={graph.sectors}
          counts={counts}
          active={selection?.type === "sector" ? selection.name : null}
          onSelect={(name) => setSelection(name ? { type: "sector", name } : null)}
        />
        <LineKey />
      </section>
      <div className="canvas">
        <Graph graph={graph} selection={selection} onSelect={setSelection} focus={focus} />
        {selected && (
          <Card company={selected} color={colors.get(selected.sector)!} onClose={() => setSelection(null)} />
        )}
      </div>
    </main>
  );
}
