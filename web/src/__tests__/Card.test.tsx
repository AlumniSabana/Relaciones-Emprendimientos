import { fireEvent, render, screen } from "@testing-library/react";
import Card from "../components/Card";
import type { Company } from "../types";

const company = (fields: [string, string][]): Company => ({
  id: "A1",
  name: "Meuf By Ana Paternina",
  sector: "Moda y textiles",
  rank: 0.2,
  fields,
});

describe("Card", () => {
  it("shows the name, the sector and one label-value pair per field", () => {
    const fields: [string, string][] = [
      ["Servicio que ofrece", "Venta de ropa"],
      ["Ciudad", "Bogotá, D.C."],
    ];
    render(<Card company={company(fields)} color="#e6194b" onClose={() => {}} />);
    expect(screen.getByRole("heading", { name: "Meuf By Ana Paternina" })).toBeInTheDocument();
    expect(screen.getByText("Moda y textiles")).toBeInTheDocument();
    expect(screen.getAllByRole("term").map((t) => t.textContent)).toEqual(["Servicio que ofrece", "Ciudad"]);
    expect(screen.getAllByRole("definition").map((d) => d.textContent)).toEqual(["Venta de ropa", "Bogotá, D.C."]);
  });

  it("shows no labels beyond the fields it receives (no empty labels, N/A or dashes)", () => {
    const { container } = render(
      <Card company={company([["Ciudad", "Bogotá"]])} color="#e6194b" onClose={() => {}} />,
    );
    expect(container.querySelectorAll("dt")).toHaveLength(1);
    expect(container.textContent).not.toMatch(/N\/A|^-+$/);
  });

  it("renders only the header when the company has no fields", () => {
    const { container } = render(<Card company={company([])} color="#3cb44b" onClose={() => {}} />);
    expect(container.querySelectorAll("dt")).toHaveLength(0);
    expect(screen.getByRole("heading")).toBeInTheDocument();
  });

  it("draws the border in the sector color", () => {
    const { container } = render(<Card company={company([])} color="#4363d8" onClose={() => {}} />);
    expect(container.firstElementChild).toHaveStyle({ borderColor: "#4363d8" });
  });

  it("keeps very long text complete", () => {
    const long = "palabra ".repeat(250).trim();
    render(<Card company={company([["Descripción completa", long]])} color="#e6194b" onClose={() => {}} />);
    expect(screen.getByText(long)).toBeInTheDocument();
  });

  it("calls onClose from the close button", () => {
    const onClose = vi.fn();
    render(<Card company={company([])} color="#e6194b" onClose={onClose} />);
    fireEvent.click(screen.getByRole("button", { name: "Cerrar" }));
    expect(onClose).toHaveBeenCalledOnce();
  });
});
