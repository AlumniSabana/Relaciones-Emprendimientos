import { fireEvent, render, screen } from "@testing-library/react";
import App from "../App";
import Header from "../components/Header";
import { headerOpacity } from "../lib/header";

describe("headerOpacity", () => {
  it("is fully visible at the initial fit and when zooming out", () => {
    expect(headerOpacity(1)).toBe(1);
    expect(headerOpacity(0.5)).toBe(1);
  });

  it("fades while zooming in and is gone at 1.5x", () => {
    expect(headerOpacity(1.275)).toBeCloseTo(0.5, 5);
    expect(headerOpacity(1.5)).toBe(0);
    expect(headerOpacity(8)).toBe(0);
  });

  it("never increases as the zoom grows", () => {
    const values = [1, 1.1, 1.2, 1.3, 1.4, 1.5, 2].map(headerOpacity);
    expect([...values].sort((a, b) => b - a)).toEqual(values);
  });
});

describe("Header", () => {
  it("shows the centered title and both logos with their names", () => {
    render(<Header />);
    expect(screen.getByRole("heading", { level: 1, name: "Emprendedores Alumni" })).toBeInTheDocument();
    expect(screen.getByRole("img", { name: "Universidad de La Sabana" })).toHaveAttribute("src");
    expect(screen.getByRole("img", { name: "Alumni Sabana" })).toHaveAttribute("src");
  });
});

describe("Header in the app", () => {
  const header = (container: HTMLElement) => container.querySelector<HTMLElement>(".page-header")!;
  const type = (text: string) =>
    fireEvent.change(screen.getByRole("textbox", { name: "Buscar empresa o sector" }), { target: { value: text } });

  it("starts fully visible", () => {
    const { container } = render(<App />);
    expect(header(container).style.opacity).toBe("1");
  });

  it("fades out when the search zooms in on a company", () => {
    const { container } = render(<App />);
    type("rachid");
    fireEvent.click(screen.getByRole("button", { name: /Rachid Style\s*Empresa/ }));
    expect(header(container).style.opacity).toBe("0");
  });

  it("stays visible when a sector is chosen, because the view does not zoom", () => {
    const { container } = render(<App />);
    fireEvent.click(screen.getByRole("button", { name: /Moda y textiles/ }));
    expect(header(container).style.opacity).toBe("1");
  });
});
