import { fireEvent, render, screen } from "@testing-library/react";
import App from "../App";
import Matches from "../components/Matches";
import data from "../data/graph.json";
import matchData from "../data/matches.json";
import { candidatesFor, type MatchData } from "../lib/matches";
import { sectorColors } from "../lib/graph";
import type { Graph } from "../types";

const graph = data as Graph;
const colors = sectorColors(graph.sectors);
const byId = new Map(graph.nodes.map((n) => [n.id, n]));
const me = graph.nodes.find((n) => candidatesFor(n.id, (matchData as MatchData).matches).length >= 3)!;
const candidates = candidatesFor(me.id, (matchData as MatchData).matches);

beforeEach(() => localStorage.clear());

const renderMatches = (onShow = vi.fn()) =>
  render(<Matches graph={graph} colors={colors} initialId={me.id} onShow={onShow} onClose={() => {}} />);

describe("Matches", () => {
  it("shows the best candidate first with its relation, affinity and reason", () => {
    renderMatches();
    const first = candidates[0];
    expect(screen.getByRole("heading", { name: byId.get(first.other)!.name })).toBeInTheDocument();
    expect(screen.getByText(`Afinidad ${first.aff.toLowerCase()}`)).toBeInTheDocument();
    expect(screen.getByText(first.why)).toBeInTheDocument();
    expect(screen.getByText(`1 de ${candidates.length}`)).toBeInTheDocument();
  });

  it("moves to the next candidate on pass and keeps the ones the user likes", () => {
    renderMatches();
    fireEvent.click(screen.getByRole("button", { name: "Me interesa" }));
    expect(screen.getByRole("heading", { name: byId.get(candidates[1].other)!.name })).toBeInTheDocument();
    expect(screen.getByText("Te interesan (1)")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Pasar" }));
    expect(screen.getByRole("heading", { name: byId.get(candidates[2].other)!.name })).toBeInTheDocument();
    expect(screen.getByText("Te interesan (1)")).toBeInTheDocument();
  });

  it("remembers the decisions after closing and reopening, and can start over", () => {
    const first = renderMatches();
    fireEvent.click(screen.getByRole("button", { name: "Pasar" }));
    first.unmount();
    renderMatches();
    expect(screen.getByRole("heading", { name: byId.get(candidates[1].other)!.name })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Volver a empezar" }));
    expect(screen.getByRole("heading", { name: byId.get(candidates[0].other)!.name })).toBeInTheDocument();
  });

  it("says so when every suggestion has been seen", () => {
    renderMatches();
    for (let i = 0; i < candidates.length; i++) fireEvent.click(screen.getByRole("button", { name: "Pasar" }));
    expect(screen.getByText("Ya viste todas las sugerencias.")).toBeInTheDocument();
  });

  it("opens the candidate in the graph", () => {
    const onShow = vi.fn();
    renderMatches(onShow);
    fireEvent.click(screen.getByRole("button", { name: "Ver en el grafo" }));
    expect(onShow).toHaveBeenCalledWith(candidates[0].other);
  });

  it("lets the user pick their company by name when none is chosen", () => {
    render(<Matches graph={graph} colors={colors} onShow={() => {}} onClose={() => {}} />);
    fireEvent.change(screen.getByRole("textbox", { name: "Buscar tu empresa" }), { target: { value: me.name } });
    fireEvent.click(screen.getByRole("button", { name: me.name }));
    expect(screen.getByText(/Matches para/)).toBeInTheDocument();
  });
});

describe("Matches in the app", () => {
  it("opens from a company's card with that company", async () => {
    render(<App />);
    fireEvent.change(screen.getByRole("textbox", { name: "Buscar empresa o sector" }), { target: { value: me.name } });
    fireEvent.click(screen.getAllByRole("button", { name: new RegExp(`${me.name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s*Empresa`) })[0]);
    fireEvent.click(screen.getByRole("button", { name: "Buscar matches para esta empresa" }));
    expect(await screen.findByRole("heading", { name: byId.get(candidates[0].other)!.name })).toBeInTheDocument();
  });
});
