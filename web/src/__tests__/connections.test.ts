import { ALL_NEIGHBORS, connectionsOf, visibleConnections } from "../lib/connections";
import type { Company, Edge } from "../types";

const co = (id: string, size?: string): Company => ({ id, name: id, sector: "S", rank: 0, fields: [], size });
const A = co("A", "Pequeña");
const byId = new Map([A, co("B", "Pequeña"), co("C", "Mediana"), co("D"), co("E", "Pequeña")].map((n) => [n.id, n]));
const edges: Edge[] = [
  { a: "A", b: "B", w: 0.6 },
  { a: "C", b: "A", w: 0.4 }, // la empresa también puede ir en el extremo b
  { a: "A", b: "D", w: 0.35 },
  { a: "A", b: "E", w: 0, fallback: true },
  { a: "B", b: "C", w: 0.9 },
];
const others = (f: Parameters<typeof visibleConnections>[3]) => visibleConnections(A, edges, byId, f).map((c) => c.other).sort();

describe("connectionsOf", () => {
  it("finds the connections whichever end the company is on", () => {
    expect(connectionsOf("A", edges).map((c) => c.other).sort()).toEqual(["B", "C", "D", "E"]);
    expect(connectionsOf("Z", edges)).toEqual([]);
  });
});

describe("visibleConnections", () => {
  it("shows all of them by default", () => {
    expect(others(ALL_NEIGHBORS)).toEqual(["B", "C", "D", "E"]);
  });

  it("keeps the connections at or above the minimum closeness (the sector fallback counts as 0)", () => {
    expect(others({ minCloseness: 0.3, sameSize: false })).toEqual(["B", "C", "D"]);
    expect(others({ minCloseness: 0.5, sameSize: false })).toEqual(["B"]);
  });

  it("keeps only the companies of the same size, and drops those without a size", () => {
    expect(others({ minCloseness: 0, sameSize: true })).toEqual(["B", "E"]);
  });

  it("combines both filters", () => {
    expect(others({ minCloseness: 0.5, sameSize: true })).toEqual(["B"]);
    expect(others({ minCloseness: 0.3, sameSize: true })).toEqual(["B"]);
  });

  it("shows nothing for the same-size filter when the company has no size", () => {
    const sinTamano = co("D");
    expect(visibleConnections(sinTamano, edges, byId, { minCloseness: 0, sameSize: true })).toEqual([]);
  });
});
