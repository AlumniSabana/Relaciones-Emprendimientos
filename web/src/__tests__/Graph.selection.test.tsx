import { fireEvent, render } from "@testing-library/react";
import { useState } from "react";
import Graph, { type FocusRequest } from "../components/Graph";
import data from "../data/graph.json";
import { buildAdjacency, sectorColors } from "../lib/graph";
import type { Graph as GraphData, Selection } from "../types";

const graph = data as GraphData;
const colors = sectorColors(graph.sectors);
const adjacency = buildAdjacency(graph.edges);
const sectorOf = new Map(graph.nodes.map((n) => [n.id, n.sector]));

function Harness({
  initial = null,
  focus = null,
  data = graph,
}: {
  initial?: Selection;
  focus?: FocusRequest | null;
  data?: GraphData;
}) {
  const [selection, setSelection] = useState<Selection>(initial);
  return <Graph graph={data} selection={selection} onSelect={setSelection} focus={focus} />;
}

const circle = (container: HTMLElement, id: string) =>
  container.querySelector<SVGCircleElement>(`circle[data-id="${id}"]`)!;

// Un nodo con al menos una vecina de otro sector.
const picked = graph.nodes.find((n) =>
  [...(adjacency.get(n.id) ?? [])].some((m) => sectorOf.get(m) !== n.sector),
)!;
const neighbors = [...adjacency.get(picked.id)!];
// Con los datos reales toda empresa tiene conexiones (respaldo por sector): se quitan las de una
// para comprobar cómo se ve una empresa sin ninguna.
const isolated = graph.nodes.find((n) => n.id !== picked.id && !neighbors.includes(n.id))!;
const isolatedGraph: GraphData = {
  ...graph,
  edges: graph.edges.filter((e) => e.a !== isolated.id && e.b !== isolated.id),
};

describe("Graph selection", () => {
  it("starts with every node gray", () => {
    const { container } = render(<Harness />);
    const circles = container.querySelectorAll("circle");
    expect(circles).toHaveLength(graph.nodes.length);
    circles.forEach((c) => expect(c).not.toHaveAttribute("fill"));
    expect(container.querySelector(".dimmed")).toBeNull();
  });

  it("colors the selected node and each neighbor with its own sector color", () => {
    const { container } = render(<Harness />);
    fireEvent.click(circle(container, picked.id));
    expect(circle(container, picked.id)).toHaveAttribute("fill", colors.get(picked.sector));
    for (const id of neighbors) {
      expect(circle(container, id)).toHaveAttribute("fill", colors.get(sectorOf.get(id)!));
    }
  });

  it("leaves the rest gray and dimmed", () => {
    const { container } = render(<Harness />);
    fireEvent.click(circle(container, picked.id));
    const focus = new Set([picked.id, ...neighbors]);
    const others = graph.nodes.filter((n) => !focus.has(n.id));
    expect(others.length).toBeGreaterThan(0);
    for (const n of others) {
      const c = circle(container, n.id);
      expect(c).not.toHaveAttribute("fill");
      expect(c.closest(".dimmed")).not.toBeNull();
    }
    for (const id of focus) expect(circle(container, id).closest(".dimmed")).toBeNull();
  });

  it("colors a company without connections on its own", () => {
    const { container } = render(<Harness data={isolatedGraph} />);
    fireEvent.click(circle(container, isolated.id));
    expect(circle(container, isolated.id)).toHaveAttribute("fill", colors.get(isolated.sector));
    expect(container.querySelectorAll("circle[fill]")).toHaveLength(1);
  });

  it("moves the selection when another node is clicked", () => {
    const { container } = render(<Harness />);
    fireEvent.click(circle(container, picked.id));
    fireEvent.click(circle(container, isolated.id));
    expect(circle(container, isolated.id)).toHaveAttribute("fill");
    expect(circle(container, picked.id)).not.toHaveAttribute("fill");
  });
});

describe("Graph fallback connections", () => {
  it("draws the same-sector-only connections dashed, and no other", () => {
    const { container } = render(<Harness />);
    const expected = graph.edges.filter((e) => e.fallback).length;
    expect(expected).toBeGreaterThan(0);
    expect(container.querySelectorAll("line.fallback")).toHaveLength(expected);
    expect(container.querySelectorAll("line")).toHaveLength(graph.edges.length);
  });
});

