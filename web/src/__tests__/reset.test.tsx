import { fireEvent, render, screen } from "@testing-library/react";
import App from "../App";
import data from "../data/graph.json";
import type { Graph } from "../types";

const [first, second] = (data as Graph).nodes;
const circle = (container: HTMLElement, id: string) =>
  container.querySelector<SVGCircleElement>(`circle[data-id="${id}"]`)!;
const isInitial = (container: HTMLElement) =>
  container.querySelector("circle[fill]") === null &&
  container.querySelector(".dimmed") === null &&
  screen.queryByRole("complementary") === null;

describe("App selection flow", () => {
  it("opens the card for the clicked company with its sector color", () => {
    const { container } = render(<App />);
    expect(isInitial(container)).toBe(true);
    fireEvent.click(circle(container, first.id));
    expect(screen.getByRole("heading", { name: first.name })).toBeInTheDocument();
    expect(screen.getByRole("complementary")).toHaveStyle({
      borderColor: (data as Graph).sectors.find((s) => s.name === first.sector)!.color,
    });
  });

  it("returns to the initial state when the background is clicked", () => {
    const { container } = render(<App />);
    fireEvent.click(circle(container, first.id));
    fireEvent.click(container.querySelector("svg.graph")!);
    expect(isInitial(container)).toBe(true);
  });

  it("returns to the initial state with the close button", () => {
    const { container } = render(<App />);
    fireEvent.click(circle(container, first.id));
    fireEvent.click(screen.getByRole("button", { name: "Cerrar" }));
    expect(isInitial(container)).toBe(true);
  });

  it("keeps the selection when the selected node is clicked again", () => {
    const { container } = render(<App />);
    fireEvent.click(circle(container, first.id));
    fireEvent.click(circle(container, first.id));
    expect(screen.getByRole("heading", { name: first.name })).toBeInTheDocument();
  });

  it("switches the card when another node is clicked", () => {
    const { container } = render(<App />);
    fireEvent.click(circle(container, first.id));
    fireEvent.click(circle(container, second.id));
    expect(screen.getByRole("heading", { name: second.name })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: first.name })).toBeNull();
  });

  it("does not close when clicking inside the card", () => {
    const { container } = render(<App />);
    fireEvent.click(circle(container, first.id));
    fireEvent.click(screen.getByRole("heading", { name: first.name }));
    expect(screen.getByRole("complementary")).toBeInTheDocument();
  });
});
