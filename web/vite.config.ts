import react from "@vitejs/plugin-react";
import { loadEnv, type Plugin } from "vite";
import { defineConfig } from "vitest/config";

/** En local sirve /api/chat con la misma función que usa Vercel (api/chat.ts); la llave sale de web/.env.local. */
function chatApi(): Plugin {
  return {
    name: "chat-api",
    configureServer(server) {
      Object.assign(process.env, loadEnv(server.config.mode, server.config.root, "GEMINI_"));
      server.middlewares.use("/api/chat", async (req, res) => {
        const chunks: Buffer[] = [];
        for await (const chunk of req) chunks.push(chunk as Buffer);
        const request = new Request("http://localhost/api/chat", {
          method: req.method,
          headers: { "Content-Type": "application/json" },
          body: req.method === "POST" ? Buffer.concat(chunks) : undefined,
        });
        const { POST } = await server.ssrLoadModule("/api/chat.ts");
        const response: Response = req.method === "POST" ? await POST(request) : new Response("", { status: 405 });
        res.statusCode = response.status;
        res.setHeader("Content-Type", response.headers.get("Content-Type") ?? "application/json");
        res.end(await response.text());
      });
    },
  };
}

export default defineConfig({
  plugins: [react(), chatApi()],
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./src/setupTests.ts"],
    // Las pruebas que montan <App /> calculan la disposición de ~600 nodos y rondan los 5 s (el límite por defecto).
    testTimeout: 20_000,
  },
});
