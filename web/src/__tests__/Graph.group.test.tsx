import { render } from "@testing-library/react";
import Graph from "../components/Graph";
import data from "../data/graph.json";
import { sectorColors } from "../lib/graph";
import type { Graph as GraphData } from "../types";

const graph = data as GraphData;
const colors = sectorColors(graph.sectors);
const circle = (container: HTMLElement, id: string) => container.querySelector<SVGCircleElement>(`circle[data-id="${id}"]`)!;

describe("Graph with a group selected (answer of the assistant)", () => {
  const members = graph.nodes.slice(0, 3);
  const ids = members.map((n) => n.id);
  const others = graph.nodes.slice(3);

  it("colors and labels the group by sector and leaves the rest gray and dimmed", () => {
    const { container } = render(<Graph graph={graph} selection={{ type: "group", ids }} onSelect={() => {}} />);
    for (const n of members) {
      expect(circle(container, n.id).getAttribute("fill")).toBe(colors.get(n.sector));
      expect(circle(container, n.id).closest(".dimmed")).toBeNull();
    }
    for (const n of others.slice(0, 20)) {
      expect(circle(container, n.id).getAttribute("fill")).toBeNull();
      expect(circle(container, n.id).closest(".dimmed")).not.toBeNull();
    }
    expect([...container.querySelectorAll("text.label")].map((t) => t.textContent)).toEqual(
      expect.arrayContaining(members.map((n) => (n.name.length > 28 ? `${n.name.slice(0, 27)}…` : n.name))),
    );
  });

  it("ignores ids that are not in the graph that is shown", () => {
    const { container } = render(<Graph graph={graph} selection={{ type: "group", ids: ["no-existe", ids[0]] }} onSelect={() => {}} />);
    expect(container.querySelectorAll(".focus circle")).toHaveLength(1);
  });
});
