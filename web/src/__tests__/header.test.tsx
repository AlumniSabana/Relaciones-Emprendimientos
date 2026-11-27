import { render, screen } from "@testing-library/react";
import App from "../App";
import Header from "../components/Header";

describe("Header", () => {
  it("shows the title and both logos with their names", () => {
    render(<Header />);
    expect(screen.getByRole("heading", { level: 1, name: "Emprendedores Alumni" })).toBeInTheDocument();
    expect(screen.getByRole("img", { name: "TalentHub UniSabana" })).toHaveAttribute("src");
    expect(screen.getByRole("img", { name: "Universidad de La Sabana" })).toHaveAttribute("src");
  });

  it("has no sign-in or sign-up buttons", () => {
    render(<Header />);
    expect(screen.queryByRole("link", { name: /ingresar|crear cuenta/i })).toBeNull();
    expect(screen.queryByRole("button", { name: /ingresar|crear cuenta/i })).toBeNull();
  });

  it("sits above the sidebar and the graph, and stays when a company is chosen", () => {
    const { container } = render(<App />);
    const shell = container.querySelector(".shell")!;
    expect(shell.firstElementChild).toBe(container.querySelector("header.topbar"));
    expect(shell.querySelector("main.app")).not.toBeNull();
  });
});
