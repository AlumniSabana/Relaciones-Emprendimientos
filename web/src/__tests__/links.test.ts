import data from "../data/graph.json";
import { webUrl } from "../lib/links";
import type { Graph } from "../types";

describe("webUrl", () => {
  it.each([
    ["www.rachidstyle.com", "https://www.rachidstyle.com"],
    ["WWW.Ropure.COM.co/ruta?x=1", "https://WWW.Ropure.COM.co/ruta?x=1"],
    ["  www.sitio.co  ", "https://www.sitio.co"],
    ["sitio.com.co", "https://sitio.com.co"],
    ["https://iefonquetachia.edu.co/", "https://iefonquetachia.edu.co/"],
    ["http://www.rdsconstructora.com/", "http://www.rdsconstructora.com/"],
    ["HTTPS://sitio.com", "https://sitio.com/"],
    ["www:jardinmundointeractivo.com", "https://www.jardinmundointeractivo.com"],
    ["www.sitio.com:8080/a", "https://www.sitio.com:8080/a"],
  ])("links %j", (value, expected) => {
    expect(webUrl(value)).toBe(expected);
  });

  it.each([
    "No tienen", "NO ACTUALMENTE", "En construcción", "no informo", "arb&abogados", "www, t m l",
    "covivienda@yahoo.com", "dcns.co inforbreak.com", "dodlemoments, nr.emprendedor1", "facebook: villagol cajica",
    "", "   ", "www.", "http://", "https://sitio.com y más", "192.168.0.1", "localhost",
  ])("shows %j as plain text", (value) => {
    expect(webUrl(value)).toBeNull();
  });

  it.each([
    "javascript:alert(1)", "JavaScript:alert(1)", "javascript://sitio.com/%0aalert(1)", "data:text/html,<b>x</b>",
    "mailto:a@sitio.com", "ftp://sitio.com", "file:///etc/passwd", "vbscript:msgbox(1)", "//sitio.com",
    "https://sitio.com/\" onclick=\"alert(1)", "http://[::1", "https:sitio.com",
  ])("never links %j, so a link cannot open anything but a web page", (value) => {
    const url = webUrl(value);
    expect(url === null || /^https?:\/\//.test(url)).toBe(true);
    expect(url).toBeNull();
  });

  it("returns only http(s) addresses for every Página Web in the real data, and links most of them", () => {
    const values = (data as Graph).nodes.flatMap((n) => n.fields.filter(([l]) => l === "Página Web").map(([, v]) => v));
    const links = values.map(webUrl).filter((u): u is string => u !== null);
    expect(values.length).toBeGreaterThan(300);
    expect(links.length).toBeGreaterThan(300);
    for (const url of links) {
      expect(url).toMatch(/^https?:\/\/[^\s]+$/);
      expect(new URL(url).hostname).toMatch(/\.[a-z]{2,}$/i);
    }
  });
});
