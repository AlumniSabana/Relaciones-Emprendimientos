import { fireEvent, render, screen, within } from "@testing-library/react";
import App from "../App";
import data from "../data/graph.json";
import { connectionsOf } from "../lib/connections";
import type { Graph } from "../types";

const graph = data as Graph;
const byId = new Map(graph.nodes.map((n) => [n.id, n]));
const circle = (container: HTMLElement, id: string) => container.querySelector<SVGCircleElement>(`circle[data-id="${id}"]`)!;
const circles = (container: HTMLElement) => container.querySelectorAll("circle").length;
const choose = (label: string, value: string) => fireEvent.change(screen.getByLabelText(label), { target: { value } });
const colored = (container: HTMLElement) => container.querySelectorAll("circle[fill]").length;

describe("graph filters (location and size)", () => {
  it("builds a new graph with only the companies of the chosen city", () => {
    const { container } = render(<App />);
    expect(circles(container)).toBe(graph.nodes.length);
    choose("Ciudad", "Chía");
    const expected = graph.nodes.filter((n) => n.city === "Chía").length;
    expect(expected).toBeGreaterThan(10);
    expect(circles(container)).toBe(expected);
    expect(screen.getByText(`Mostrando ${expected} de ${graph.nodes.length} empresas`)).toBeInTheDocument();
  });

  it("filters by department, and Bogotá is its own department apart from Cundinamarca", () => {
    const { container } = render(<App />);
    choose("Departamento", "Bogotá, D.C.");
    expect(circles(container)).toBe(graph.nodes.filter((n) => n.department === "Bogotá, D.C.").length);
    choose("Departamento", "Cundinamarca");
    expect(circles(container)).toBe(graph.nodes.filter((n) => n.department === "Cundinamarca").length);
    const cities = within(screen.getByLabelText("Ciudad"));
    expect(cities.queryByRole("option", { name: /^Bogotá/ })).toBeNull();
    expect(cities.getByRole("option", { name: /^Chía/ })).toBeInTheDocument();
  });

  it("filters by size and combines it with the location", () => {
    const { container } = render(<App />);
    const medium = "Mediana (50-500 empleados)";
    choose("Tamaño de empresa", medium);
    expect(circles(container)).toBe(graph.nodes.filter((n) => n.size === medium).length);
    choose("Departamento", "Bogotá, D.C.");
    expect(circles(container)).toBe(graph.nodes.filter((n) => n.size === medium && n.department === "Bogotá, D.C.").length);
  });

  it("makes legend counts follow the filter", () => {
    render(<App />);
    choose("Ciudad", "Chía");
    const total = [...document.querySelectorAll(".legend .count")].reduce((s, c) => s + Number(c.textContent), 0);
    expect(total).toBe(graph.nodes.filter((n) => n.city === "Chía").length);
  });

  it("connects every company of the new graph, because the loose ones get dashed sector links", () => {
    const { container } = render(<App />);
    choose("Ciudad", "Zipaquirá");
    const lines = container.querySelectorAll("line").length;
    expect(lines).toBeGreaterThan(0);
    expect(container.querySelectorAll("line.fallback").length).toBeGreaterThan(0);
  });

  it("restores the full graph with 'Quitar filtros'", () => {
    const { container } = render(<App />);
    choose("Ciudad", "Chía");
    fireEvent.click(screen.getByRole("button", { name: "Quitar filtros" }));
    expect(circles(container)).toBe(graph.nodes.length);
  });

  it("searches only among the companies that are in the graph", () => {
    render(<App />);
    const bogota = graph.nodes.find((n) => n.city === "Bogotá, D.C." && n.name.length > 6)!;
    choose("Ciudad", "Chía");
    fireEvent.change(screen.getByRole("textbox", { name: "Buscar empresa o sector" }), { target: { value: bogota.name } });
    expect(screen.getByText("Sin resultados")).toBeInTheDocument();
  });

  it("unselects a company that the filter leaves out", () => {
    const { container } = render(<App />);
    const bogota = graph.nodes.find((n) => n.city === "Bogotá, D.C.")!;
    fireEvent.click(circle(container, bogota.id));
    expect(screen.getByRole("complementary")).toBeInTheDocument();
    choose("Ciudad", "Chía");
    expect(screen.queryByRole("complementary")).toBeNull();
  });
});

describe("connection filters of the selected company", () => {
  // Una empresa con conexiones de cercanía distinta, y otra con vecinas de otro tamaño o sin él.
  const withMixedCloseness = graph.nodes.find((n) => {
    const w = connectionsOf(n.id, graph.edges).map((c) => c.w);
    return w.some((x) => x >= 0.5) && w.some((x) => x < 0.5);
  })!;
  const withMixedSize = graph.nodes.find((n) => {
    if (!n.size) return false;
    const sizes = connectionsOf(n.id, graph.edges).map((c) => byId.get(c.other)!.size === n.size);
    return sizes.some(Boolean) && sizes.some((s) => !s);
  })!;

  it("starts by showing every connection", () => {
    const { container } = render(<App />);
    fireEvent.click(circle(container, withMixedCloseness.id));
    const total = connectionsOf(withMixedCloseness.id, graph.edges).length;
    expect(screen.getByText(`Mostrando ${total} de ${total} conexiones`)).toBeInTheDocument();
    expect(colored(container)).toBe(total + 1);
  });

  it("keeps only the closest connections highlighted", () => {
    const { container } = render(<App />);
    fireEvent.click(circle(container, withMixedCloseness.id));
    const all = connectionsOf(withMixedCloseness.id, graph.edges);
    const close = all.filter((c) => c.w >= 0.5);
    choose("Cercanía", "0.5");
    expect(screen.getByText(`Mostrando ${close.length} de ${all.length} conexiones`)).toBeInTheDocument();
    expect(colored(container)).toBe(close.length + 1);
    expect(container.querySelectorAll("line.active")).toHaveLength(close.length);
  });

  it("keeps only the connections of the same size", () => {
    const { container } = render(<App />);
    fireEvent.click(circle(container, withMixedSize.id));
    const all = connectionsOf(withMixedSize.id, graph.edges);
    const same = all.filter((c) => byId.get(c.other)!.size === withMixedSize.size);
    fireEvent.click(screen.getByLabelText("Solo del mismo tamaño"));
    expect(screen.getByText(`Mostrando ${same.length} de ${all.length} conexiones`)).toBeInTheDocument();
    expect(colored(container)).toBe(same.length + 1);
  });

  it("forgets the filter when another company is selected", () => {
    const { container } = render(<App />);
    fireEvent.click(circle(container, withMixedCloseness.id));
    choose("Cercanía", "0.5");
    const other = graph.nodes.find((n) => n.id !== withMixedCloseness.id && connectionsOf(n.id, graph.edges).length > 0)!;
    fireEvent.click(circle(container, other.id));
    expect((screen.getByLabelText("Cercanía") as HTMLSelectElement).value).toBe("0");
    const total = connectionsOf(other.id, graph.edges).length;
    expect(screen.getByText(`Mostrando ${total} de ${total} conexiones`)).toBeInTheDocument();
  });

  it("works inside a filtered graph", () => {
    const { container } = render(<App />);
    choose("Departamento", "Bogotá, D.C.");
    const inBogota = graph.nodes.find((n) => n.department === "Bogotá, D.C.")!;
    fireEvent.click(circle(container, inBogota.id));
    choose("Cercanía", "0.5");
    expect(screen.getByText(/Mostrando \d+ de \d+ conexiones/)).toBeInTheDocument();
  });
});
