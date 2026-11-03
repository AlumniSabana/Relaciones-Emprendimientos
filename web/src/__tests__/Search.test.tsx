import { fireEvent, render, screen } from "@testing-library/react";
import Search from "../components/Search";
import type { Graph } from "../types";

const graph: Graph = {
  generated: "2026-11-02",
  sectors: [{ name: "Moda y textiles", color: "#e6194b" }],
  nodes: [
    { id: "1", name: "Rachid Style", sector: "Moda y textiles", rank: 0, fields: [] },
    { id: "2", name: "Moda Express", sector: "Moda y textiles", rank: 1, fields: [] },
  ],
  edges: [],
};

const box = () => screen.getByRole("textbox", { name: "Buscar empresa o sector" });
const type = (text: string) => fireEvent.change(box(), { target: { value: text } });

describe("Search", () => {
  it("shows nothing until the person types", () => {
    render(<Search graph={graph} onSelect={() => {}} />);
    expect(screen.queryByRole("button")).toBeNull();
  });

  it("lists matching sectors and companies with their type", () => {
    render(<Search graph={graph} onSelect={() => {}} />);
    type("moda");
    expect(screen.getByRole("button", { name: /Moda y textiles\s*Sector/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Moda Express\s*Empresa/ })).toBeInTheDocument();
  });

  it("selects the company that is chosen and closes the list", () => {
    const onSelect = vi.fn();
    render(<Search graph={graph} onSelect={onSelect} />);
    type("rachid");
    fireEvent.click(screen.getByRole("button", { name: /Rachid Style/ }));
    expect(onSelect).toHaveBeenCalledWith({ type: "company", id: "1" });
    expect(screen.queryByText("Empresa")).toBeNull();
    expect(box()).toHaveValue("Rachid Style");
  });

  it("selects the sector that is chosen", () => {
    const onSelect = vi.fn();
    render(<Search graph={graph} onSelect={onSelect} />);
    type("textiles");
    fireEvent.click(screen.getByRole("button", { name: /Moda y textiles/ }));
    expect(onSelect).toHaveBeenCalledWith({ type: "sector", name: "Moda y textiles" });
  });

  it("chooses the first result with Enter", () => {
    const onSelect = vi.fn();
    render(<Search graph={graph} onSelect={onSelect} />);
    type("moda");
    fireEvent.keyDown(box(), { key: "Enter" });
    expect(onSelect).toHaveBeenCalledWith({ type: "sector", name: "Moda y textiles" });
  });

  it("finds a company by a word in its description and highlights it", () => {
    const withText: Graph = {
      ...graph,
      nodes: [{ ...graph.nodes[0], fields: [["Descripción completa", "Confección de ropa deportiva para mujeres"]] }],
    };
    const onSelect = vi.fn();
    const { container } = render(<Search graph={withText} onSelect={onSelect} />);
    type("deportiva");
    const result = screen.getByRole("button", { name: /Rachid Style/ });
    expect(container.querySelector("mark")).toHaveTextContent("deportiva");
    fireEvent.click(result);
    expect(onSelect).toHaveBeenCalledWith({ type: "company", id: "1" });
  });

  it("says so when there are no results", () => {
    render(<Search graph={graph} onSelect={() => {}} />);
    type("zzzz");
    expect(screen.getByText("Sin resultados")).toBeInTheDocument();
  });

  it("clears the text with Escape and with the clear button", () => {
    render(<Search graph={graph} onSelect={() => {}} />);
    type("moda");
    fireEvent.keyDown(box(), { key: "Escape" });
    expect(box()).toHaveValue("");
    type("moda");
    fireEvent.click(screen.getByRole("button", { name: "Limpiar búsqueda" }));
    expect(box()).toHaveValue("");
    expect(screen.queryByText("Sin resultados")).toBeNull();
  });
});
