import { search } from "../lib/search";
import type { Company, Graph } from "../types";

const company = (id: string, name: string, rank: number, description: string, service = ""): Company => ({
  id,
  name,
  sector: "Moda y textiles",
  rank,
  fields: [
    ...(service ? ([["Servicio que ofrece", service]] as [string, string][]) : []),
    ["Descripción completa", description],
  ],
});

const graph: Graph = {
  generated: "2026-11-04",
  sectors: [{ name: "Moda y textiles", color: "#e6194b" }],
  nodes: [
    company("1", "Alfa", 0.9, "Confección de ropa deportiva para mujeres"),
    company("2", "Beta", 0.1, "Venta de ropa y accesorios. Actividad económica registrada: comercio al por menor"),
    company("3", "Gamma", 0.5, "Turismo en Europa y viajes de lujo"),
    company("4", "Delta", 0.3, "Fábrica de bolsos", "Bolsos de cuero"),
    company("5", "Ropa Express", 0.8, "Tienda de ropa"),
    company("6", "Épsilon", 0.2, "Diseño de ropa para niños"),
  ],
  edges: [],
};

const names = (q: string, limit = 20) => search(graph, q, limit).results.map((r) => (r.kind === "sector" ? "S:" + r.name : r.name));

describe("search in descriptions", () => {
  it("finds companies by words inside their description", () => {
    expect(names("deportiva")).toEqual(["Alfa"]);
  });

  it("puts the most complete companies first among description matches", () => {
    // Beta (0.1), Épsilon (0.2) y Alfa (0.9) mencionan "ropa"; "Ropa Express" va antes por su nombre.
    expect(names("ropa")).toEqual(["Ropa Express", "Beta", "Épsilon", "Alfa"]);
  });

  it("matches the start of words, so 'ropa' does not match 'Europa'", () => {
    expect(names("ropa")).not.toContain("Gamma");
    expect(names("europa")).toEqual(["Gamma"]);
  });

  it("matches word prefixes and ignores case and accents", () => {
    expect(names("CONFEC")).toEqual(["Alfa"]);
    expect(names("diseno")).toEqual(["Épsilon"]);
  });

  it("requires every word of the query, in any order", () => {
    expect(names("ropa mujeres")).toEqual(["Alfa"]);
    expect(names("mujeres ropa")).toEqual(["Alfa"]);
    expect(names("ropa turismo")).toEqual([]);
  });

  it("also searches the service the company offers", () => {
    expect(names("cuero")).toEqual(["Delta"]);
  });

  it("returns a snippet that highlights the match, with ellipsis when it is cut", () => {
    const result = search(graph, "accesorios").results[0];
    expect(result.kind === "company" && result.via).toBe("description");
    const snippet = result.kind === "company" ? result.snippet! : null;
    expect(snippet!.match).toBe("accesorios");
    expect(snippet!.before + snippet!.match + snippet!.after).toContain("Venta de ropa y accesorios");
    expect(snippet!.after.endsWith("…")).toBe(true);
  });

  it("does not give a snippet to a match by name", () => {
    const first = search(graph, "ropa").results[0];
    expect(first.kind === "company" && first.via).toBe("name");
    expect(first.kind === "company" && first.snippet).toBeUndefined();
  });

  it("ignores one-letter words so they do not match almost everything", () => {
    // Épsilon no tiene "a" en el nombre; su descripción sí tiene palabras con "a" ("para", "diseño").
    expect(names("a")).not.toContain("Épsilon");
    expect(names("z")).toEqual([]);
  });

  it("reports the total and limits the list", () => {
    const { results, total } = search(graph, "ropa", 2);
    expect(results).toHaveLength(2);
    expect(total).toBe(4);
  });
});
