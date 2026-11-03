import { fireEvent, render, screen } from "@testing-library/react";
import App from "../App";
import data from "../data/graph.json";
import type { Graph } from "../types";

const graph = data as Graph;
const sector = graph.sectors.find((s) => s.name === "Moda y textiles")!;
const members = graph.nodes.filter((n) => n.sector === sector.name);
const company = graph.nodes.find((n) => n.name === "Rachid Style")!;

const circle = (container: HTMLElement, id: string) =>
  container.querySelector<SVGCircleElement>(`circle[data-id="${id}"]`)!;
const isInitial = (container: HTMLElement) =>
  container.querySelector("circle[fill]") === null &&
  container.querySelector(".dimmed") === null &&
  screen.queryByRole("complementary") === null;
const box = () => screen.getByRole("textbox", { name: "Buscar empresa o sector" });
const type = (text: string) => fireEvent.change(box(), { target: { value: text } });
const sectorButton = () => screen.getByRole("button", { name: new RegExp(sector.name) });

describe("Sector selection from the left bar", () => {
  it("colors the whole sector and opens no card", () => {
    const { container } = render(<App />);
    fireEvent.click(sectorButton());
    expect(container.querySelectorAll("circle[fill]")).toHaveLength(members.length);
    members.forEach((n) => expect(circle(container, n.id)).toHaveAttribute("fill", sector.color));
    expect(screen.queryByRole("complementary")).toBeNull();
    expect(sectorButton()).toHaveAttribute("aria-pressed", "true");
  });

  it("returns to the initial state when the same sector is clicked again", () => {
    const { container } = render(<App />);
    fireEvent.click(sectorButton());
    fireEvent.click(sectorButton());
    expect(isInitial(container)).toBe(true);
    expect(sectorButton()).toHaveAttribute("aria-pressed", "false");
  });

  it("returns to the initial state when the background is clicked", () => {
    const { container } = render(<App />);
    fireEvent.click(sectorButton());
    fireEvent.click(container.querySelector("svg.graph")!);
    expect(isInitial(container)).toBe(true);
    expect(sectorButton()).toHaveAttribute("aria-pressed", "false");
  });

  it("switches to the company, with its card, when a company is clicked", () => {
    const { container } = render(<App />);
    fireEvent.click(sectorButton());
    fireEvent.click(circle(container, company.id));
    expect(screen.getByRole("heading", { name: company.name })).toBeInTheDocument();
    expect(sectorButton()).toHaveAttribute("aria-pressed", "false");
  });
});

describe("Search", () => {
  it("choosing a sector equals clicking it in the left bar", () => {
    const { container } = render(<App />);
    type("textiles");
    fireEvent.click(screen.getAllByRole("button", { name: /Moda y textiles\s*Sector/ })[0]);
    expect(container.querySelectorAll("circle[fill]")).toHaveLength(members.length);
    expect(sectorButton()).toHaveAttribute("aria-pressed", "true");
  });

  it("choosing a company opens its card and centers it", () => {
    const { container } = render(<App />);
    type("RACHID");
    fireEvent.click(screen.getByRole("button", { name: /Rachid Style\s*Empresa/ }));
    expect(screen.getByRole("heading", { name: company.name })).toBeInTheDocument();
    expect(circle(container, company.id)).toHaveAttribute("fill", sector.color);
    expect(container.querySelector("svg > g")!.getAttribute("transform")).toContain("scale(1.6)");
  });

  it("returns to the initial state with the background after choosing a result", () => {
    const { container } = render(<App />);
    type("rachid");
    fireEvent.click(screen.getByRole("button", { name: /Rachid Style\s*Empresa/ }));
    fireEvent.click(container.querySelector("svg.graph")!);
    expect(isInitial(container)).toBe(true);
  });
});
