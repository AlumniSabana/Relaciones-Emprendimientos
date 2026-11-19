import data from "../data/matches.json";
import graph from "../data/graph.json";
import { candidatesFor, type MatchData, type MatchRow } from "../lib/matches";

const row = (a: string, b: string, rel: MatchRow["rel"], aff: MatchRow["aff"] = "Alta"): MatchRow => ({
  id: `${a}${b}`, a, b, rel, aff, why: "porque sí", check: "confirmar",
});

describe("candidatesFor", () => {
  it("reads the relation from the origin and inverts it for the suggested company", () => {
    const matches = [row("A", "B", "Proveedor"), row("C", "A", "Proveedor"), row("A", "D", "Alianza comercial")];
    const result = candidatesFor("A", matches);
    expect(result.map((c) => [c.other, c.rel])).toEqual([
      ["B", "Proveedor"], // B podría ser proveedor de A
      ["C", "Posible cliente"], // C pidió proveedor a A: A podría ser proveedor de C, o sea C es cliente de A
      ["D", "Alianza comercial"],
    ]);
  });

  it("inverts a possible client into a supplier", () => {
    expect(candidatesFor("B", [row("A", "B", "Posible cliente")])[0]).toMatchObject({ other: "A", rel: "Proveedor" });
  });

  it("lists each company once, keeps the best affinity and puts high affinity first", () => {
    const matches = [row("A", "B", "Proveedor", "Media"), row("A", "C", "Proveedor", "Media"), row("B", "A", "Alianza comercial", "Alta")];
    expect(candidatesFor("A", matches).map((c) => [c.other, c.aff])).toEqual([["B", "Alta"], ["C", "Media"]]);
  });

  it("only offers companies that are available (for example after a filter)", () => {
    const matches = [row("A", "B", "Proveedor"), row("A", "C", "Proveedor")];
    expect(candidatesFor("A", matches, new Set(["C"])).map((c) => c.other)).toEqual(["C"]);
  });
});

describe("matches.json", () => {
  const { matches, offers } = data as MatchData;
  const ids = new Set(graph.nodes.map((n) => n.id));

  it("only refers to companies of the graph and has the expected relations and affinities", () => {
    expect(matches.length).toBeGreaterThan(1000);
    for (const m of matches) {
      expect(ids.has(m.a) && ids.has(m.b) && m.a !== m.b).toBe(true);
      expect(["Proveedor", "Posible cliente", "Alianza comercial"]).toContain(m.rel);
      expect(["Alta", "Media"]).toContain(m.aff);
    }
    expect(Object.keys(offers).every((id) => ids.has(id))).toBe(true);
  });

  it("gives almost every company at least one candidate", () => {
    const withCandidates = graph.nodes.filter((n) => candidatesFor(n.id, matches).length > 0).length;
    expect(withCandidates / graph.nodes.length).toBeGreaterThan(0.9);
  });
});
