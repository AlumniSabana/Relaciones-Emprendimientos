import { search } from "../lib/search";
import type { Graph } from "../types";

const graph: Graph = {
  generated: "2026-11-02",
  sectors: [
    { name: "Moda y textiles", color: "#e6194b" },
    { name: "Alimentos y bebidas", color: "#3cb44b" },
  ],
  nodes: [
    { id: "1", name: "Rachid Style", sector: "Moda y textiles", rank: 0, fields: [] },
    { id: "2", name: "Café Moda Bogotá", sector: "Alimentos y bebidas", rank: 0.5, fields: [] },
    { id: "3", name: "La Moda Vintage", sector: "Moda y textiles", rank: 1, fields: [] },
    { id: "4", name: "Moda Express", sector: "Moda y textiles", rank: 1, fields: [] },
  ],
  edges: [],
};

describe("search", () => {
  it("returns nothing for an empty or blank query", () => {
    expect(search(graph, "")).toEqual({ results: [], total: 0 });
    expect(search(graph, "   ")).toEqual({ results: [], total: 0 });
  });

  it("ignores case and accents in both directions", () => {
    expect(search(graph, "CAFE").results.map((r) => r.kind === "company" && r.id)).toEqual(["2"]);
    expect(search(graph, "bogota").total).toBe(1);
    expect(search(graph, "café").total).toBe(1);
  });

  it("finds sectors by name and marks them as sectors", () => {
    expect(search(graph, "alimentos").results).toEqual([{ kind: "sector", name: "Alimentos y bebidas" }]);
  });

  it("lists sectors before companies, and names that start with the text first", () => {
    const { results } = search(graph, "moda");
    expect(results.map((r) => (r.kind === "sector" ? `S:${r.name}` : r.name))).toEqual([
      "S:Moda y textiles",
      "Moda Express",
      "Café Moda Bogotá",
      "La Moda Vintage",
    ]);
  });

  it("limits the results and reports the total", () => {
    const { results, total } = search(graph, "moda", 2);
    expect(results).toHaveLength(2);
    expect(total).toBe(4);
  });

  it("returns no results when nothing matches", () => {
    expect(search(graph, "zzzz")).toEqual({ results: [], total: 0 });
  });
});
