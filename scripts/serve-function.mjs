/**
 * Startet die Neon Function `gamemaster` als HTTP-Server auf `PORT` – für den
 * lokalen End-to-End-Test (scripts/e2e-local.mjs). In Produktion übernimmt das
 * Neon selbst: `neon deploy` bündelt functions/gamemaster.ts und stellt sie
 * unter einer öffentlichen URL bereit.
 */
import { createServer } from "node:http";

const port = Number(process.env.PORT ?? 59090);
const module = await import(new URL("../functions/gamemaster.ts", import.meta.url).href);
const handler = module.default;

const server = createServer(async (req, res) => {
  try {
    const chunks = [];
    for await (const chunk of req) chunks.push(chunk);
    const body = Buffer.concat(chunks);

    const request = new Request(new URL(req.url ?? "/", `http://127.0.0.1:${port}`), {
      method: req.method,
      headers: req.headers,
      ...(req.method === "GET" || req.method === "HEAD" ? {} : { body }),
    });

    const response = await handler.fetch(request);
    const headers = {};
    response.headers.forEach((value, key) => {
      headers[key] = value;
    });
    res.writeHead(response.status, headers);
    res.end(Buffer.from(await response.arrayBuffer()));
  } catch (error) {
    console.error("[serve-function] Fehler", error);
    res.writeHead(500, { "Content-Type": "application/json" });
    res.end('{"ok":false,"reason":"server"}');
  }
});

server.listen(port, "127.0.0.1", () => {
  console.log(`[serve-function] gamemaster läuft auf http://127.0.0.1:${port}`);
});
