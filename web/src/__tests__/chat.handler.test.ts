import { CATALOG } from "../../api/_catalog";

// El handler real de web/api/chat.ts con `fetch` simulado: no se llama a Google.
const firstId = CATALOG.split("\n")[0].split("|")[0];

const gemini = (usage: object = { promptTokenCount: 38500, cachedContentTokenCount: 34600 }) =>
  new Response(
    JSON.stringify({
      candidates: [{ content: { parts: [{ text: JSON.stringify({ answer: "Hola", ids: [firstId, firstId, "no-existe"] }) }] } }],
      usageMetadata: usage,
    }),
    { status: 200 },
  );
const failure = (status: number) => new Response(JSON.stringify({ error: { code: status } }), { status });

let calls: { url: string; body: any; headers: Record<string, string> }[];
function mockGoogle(...responses: Response[]) {
  calls = [];
  const queue = [...responses];
  vi.stubGlobal("fetch", async (url: string, init: RequestInit) => {
    calls.push({ url, body: JSON.parse(init.body as string), headers: init.headers as Record<string, string> });
    return queue.shift() ?? gemini();
  });
}
const modelOf = (url: string) => /models\/([^:]+):/.exec(url)![1];

async function load(key = "clave-de-prueba") {
  vi.resetModules(); // el handler recuerda el último modelo que respondió: cada prueba parte de cero
  vi.stubEnv("GEMINI_API_KEY", key);
  vi.stubEnv("GEMINI_MODEL", "");
  const { POST } = await import("../../api/chat");
  return (messages: unknown) => POST(new Request("http://localhost/api/chat", { method: "POST", body: JSON.stringify({ messages }) }));
}
const ask = (text: string) => [{ role: "user", text }];

beforeEach(() => {
  vi.spyOn(console, "error").mockImplementation(() => {});
  vi.spyOn(console, "log").mockImplementation(() => {});
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe("POST /api/chat", () => {
  it("answers 503 without a key and 400 without a question, before calling Google", async () => {
    mockGoogle();
    expect((await (await load(""))(ask("hola"))).status).toBe(503);
    const post = await load();
    expect((await post([])).status).toBe(400);
    expect((await post("no es una lista")).status).toBe(400);
    expect(calls).toHaveLength(0);
  });

  it("returns the answer with only the ids that exist, once each, sending the key in a header", async () => {
    mockGoogle(gemini());
    const response = await (await load())(ask("pastelería en Cajicá"));
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ answer: "Hola", ids: [firstId] });
    expect(calls[0].headers["x-goog-api-key"]).toBe("clave-de-prueba");
    expect(calls[0].url).not.toContain("clave-de-prueba"); // nunca en la URL
  });

  it("keeps the catalog as an identical prefix in every question, so Gemini's implicit cache can reuse it", async () => {
    mockGoogle(gemini(), gemini());
    const post = await load();
    await post(ask("primera pregunta"));
    await post(ask("otra pregunta distinta"));
    const [a, b] = calls.map((c) => c.body);
    expect(a.systemInstruction.parts[0].text).toContain(CATALOG);
    expect(b.systemInstruction).toEqual(a.systemInstruction); // lo que cambia es solo la pregunta, y va después
    expect(a.contents).not.toEqual(b.contents);
    expect(Object.keys(a)[0]).toBe("systemInstruction");
  });

  it("starts the next question with the model that answered last (the cache is per model)", async () => {
    mockGoogle(failure(503), gemini(), gemini());
    const post = await load();
    await post(ask("uno"));
    await post(ask("dos"));
    const models = calls.map((c) => modelOf(c.url));
    expect(models[1]).not.toBe(models[0]); // el primero estaba saturado: pasó al siguiente
    expect(models[2]).toBe(models[1]); // y la siguiente pregunta empieza por el que respondió
  });

  it("logs how many input tokens came from the cache", async () => {
    mockGoogle(gemini({ promptTokenCount: 38500, cachedContentTokenCount: 34600 }));
    await (await load())(ask("hola"));
    expect(console.log).toHaveBeenCalledWith(expect.stringMatching(/tokens=38500 en caché=34600/));
  });

  it("does not try other models when the error is not about the model (bad key)", async () => {
    mockGoogle(failure(403), gemini());
    const response = await (await load())(ask("hola"));
    expect(response.status).toBe(502);
    expect(calls).toHaveLength(1);
  });
});
