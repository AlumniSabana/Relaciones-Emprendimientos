import { CATALOG } from "./_catalog.js";
import { catalogIds, cleanMessages, parseReply, RESPONSE_SCHEMA, systemPrompt } from "./_chat.js";

// La llave nunca va al navegador ni al repositorio: se lee de la variable de entorno GEMINI_API_KEY
// (en Vercel: Settings > Environment Variables; en local: web/.env.local).
export const config = { maxDuration: 60 };

// Google retira y satura modelos seguido: se prueban en orden hasta que uno responda (GEMINI_MODEL se prueba primero).
const MODELS = [
  process.env.GEMINI_MODEL,
  "gemini-3.1-flash-lite",
  "gemini-3-flash-preview",
  "gemini-3.8-flash",
  "gemini-3.7-flash",
  "gemini-3.6-flash",
].filter(Boolean);
const TRY_MS = 15_000; // por modelo
const TOTAL_MS = 52_000; // por pregunta, dentro de maxDuration
const url = (model: string) => `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;
const known = catalogIds(CATALOG);
// Caché de contexto: el catálogo (≈38 500 tokens) va en la instrucción de sistema, que es lo primero que ve el modelo y es
// idéntica en todas las preguntas, así que el caché implícito de Gemini la reutiliza (≈90 % de los tokens de entrada) y solo
// se cobra y procesa de nuevo la pregunta. Para no perderlo: no pongas nada que cambie (fechas, ids de sesión…) antes del
// catálogo. shortcut: caché implícito y no el explícito (cachedContents), que el nivel gratuito de Google no permite (limit=0).
const system = systemPrompt(CATALOG);
// El caché es por modelo: se empieza por el último que respondió para no repartir las preguntas entre modelos (y cachés).
let lastGood: string | undefined;

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json; charset=utf-8" } });

// shortcut: sin límite de uso por visitante (la función no guarda estado); poner uno (p. ej. Upstash) si la página se hace pública.
export async function POST(request: Request): Promise<Response> {
  const key = process.env.GEMINI_API_KEY;
  if (!key) return json({ error: "El asistente no está configurado en el servidor." }, 503);

  const messages = cleanMessages(await request.json().catch(() => null));
  if (!messages.length) return json({ error: "Escribe una pregunta." }, 400);

  const body = JSON.stringify({
    systemInstruction: { parts: [{ text: system }] },
    contents: messages.map((m) => ({ role: m.role === "user" ? "user" : "model", parts: [{ text: m.text }] })),
    generationConfig: { temperature: 0.2, responseMimeType: "application/json", responseSchema: RESPONSE_SCHEMA },
  });
  const models = [...new Set([lastGood, ...MODELS])].filter(Boolean) as string[];
  let upstream: Response | null = null;
  let used = "";
  const deadline = Date.now() + TOTAL_MS;
  // Rondas sobre la lista hasta que uno responda o se acabe el plazo: los 503 por saturación suelen pasar en segundos.
  for (let i = 0; deadline - Date.now() >= 3000; i++) {
    const model = models[i % models.length];
    used = model;
    const left = deadline - Date.now();
    upstream = await fetch(url(model), {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-goog-api-key": key },
      body,
      signal: AbortSignal.timeout(Math.min(TRY_MS, left)),
    }).catch((error) => {
      console.error("chat: falló", model, String(error));
      return null;
    });
    if (upstream && !upstream.ok) console.error("chat:", model, upstream.status, (await upstream.clone().text()).slice(0, 300));
    // Si el modelo no existe, está saturado o tardó, se prueba el siguiente; otros errores (llave, petición) no mejoran.
    if (upstream && ![404, 429, 500, 503, 504].includes(upstream.status)) break;
    if (i % models.length === models.length - 1) await new Promise((resolve) => setTimeout(resolve, 1500));
  }
  if (!upstream?.ok) return json({ error: "El asistente no pudo responder. Intenta de nuevo." }, 502);

  lastGood = used;
  const data = await upstream.json().catch(() => null);
  const usage = data?.usageMetadata;
  console.log(`chat: ${used} tokens=${usage?.promptTokenCount ?? "?"} en caché=${usage?.cachedContentTokenCount ?? 0}`);
  const text: string = data?.candidates?.[0]?.content?.parts?.map((p: { text?: string }) => p.text ?? "").join("") ?? "";
  const reply = parseReply(text, known);
  return json(reply.answer ? reply : { error: "No entendí la respuesta del asistente. Intenta reformular." }, reply.answer ? 200 : 502);
}
