import { fireEvent, render, screen } from "@testing-library/react";
import Legend from "../components/Legend";
import data from "../data/graph.json";
import { countBySector } from "../lib/graph";
import type { Graph } from "../types";

const sectors = [
  { name: "Moda y textiles", color: "#e6194b" },
  { name: "Salud y bienestar", color: "#3cb44b" },
];
const counts = new Map([["Moda y textiles", 29], ["Salud y bienestar", 56]]);

describe("Legend", () => {
  it("shows every sector with its own color and its number of companies", () => {
    render(<Legend sectors={sectors} counts={counts} active={null} onSelect={() => {}} />);
    for (const { name, color } of sectors) {
      const item = screen.getByText(name).closest("li")!;
      expect(item.querySelector(".swatch")).toHaveStyle({ backgroundColor: color });
      expect(item.querySelector(".count")).toHaveTextContent(String(counts.get(name)));
    }
  });

  it("lists the 16 sectors of the real data with counts that add up to every company", () => {
    const { sectors: real, nodes } = data as Graph;
    render(<Legend sectors={real} counts={countBySector(nodes)} active={null} onSelect={() => {}} />);
    expect(screen.getAllByRole("listitem")).toHaveLength(16);
    const total = [...document.querySelectorAll(".count")].reduce((s, c) => s + Number(c.textContent), 0);
    expect(total).toBe(nodes.length);
  });

  it("marks the active sector as pressed", () => {
    render(<Legend sectors={sectors} counts={counts} active="Moda y textiles" onSelect={() => {}} />);
    expect(screen.getByRole("button", { name: /Moda y textiles/ })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: /Salud y bienestar/ })).toHaveAttribute("aria-pressed", "false");
  });

  it("selects a sector on click and deselects it when clicked again", () => {
    const onSelect = vi.fn();
    const { rerender } = render(<Legend sectors={sectors} counts={counts} active={null} onSelect={onSelect} />);
    fireEvent.click(screen.getByRole("button", { name: /Salud y bienestar/ }));
    expect(onSelect).toHaveBeenLastCalledWith("Salud y bienestar");
    rerender(<Legend sectors={sectors} counts={counts} active="Salud y bienestar" onSelect={onSelect} />);
    fireEvent.click(screen.getByRole("button", { name: /Salud y bienestar/ }));
    expect(onSelect).toHaveBeenLastCalledWith(null);
  });
});
