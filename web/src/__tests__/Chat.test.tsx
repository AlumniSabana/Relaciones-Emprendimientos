import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import App from "../App";
import Chat from "../components/Chat";
import data from "../data/graph.json";
import type { Graph } from "../types";

const graph = data as Graph;
const [first, second] = graph.nodes;

function mockFetch(body: unknown, ok = true) {
  const fetchMock = vi.fn().mockResolvedValue({ ok, json: () => Promise.resolve(body) });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}
const ask = (text: string) => {
  fireEvent.change(screen.getByRole("textbox", { name: "Tu pregunta" }), { target: { value: text } });
  fireEvent.click(screen.getByRole("button", { name: "Enviar" }));
};

afterEach(() => vi.unstubAllGlobals());

describe("Chat", () => {
  it("sends the question, shows the answer and the companies, and asks the graph to show them", async () => {
    const fetchMock = mockFetch({ answer: "Encontré dos.", ids: [first.id, second.id, "no-existe"] });
    const onShow = vi.fn();
    const onPick = vi.fn();
    render(<Chat graph={graph} onShow={onShow} onPick={onPick} onClose={() => {}} />);
    ask("empresas de pastelería");

    expect(await screen.findByText("Encontré dos.")).toBeInTheDocument();
    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body.messages).toEqual([{ role: "user", text: "empresas de pastelería" }]);
    // Solo las empresas que están en el grafo; "no-existe" se descarta.
    expect(onShow).toHaveBeenCalledWith([first.id, second.id]);
    fireEvent.click(screen.getByRole("button", { name: new RegExp(first.name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")) }));
    expect(onPick).toHaveBeenCalledWith(first.id);
  });

  it("sends the earlier turns as context", async () => {
    const fetchMock = mockFetch({ answer: "Una.", ids: [] });
    render(<Chat graph={graph} onShow={() => {}} onPick={() => {}} onClose={() => {}} />);
    ask("primera");
    await screen.findByText("Una.");
    ask("segunda");
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
    expect(JSON.parse(fetchMock.mock.calls[1][1].body).messages.map((m: { text: string }) => m.text)).toEqual(["primera", "Una.", "segunda"]);
  });

  it("shows the server's message when the assistant fails, and does not touch the graph", async () => {
    mockFetch({ error: "El asistente no pudo responder. Intenta de nuevo." }, false);
    const onShow = vi.fn();
    render(<Chat graph={graph} onShow={onShow} onPick={() => {}} onClose={() => {}} />);
    ask("hola");
    expect(await screen.findByText("El asistente no pudo responder. Intenta de nuevo.")).toBeInTheDocument();
    expect(onShow).not.toHaveBeenCalled();
  });

  it("does not send an empty question", () => {
    const fetchMock = mockFetch({ answer: "x", ids: [] });
    render(<Chat graph={graph} onShow={() => {}} onPick={() => {}} onClose={() => {}} />);
    expect(screen.getByRole("button", { name: "Enviar" })).toBeDisabled();
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe("Chat in the app", () => {
  it("highlights in the graph the companies the assistant found", async () => {
    mockFetch({ answer: "Aquí.", ids: [first.id, second.id] });
    const { container } = render(<App />);
    fireEvent.click(screen.getByRole("button", { name: "Preguntar al asistente" }));
    ask("lo que sea");
    await screen.findByText("Aquí.");
    await waitFor(() => expect(container.querySelectorAll(".focus circle")).toHaveLength(2));
    // El asistente no abre tarjeta: solo resalta.
    expect(container.querySelector(".card")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Cerrar asistente" }));
    expect(screen.queryByRole("log")).toBeNull();
  });
});
