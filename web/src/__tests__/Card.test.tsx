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

  it("turns the web page into a link that opens in a new tab", () => {
    render(<Card company={company([["Página Web", "www.rachidstyle.com"]])} color="#e6194b" onClose={() => {}} />);
    const link = screen.getByRole("link", { name: "www.rachidstyle.com" });
    expect(link).toHaveAttribute("href", "https://www.rachidstyle.com");
    expect(link).toHaveAttribute("target", "_blank");
    expect(link.getAttribute("rel")).toContain("noopener");
    expect(link.getAttribute("rel")).toContain("noreferrer");
  });

  it("keeps the text of a page that is not an address, without a link", () => {
    render(<Card company={company([["Página Web", "En construcción"]])} color="#e6194b" onClose={() => {}} />);
    expect(screen.getByText("En construcción")).toBeInTheDocument();
    expect(screen.queryByRole("link")).toBeNull();
  });

  it("shows the address of a company marked as no-link, but without a link to open it", () => {
    const flagged = { ...company([["Página Web", "http://www.sitio.com/"]]), nolink: true };
    render(<Card company={flagged} color="#e6194b" onClose={() => {}} />);
    expect(screen.getByText("http://www.sitio.com/")).toBeInTheDocument();
    expect(screen.queryByRole("link")).toBeNull();
  });

  it("never links a dangerous value written in the web page field", () => {
    render(<Card company={company([["Página Web", "javascript:alert(1)"]])} color="#e6194b" onClose={() => {}} />);
    expect(screen.getByText("javascript:alert(1)")).toBeInTheDocument();
    expect(screen.queryByRole("link")).toBeNull();
  });

  it("links only the Página Web field, not other fields that look like an address", () => {
    render(
      <Card
        company={company([["Redes Sociales", "www.instagram.com/rachid"], ["Descripción completa", "Visítanos en www.rachid.com"]])}
        color="#e6194b"
        onClose={() => {}}
      />,
    );
    expect(screen.queryByRole("link")).toBeNull();
  });

  it("calls onClose from the close button", () => {
    const onClose = vi.fn();
    render(<Card company={company([])} color="#e6194b" onClose={onClose} />);
    fireEvent.click(screen.getByRole("button", { name: "Cerrar" }));
    expect(onClose).toHaveBeenCalledOnce();
  });
});
