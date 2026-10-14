/**
 * Lokale Attrappen der Neon-Dienste für `scripts/e2e-local.mjs`.
 *
 * Damit lässt sich die Verdrahtung wirklich end-to-end prüfen, auch ohne
 * Internetzugang zu Neon: echte Postgres-Verbindung (PGlite über den
 * Postgres-Wire-Protokoll-Socket), echtes S3-Protokoll (AWS SDK), echte
 * HTTP-Aufrufe zum AI Gateway und echte JWT-Prüfung gegen eine JWKS.
 *
 * Diese Datei gehört NICHT in Produktion – sie existiert nur für Tests.
 */
import { createServer } from "node:http";
import { generateKeyPairSync } from "node:crypto";

import { PGlite } from "@electric-sql/pglite";
import { PGLiteSocketServer } from "@electric-sql/pglite-socket";
import { exportJWK, SignJWT } from "jose";

/* ------------------------------------------------------------------ *
 * „Neon Postgres": PGlite über den Postgres-Socket (echtes Wire-Protokoll)
 * ------------------------------------------------------------------ */
export async function startPgliteServer({ port, dataDir }) {
  const db = await PGlite.create(dataDir ?? "memory://");
  // Die App und die Function halten je einen eigenen Pool → mehr als eine
  // Verbindung erlauben (Standard wäre 1).
  const server = new PGLiteSocketServer({ db, port, host: "127.0.0.1", maxConnections: 12 });
  await server.start();
  return {
    url: `postgres://postgres:postgres@127.0.0.1:${port}/postgres`,
    /** Direkte Abfragen für Test-Assertions (derselbe Datenbestand). */
    query: (text, params) => db.query(text, params),
    async stop() {
      await server.stop();
      await db.close();
    },
  };
}

/* ------------------------------------------------------------------ *
 * „Neon Object Storage": S3-kompatibler Bucket (Path-Style, SigV4 ignoriert)
 * ------------------------------------------------------------------ */
export async function startFakeS3({ port }) {
  /** key → { body, contentType } */
  const objects = new Map();

  const server = createServer((req, res) => {
    const url = new URL(req.url ?? "/", "http://localhost");
    const segments = url.pathname.split("/").filter(Boolean);

    if (segments[0] === "__objects") {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify([...objects.keys()]));
      return;
    }

    const [bucket, ...keyParts] = segments;
    const key = keyParts.join("/");
    if (!bucket || !key) {
      res.writeHead(400).end("bad request");
      return;
    }
    const fullKey = `${bucket}/${key}`;

    if (req.method === "PUT") {
      const chunks = [];
      req.on("data", (chunk) => chunks.push(chunk));
      req.on("end", () => {
        objects.set(fullKey, {
          body: Buffer.concat(chunks),
          contentType: req.headers["content-type"] ?? "application/octet-stream",
        });
        res.writeHead(200, { ETag: '"mock-etag"' }).end();
      });
      return;
    }

    if (req.method === "GET" || req.method === "HEAD") {
      const object = objects.get(fullKey);
      if (!object) {
        res.writeHead(404, { "Content-Type": "application/xml" }).end("<Error>NoSuchKey</Error>");
        return;
      }
      res.writeHead(200, {
        "Content-Type": object.contentType,
        "Content-Length": String(object.body.length),
      });
      res.end(req.method === "HEAD" ? undefined : object.body);
      return;
    }

    if (req.method === "DELETE") {
      objects.delete(fullKey);
      res.writeHead(204).end();
      return;
    }

    res.writeHead(405).end();
  });

  await new Promise((resolve) => server.listen(port, "127.0.0.1", resolve));
  return {
    keys: () => [...objects.keys()],
    get: (key) => objects.get(key),
    async stop() {
      await new Promise((resolve) => server.close(resolve));
    },
  };
}

/* ------------------------------------------------------------------ *
 * „Neon AI Gateway": OpenAI-kompatibel (/v1/models, /v1/chat/completions)
 * ------------------------------------------------------------------ */
export async function startFakeGateway({ port }) {
  const calls = [];
  let counter = 0;

  const server = createServer((req, res) => {
    const url = new URL(req.url ?? "/", "http://localhost");
    const auth = req.headers.authorization ?? "";
    if (!auth.startsWith("Bearer ")) {
      res.writeHead(401, { "Content-Type": "application/json" }).end('{"error":"unauthorized"}');
      return;
    }

    if (req.method === "GET" && url.pathname === "/v1/models") {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ data: [{ id: "mock/werwolf-mini" }, { id: "mock/big-model" }] }));
      return;
    }

    if (req.method === "POST" && url.pathname === "/v1/chat/completions") {
      const chunks = [];
      req.on("data", (chunk) => chunks.push(chunk));
      req.on("end", () => {
        const body = JSON.parse(Buffer.concat(chunks).toString("utf8") || "{}");
        calls.push(body);
        counter += 1;
        const userContent = body.messages?.find((m) => m.role === "user")?.content ?? "";
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(
          JSON.stringify({
            id: `mock-${counter}`,
            model: body.model ?? "mock",
            choices: [
              {
                index: 0,
                message: {
                  role: "assistant",
                  content: `Der Spielleiter spricht (Mock #${counter}): Die Nacht senkt sich über das Dorf. [Prompt-Ende: ${String(
                    userContent,
                  )
                    .slice(-40)}]`,
                },
              },
            ],
          }),
        );
      });
      return;
    }

    res.writeHead(404, { "Content-Type": "application/json" }).end('{"error":"not_found"}');
  });

  await new Promise((resolve) => server.listen(port, "127.0.0.1", resolve));
  return {
    calls,
    async stop() {
      await new Promise((resolve) => server.close(resolve));
    },
  };
}

