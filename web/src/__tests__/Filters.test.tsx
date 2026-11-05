import { fireEvent, render, screen, within } from "@testing-library/react";
import ConnectionFilters from "../components/ConnectionFilters";
import data from "../data/graph.json";
import Filters from "../components/Filters";
import { ALL_NEIGHBORS } from "../lib/connections";
import { NO_FILTER } from "../lib/filters";
import type { Graph } from "../types";

const node = (id: string, extra: object = {}) => ({ id, name: id, sector: "S", rank: 0, fields: [], ...extra });
const graph: Graph = {
  generated: "2026-11-04",
  sectors: [],
  nodes: [
    node("1", { department: "Bogotá, D.C.", city: "Bogotá, D.C.", size: "Pequeña (1-50 empleados)" }),
    node("2", { department: "Bogotá, D.C.", city: "Bogotá, D.C." }),
    node("3", { department: "Cundinamarca", city: "Chía", size: "Mediana (50-500 empleados)" }),
    node("4", { department: "Cundinamarca", city: "Cajicá" }),
  ],
  edges: [],
};

describe("Filters (graph)", () => {
  it("offers department, city and size with how many companies each leaves", () => {
    render(<Filters graph={graph} filter={NO_FILTER} onChange={() => {}} shown={4} />);
    const departments = within(screen.getByLabelText("Departamento"));
    expect(departments.getByRole("option", { name: "Bogotá, D.C. (2)" })).toBeInTheDocument();
    expect(departments.getByRole("option", { name: "Cundinamarca (2)" })).toBeInTheDocument();
    expect(within(screen.getByLabelText("Ciudad")).getByRole("option", { name: "Chía (1)" })).toBeInTheDocument();
    const sizes = within(screen.getByLabelText("Tamaño de empresa"));
    expect(sizes.getByRole("option", { name: "Mediana (50-500 empleados) (1)" })).toBeInTheDocument();
    expect(screen.getByText("Mostrando 4 de 4 empresas")).toBeInTheDocument();
  });

  it("reports the chosen value and clears the city when the department changes", () => {
    const onChange = vi.fn();
    render(<Filters graph={graph} filter={{ department: "Cundinamarca", city: "Chía", size: null }} onChange={onChange} shown={1} />);
    fireEvent.change(screen.getByLabelText("Departamento"), { target: { value: "Bogotá, D.C." } });
    expect(onChange).toHaveBeenLastCalledWith({ department: "Bogotá, D.C.", city: null, size: null });
    fireEvent.change(screen.getByLabelText("Tamaño de empresa"), { target: { value: "Mediana (50-500 empleados)" } });
    expect(onChange).toHaveBeenLastCalledWith({ department: "Cundinamarca", city: "Chía", size: "Mediana (50-500 empleados)" });
  });

  it("only lists the cities of the chosen department", () => {
    render(<Filters graph={graph} filter={{ ...NO_FILTER, department: "Cundinamarca" }} onChange={() => {}} shown={2} />);
    const cities = within(screen.getByLabelText("Ciudad"));
    expect(cities.getByRole("option", { name: "Cajicá (1)" })).toBeInTheDocument();
    expect(cities.queryByRole("option", { name: /Bogotá/ })).toBeNull();
  });

  it("clears every filter with the button, which is off while nothing is chosen", () => {
    const onChange = vi.fn();
    const { rerender } = render(<Filters graph={graph} filter={NO_FILTER} onChange={onChange} shown={4} />);
    expect(screen.getByRole("button", { name: "Quitar filtros" })).toBeDisabled();
    rerender(<Filters graph={graph} filter={{ ...NO_FILTER, city: "Chía" }} onChange={onChange} shown={1} />);
    expect(screen.getByText("Filtrar el grafo (activo)")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Quitar filtros" }));
    expect(onChange).toHaveBeenCalledWith(NO_FILTER);
  });
});

describe("Filters with the real data", () => {
  const real = data as Graph;
  const departments = [...new Set(real.nodes.map((n) => n.department).filter((d): d is string => !!d))];

  it("lists, for every department, exactly the cities of its companies and no others", () => {
    expect(departments.length).toBeGreaterThan(10);
    for (const department of departments) {
      const { unmount } = render(<Filters graph={real} filter={{ ...NO_FILTER, department }} onChange={() => {}} shown={1} />);
      const listed = within(screen.getByLabelText("Ciudad"))
        .getAllByRole("option")
        .map((o) => o.textContent!.replace(/ \(\d+\)$/, ""))
        .filter((t) => t !== "Todos")
        .sort();
      const expected = [...new Set(real.nodes.filter((n) => n.department === department && n.city).map((n) => n.city!))].sort();
      expect(listed, department).toEqual(expected);
      unmount();
    }
  });

  it("does not list cities of other departments under Cundinamarca (Medellín, Cartagena)", () => {
    render(<Filters graph={real} filter={{ ...NO_FILTER, department: "Cundinamarca" }} onChange={() => {}} shown={1} />);
    const cities = within(screen.getByLabelText("Ciudad"));
    expect(cities.queryByRole("option", { name: /^Medellín/ })).toBeNull();
    expect(cities.queryByRole("option", { name: /^Cartagena/ })).toBeNull();
    expect(cities.getByRole("option", { name: /^Bogotá, D\.C\./ })).toBeInTheDocument();
  });

  it("lists all the cities only while no department is chosen", () => {
    render(<Filters graph={real} filter={NO_FILTER} onChange={() => {}} shown={1} />);
    const all = within(screen.getByLabelText("Ciudad")).getAllByRole("option").length - 1;
    expect(all).toBe(new Set(real.nodes.map((n) => n.city).filter(Boolean)).size);
  });
});

describe("ConnectionFilters", () => {
  it("shows how many connections are visible out of the total", () => {
    render(<ConnectionFilters filter={ALL_NEIGHBORS} onChange={() => {}} total={5} shown={3} size="Pequeña (1-50 empleados)" />);
    expect(screen.getByText("Mostrando 3 de 5 conexiones")).toBeInTheDocument();
    expect(screen.getByText("Tamaño: Pequeña (1-50 empleados)")).toBeInTheDocument();
  });

  it("reports the closeness level and the same-size checkbox", () => {
    const onChange = vi.fn();
    render(<ConnectionFilters filter={ALL_NEIGHBORS} onChange={onChange} total={5} shown={5} size="Pequeña (1-50 empleados)" />);
    fireEvent.change(screen.getByLabelText("Cercanía"), { target: { value: "0.5" } });
    expect(onChange).toHaveBeenLastCalledWith({ minCloseness: 0.5, sameSize: false });
    fireEvent.click(screen.getByLabelText("Solo del mismo tamaño"));
    expect(onChange).toHaveBeenLastCalledWith({ minCloseness: 0, sameSize: true });
  });

  it("disables the same-size filter, and says why, when the company has no size", () => {
    render(<ConnectionFilters filter={ALL_NEIGHBORS} onChange={() => {}} total={2} shown={2} />);
    expect(screen.getByLabelText("Solo del mismo tamaño")).toBeDisabled();
    expect(screen.getByText("Esta empresa no tiene el tamaño registrado.")).toBeInTheDocument();
  });
});
