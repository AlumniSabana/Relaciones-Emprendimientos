import { fireEvent, render, screen } from "@testing-library/react";
import App from "../App";

const dialog = () => screen.queryByRole("dialog", { name: "Cómo usar Emprendedores Alumni" });

describe("Welcome guide", () => {
  beforeEach(() => localStorage.clear());

  it("opens before the graph on a first visit and explains each tool", () => {
    render(<App />);
    expect(dialog()).toBeInTheDocument();
    for (const topic of ["Qué ves", "Ver una empresa", "Buscar", "Filtrar el grafo", "Preguntar al asistente", "Buscar matches"]) {
      expect(screen.getByText(`${topic}.`)).toBeInTheDocument();
    }
  });

  it("closes with the button, with Escape or by clicking outside, and can be opened again from the end of the sidebar", () => {
    render(<App />);
    fireEvent.click(screen.getByRole("button", { name: "Entendido, empezar →" }));
    expect(dialog()).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "¿Cómo usar la herramienta?" }));
    expect(dialog()).toBeInTheDocument();
    fireEvent.keyDown(window, { key: "Escape" });
    expect(dialog()).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "¿Cómo usar la herramienta?" }));
    fireEvent.click(dialog()!.parentElement!); // el fondo oscuro
    expect(dialog()).toBeNull();
  });

  it("the help button is the last control of the sidebar", () => {
    render(<App />);
    const sidebar = screen.getByRole("region", { name: "Búsqueda y sectores" });
    expect(sidebar.lastElementChild).toBe(screen.getByRole("button", { name: "¿Cómo usar la herramienta?" }));
  });

  it("stays closed on the next visit only if the person asked not to see it at start", () => {
    const first = render(<App />);
    fireEvent.click(screen.getByRole("button", { name: "Entendido, empezar →" }));
    first.unmount();
    expect(render(<App />).container.ownerDocument.body).toBeTruthy();
    expect(dialog()).toBeInTheDocument(); // sin marcar la casilla, vuelve a abrirse

    fireEvent.click(screen.getByLabelText("No mostrar al iniciar"));
    fireEvent.click(screen.getByRole("button", { name: "Entendido, empezar →" }));
    const again = render(<App />);
    expect(dialog()).toBeNull();
    again.unmount();
  });

  it("still opens (without remembering anything) if the browser blocks storage", () => {
    const spy = vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("bloqueado");
    });
    render(<App />);
    expect(dialog()).toBeInTheDocument();
    spy.mockRestore();
  });
});
