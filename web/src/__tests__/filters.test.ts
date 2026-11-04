import { applyFilter, filterOptions, isFiltering, NO_FILTER } from "../lib/filters";
import type { Company, Edge, Graph } from "../types";

const company = (id: string, sector: string, fieldCount: number, extra: Partial<Company> = {}): Company => ({
  id,
  name: id,
  sector,
  rank: 0,
  fields: Array.from({ length: fieldCount }, (_, i) => [`Campo ${i}`, "x"] as [string, string]),
  ...extra,
});

const BOG = { department: "Bogotá, D.C.", city: "Bogotá, D.C." };
const small = "Pequeña (1-50 empleados)";

const graph: Graph = {
  generated: "2026-11-04",
  sectors: [],
  nodes: [
    company("A", "S1", 3, { ...BOG, size: small }),
    company("B", "S1", 1, { ...BOG, size: small }),
    company("C", "S2", 2, { ...BOG, size: "Mediana (50-500 empleados)" }),
    company("D", "S1", 2, { department: "Cundinamarca", city: "Chía", size: small }),
    company("E", "S1", 5),
    company("G", "S1", 4, { ...BOG, size: small }),
  ],
  edges: [
    { a: "A", b: "D", w: 0.6 },
    { a: "B", b: "C", w: 0.2 },
    { a: "D", b: "E", w: 0.4 },
    { a: "A", b: "G", w: 0.7 },
  ],
};

const ids = (g: Graph) => g.nodes.map((n) => n.id).sort();
const pairs = (g: Graph) => g.edges.map((e) => `${e.a}-${e.b}${e.fallback ? "*" : ""}`).sort();

describe("applyFilter", () => {
  it("returns the same graph when nothing is chosen", () => {
    expect(isFiltering(NO_FILTER)).toBe(false);
    expect(applyFilter(graph, NO_FILTER)).toBe(graph);
  });

  it("keeps only the companies that match, with the connections between them", () => {
    const result = applyFilter(graph, { ...NO_FILTER, city: "Bogotá, D.C." });
    expect(ids(result)).toEqual(["A", "B", "C", "G"]);
    expect(pairs(result)).toEqual(["A-G", "B-C"]);
  });

  it("combines location and size", () => {
    const result = applyFilter(graph, { department: "Bogotá, D.C.", city: null, size: small });
    expect(ids(result)).toEqual(["A", "B", "G"]);
  });

  it("leaves out companies without the data when a filter is on", () => {
    expect(ids(applyFilter(graph, { ...NO_FILTER, size: small }))).not.toContain("E");
  });

  it("recomputes completeness among the companies that remain (most complete = 0)", () => {
    const rank = Object.fromEntries(applyFilter(graph, { ...NO_FILTER, city: "Bogotá, D.C." }).nodes.map((n) => [n.id, n.rank]));
    expect(rank).toEqual({ G: 0, A: 1 / 3, C: 2 / 3, B: 1 });
  });

  it("links a company left without connections to the most complete of its sector, with a dashed fallback", () => {
    const result = applyFilter(graph, { department: "Bogotá, D.C.", city: null, size: small });
    // B quedó sola (su única conexión era con C, que no cumple): se une a G y A, las más completas de su sector.
    expect(pairs(result)).toEqual(["A-B*", "A-G", "B-G*"]);
    const added = result.edges.filter((e) => e.fallback);
    expect(added.every((e) => e.w === 0)).toBe(true);
  });

  it("leaves a company alone when nobody else in its sector remains", () => {
    const result = applyFilter(graph, { ...NO_FILTER, department: "Cundinamarca" });
    expect(ids(result)).toEqual(["D"]);
    expect(result.edges).toEqual([]);
  });

  it("does not repeat a pair when every company of a sector is loose", () => {
    const loose: Graph = {
      ...graph,
      nodes: [company("X1", "S9", 2, { department: "Y" }), company("X2", "S9", 1, { department: "Y" }), company("X3", "S9", 3, { department: "Y" })],
      edges: [],
    };
    const result = applyFilter(loose, { ...NO_FILTER, department: "Y" });
    const keys = result.edges.map((e) => `${e.a}-${e.b}`);
    expect(new Set(keys).size).toBe(keys.length);
    expect(result.edges.every((e) => e.a < e.b)).toBe(true);
    // Cada una queda unida a las demás del sector (aquí son solo dos más).
    for (const id of ["X1", "X2", "X3"]) expect(keys.some((k) => k.split("-").includes(id))).toBe(true);
  });

  it("never links across sectors and never gives a company more than 10 connections", () => {
    const hub = company("H", "S1", 9, { department: "X" });
    const partner = company("P", "S1", 8, { department: "X" });
    const lonely = Array.from({ length: 25 }, (_, i) => company(`I${String(i).padStart(2, "0")}`, "S1", 1, { department: "X" }));
    const other = company("Z", "S2", 1, { department: "X" });
    const big: Graph = { ...graph, nodes: [hub, partner, other, ...lonely], edges: [{ a: "H", b: "P", w: 0.9 }] };
    const result = applyFilter(big, { ...NO_FILTER, department: "X" });
    const degree = new Map<string, number>();
    for (const e of result.edges) for (const k of [e.a, e.b]) degree.set(k, (degree.get(k) ?? 0) + 1);
    expect(Math.max(...degree.values())).toBeLessThanOrEqual(10);
    expect(lonely.every((n) => degree.has(n.id))).toBe(true);
    expect(result.edges.some((e) => e.a === "Z" || e.b === "Z")).toBe(false);
  });
});

describe("filterOptions", () => {
  const values = (o: { value: string; count: number }[]) => o.map((x) => `${x.value}:${x.count}`);

  it("counts each value among all companies, most frequent first", () => {
    const o = filterOptions(graph, NO_FILTER);
    expect(values(o.department)).toEqual(["Bogotá, D.C.:4", "Cundinamarca:1"]);
    expect(values(o.city)).toEqual(["Bogotá, D.C.:4", "Chía:1"]);
    expect(values(o.size)).toEqual([`${small}:4`, "Mediana (50-500 empleados):1"]);
  });

  it("counts each filter only over the companies that meet the other two", () => {
    const o = filterOptions(graph, { ...NO_FILTER, department: "Cundinamarca" });
    expect(values(o.city)).toEqual(["Chía:1"]);
    expect(values(o.size)).toEqual([`${small}:1`]);
    // La lista de departamentos no se recorta por el propio departamento elegido.
    expect(values(o.department)).toEqual(["Bogotá, D.C.:4", "Cundinamarca:1"]);
  });

  it("keeps listing every department when a city is chosen, but still respects the size", () => {
    const withCity = filterOptions(graph, { ...NO_FILTER, city: "Chía" });
    expect(values(withCity.department)).toEqual(["Bogotá, D.C.:4", "Cundinamarca:1"]);
    const withSize = filterOptions(graph, { ...NO_FILTER, size: "Mediana (50-500 empleados)" });
    expect(values(withSize.department)).toEqual(["Bogotá, D.C.:1"]);
  });
});