/* ------------------------------------------------------------------ *
 * „Neon Auth": JWKS + Better-Auth-Minimalendpunkte
 * ------------------------------------------------------------------ */
export async function startFakeAuth({ port }) {
  const { publicKey, privateKey } = generateKeyPairSync("ed25519");
  const kid = "mock-key-1";
  const jwk = { ...(await exportJWK(publicKey)), kid, alg: "EdDSA", use: "sig" };

  const users = new Map(); // email → { id, email, name, password }
  const sessions = new Map(); // sessionToken → email

  const readBody = (req) =>
    new Promise((resolve) => {
      const chunks = [];
      req.on("data", (chunk) => chunks.push(chunk));
      req.on("end", () => {
        try {
          resolve(JSON.parse(Buffer.concat(chunks).toString("utf8") || "{}"));
        } catch {
          resolve({});
        }
      });
    });

  const sessionFor = (req) => {
    const cookie = req.headers.cookie ?? "";
    const match = /(?:^|;\s*)(?:__Secure-)?(?:neon-auth|better-auth)\.session_token=([^;]+)/.exec(cookie);
    if (!match) return null;
    const email = sessions.get(decodeURIComponent(match[1]));
    const user = email ? users.get(email) : null;
    return user ? { user, token: decodeURIComponent(match[1]) } : null;
  };

  const server = createServer((req, res) => {
    const url = new URL(req.url ?? "/", "http://localhost");
    if (process.env.DEBUG_MOCKS) {
      console.log(`[fake-auth] ${req.method} ${url.pathname} cookie=${req.headers.cookie ?? "-"}`);
    }
    const sendJson = (status, body, headers = {}) => {
      res.writeHead(status, { "Content-Type": "application/json", ...headers });
      res.end(JSON.stringify(body));
    };

    if (url.pathname === "/.well-known/jwks.json" || url.pathname === "/jwks") {
      sendJson(200, { keys: [jwk] });
      return;
    }

    if (url.pathname === "/sign-up/email" && req.method === "POST") {
      void readBody(req).then((body) => {
        const email = String(body.email ?? "").toLowerCase();
        if (!email) return sendJson(400, { message: "email required" });
        const user =
          users.get(email) ??
          { id: `user_${users.size + 1}`, email, name: body.name ?? email, password: body.password };
        users.set(email, user);
        const token = `sess_${Math.random().toString(36).slice(2)}`;
        sessions.set(token, email);
        sendJson(200, { token, user: { id: user.id, email: user.email, name: user.name } }, {
          "Set-Cookie": `__Secure-neon-auth.session_token=${token}; Path=/; HttpOnly; SameSite=Lax`,
        });
      });
      return;
    }

    if (url.pathname === "/sign-in/email" && req.method === "POST") {
      void readBody(req).then((body) => {
        const email = String(body.email ?? "").toLowerCase();
        const user = users.get(email);
        if (!user || (user.password && user.password !== body.password)) {
          return sendJson(401, { message: "Invalid email or password" });
        }
        const token = `sess_${Math.random().toString(36).slice(2)}`;
        sessions.set(token, email);
        sendJson(200, { token, user: { id: user.id, email: user.email, name: user.name } }, {
          "Set-Cookie": `__Secure-neon-auth.session_token=${token}; Path=/; HttpOnly; SameSite=Lax`,
        });
      });
      return;
    }

    if (url.pathname === "/get-session" && req.method === "GET") {
      const session = sessionFor(req);
      if (!session) return sendJson(200, null);
      sendJson(200, {
        session: {
          id: `sess_${session.token.slice(-6)}`,
          userId: session.user.id,
          token: session.token,
          expiresAt: new Date(Date.now() + 3_600_000).toISOString(),
        },
        user: {
          id: session.user.id,
          email: session.user.email,
          name: session.user.name,
          emailVerified: true,
        },
      });
      return;
    }

    if (url.pathname === "/sign-out" && req.method === "POST") {
      const session = sessionFor(req);
      if (session) sessions.delete(session.token);
      sendJson(200, { success: true }, {
        "Set-Cookie": "__Secure-neon-auth.session_token=; Path=/; Max-Age=0; HttpOnly",
      });
      return;
    }

    // JWT für Browser→Function-Aufrufe (Neon Auth: 15 Minuten gültig).
    if (url.pathname === "/token" && (req.method === "GET" || req.method === "POST")) {
      const session = sessionFor(req);
      if (!session) return sendJson(401, { message: "unauthorized" });
      void new SignJWT({ sub: session.user.id, email: session.user.email })
        .setProtectedHeader({ alg: "EdDSA", kid })
        .setIssuedAt()
        .setIssuer(`http://127.0.0.1:${port}`)
        .setExpirationTime("15m")
        .sign(privateKey)
        .then((token) => sendJson(200, { token }));
      return;
    }

    sendJson(404, { message: `not found: ${url.pathname}` });
  });

  await new Promise((resolve) => server.listen(port, "127.0.0.1", resolve));
  return {
    issuer: `http://127.0.0.1:${port}`,
    jwksUrl: `http://127.0.0.1:${port}/.well-known/jwks.json`,
    async mintToken({ userId, email }) {
      return new SignJWT({ sub: userId, email })
        .setProtectedHeader({ alg: "EdDSA", kid })
        .setIssuedAt()
        .setIssuer(`http://127.0.0.1:${port}`)
        .setExpirationTime("15m")
        .sign(privateKey);
    },
    async stop() {
      await new Promise((resolve) => server.close(resolve));
    },
  };
}
