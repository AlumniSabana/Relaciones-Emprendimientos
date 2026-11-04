import { computeLayout, layoutRadius } from "../lib/layout";
import type { Company, Edge } from "../types";

function synthetic(n: number) {
  const nodes: Company[] = Array.from({ length: n }, (_, i) => ({
    id: `N${String(i).padStart(3, "0")}`,
    name: `Empresa ${i}`,
    sector: "S",
    rank: i / (n - 1),
    fields: [],
  }));
  // Cada nodo se conecta con los dos siguientes: una cadena con vecinos cercanos.
  const edges: Edge[] = [];
  for (let i = 0; i < n; i++) {
    for (const j of [i + 1, i + 2]) {
      if (j < n) edges.push({ a: nodes[i].id, b: nodes[j].id, w: 0.5 });
    }
  }
  return { nodes, edges };
}

const meanRadius = (ids: string[], layout: Map<string, { x: number; y: number }>) =>
  ids.reduce((sum, id) => {
    const p = layout.get(id)!;
    return sum + Math.hypot(p.x, p.y);
  }, 0) / ids.length;

describe("computeLayout", () => {
  it("places the most complete companies (low rank) closer to the center", () => {
    const { nodes, edges } = synthetic(100);
    const layout = computeLayout(nodes, edges);
    const inner = nodes.slice(0, 20).map((n) => n.id);
    const outer = nodes.slice(80).map((n) => n.id);
    expect(meanRadius(inner, layout)).toBeLessThan(meanRadius(outer, layout));
  });

  it("spreads the companies evenly around the center instead of piling up on one side", () => {
    const { nodes, edges } = synthetic(400);
    // Un solo grupo muy conectado: sin reparto de ángulos se apelmazaría en un lado.
    const hub: Edge[] = nodes.slice(1, 60).map((n) => ({ a: nodes[0].id, b: n.id, w: 0.9 }));
    const layout = computeLayout(nodes, [...edges, ...hub]);
    const octants = Array(8).fill(0);
    for (const p of layout.values()) {
      octants[Math.floor(((Math.atan2(p.y, p.x) + Math.PI) / (2 * Math.PI)) * 8) % 8]++;
    }
    expect(Math.max(...octants) - Math.min(...octants)).toBeLessThanOrEqual(8);
    const cx = [...layout.values()].reduce((s, p) => s + p.x, 0) / layout.size;
    const cy = [...layout.values()].reduce((s, p) => s + p.y, 0) / layout.size;
    expect(Math.hypot(cx, cy)).toBeLessThan(25);
  });

  it("scales the graph with how many companies it has, keeping the same density", () => {
    const radius = (n: number) => {
      const { nodes, edges } = synthetic(n);
      return Math.max(...[...computeLayout(nodes, edges).values()].map((p) => Math.hypot(p.x, p.y)));
    };
    const [few, many] = [radius(40), radius(400)];
    expect(few).toBeLessThan(many / 2);
    expect(layoutRadius(600)).toBeCloseTo(450);
    expect(layoutRadius(1)).toBeGreaterThanOrEqual(60);
  });

  it("returns a finite position for every node", () => {
    const { nodes, edges } = synthetic(60);
    const layout = computeLayout(nodes, edges);
    expect(layout.size).toBe(60);
    for (const p of layout.values()) {
      expect(Number.isFinite(p.x) && Number.isFinite(p.y)).toBe(true);
    }
  });

  it("is deterministic for the same input", () => {
    const { nodes, edges } = synthetic(50);
    expect([...computeLayout(nodes, edges)]).toEqual([...computeLayout(nodes, edges)]);
  });
});