describe("Graph sector mode", () => {
  const sector = graph.sectors.find((s) => s.name === "Moda y textiles")!;
  const members = graph.nodes.filter((n) => n.sector === sector.name);
  const inside = graph.edges.filter((e) => sectorOf.get(e.a) === sector.name && sectorOf.get(e.b) === sector.name);

  it("colors every company of the sector and no other", () => {
    const { container } = render(<Harness initial={{ type: "sector", name: sector.name }} />);
    const filled = [...container.querySelectorAll("circle[fill]")];
    expect(filled).toHaveLength(members.length);
    for (const n of members) expect(circle(container, n.id)).toHaveAttribute("fill", sector.color);
  });

  it("dims everything outside the sector", () => {
    const { container } = render(<Harness initial={{ type: "sector", name: sector.name }} />);
    const others = graph.nodes.filter((n) => n.sector !== sector.name);
    expect(others.length).toBeGreaterThan(0);
    for (const n of others) expect(circle(container, n.id).closest(".dimmed")).not.toBeNull();
    for (const n of members) expect(circle(container, n.id).closest(".dimmed")).toBeNull();
  });

  it("highlights only the connections between companies of the sector", () => {
    const { container } = render(<Harness initial={{ type: "sector", name: sector.name }} />);
    const active = [...container.querySelectorAll("line.active")];
    expect(inside.length).toBeGreaterThan(0);
    expect(active).toHaveLength(inside.length);
    active.forEach((l) => expect(l).toHaveAttribute("stroke", sector.color));
  });

  it("highlights no connections for a sector with a single company", () => {
    const single = graph.sectors.find((s) => graph.nodes.filter((n) => n.sector === s.name).length === 1);
    if (!single) return; // los datos reales no tienen sectores de una sola empresa
    const { container } = render(<Harness initial={{ type: "sector", name: single.name }} />);
    expect(container.querySelectorAll("line.active")).toHaveLength(0);
  });

  it("switches to company mode when a company is clicked", () => {
    const { container } = render(<Harness initial={{ type: "sector", name: sector.name }} />);
    const other = graph.nodes.find((n) => n.sector !== sector.name)!;
    fireEvent.click(circle(container, other.id));
    expect(circle(container, other.id)).toHaveAttribute("fill", colors.get(other.sector));
    const stillColored = members.filter((n) => circle(container, n.id).hasAttribute("fill"));
    expect(stillColored.length).toBeLessThan(members.length);
  });

  it("labels with their name the 10 companies with the most information, and no others", () => {
    const { container } = render(<Harness initial={{ type: "sector", name: sector.name }} />);
    const expected = [...members].sort((a, b) => a.rank - b.rank).slice(0, 10).map((n) => n.name);
    const labels = [...container.querySelectorAll("text.label")].map((t) => t.textContent);
    expect(labels).toHaveLength(10);
    expect(labels.sort()).toEqual(expected.map((n) => (n.length > 28 ? `${n.slice(0, 27)}…` : n)).sort());
  });

  it("labels every company when the sector has fewer than 10", () => {
    const small = graph.sectors.find((s) => graph.nodes.filter((n) => n.sector === s.name).length < 10)!;
    const { container } = render(<Harness initial={{ type: "sector", name: small.name }} />);
    expect(container.querySelectorAll("text.label")).toHaveLength(graph.nodes.filter((n) => n.sector === small.name).length);
  });

  it("opens no card for those labels (labels only)", () => {
    const { container } = render(<Harness initial={{ type: "sector", name: sector.name }} />);
    expect(container.querySelector(".card")).toBeNull();
    expect(container.querySelector("circle.selected")).toBeNull();
  });
});

describe("Graph zoom notifications", () => {
  it("reports 1 for the initial fit and more than 1 once it zooms in", () => {
    const onZoom = vi.fn();
    const { rerender } = render(<Graph graph={graph} selection={null} onSelect={() => {}} onZoom={onZoom} />);
    expect(onZoom).toHaveBeenCalledWith(1);
    rerender(<Graph graph={graph} selection={null} onSelect={() => {}} onZoom={onZoom} focus={{ id: picked.id, key: 1 }} />);
    expect(onZoom.mock.lastCall![0]).toBeGreaterThan(1.5);
  });
});

describe("Graph focus request", () => {
  it("centers the requested company and zooms in", () => {
    const { container } = render(<Harness focus={{ id: picked.id, key: 1 }} />);
    const transform = container.querySelector("svg > g")!.getAttribute("transform")!;
    expect(transform).toContain("scale(1.6)");
  });

  it("does not move the view when nothing is requested", () => {
    const { container } = render(<Harness />);
    const transform = container.querySelector("svg > g")!.getAttribute("transform")!;
    expect(transform).not.toContain("scale(1.6)");
  });
});
