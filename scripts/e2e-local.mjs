/**
 * End-to-End-Test der Neon-Verdrahtung – ohne Zugang zu Neon selbst.
 *
 * Phase A: App ohne Neon-Dienste (PGlite als eingebettete Datenbank,
 *          Profilbild als Data-URL) → beweist, dass die App weiterhin ohne
 *          Cloud läuft (lokale Entwicklung).
 * Phase B: App mit „Neon-ähnlicher" Umgebung:
 *          - Postgres über echtes Wire-Protokoll (PGlite-Socket) als DATABASE_URL
 *          - S3-kompatibler Bucket (Neon Object Storage) für Profilbilder
 *          - OpenAI-kompatibles AI Gateway
 *          - JWKS + Session-Endpunkte als Neon Auth (inkl. JWT)
 *          - die echte Neon Function `gamemaster` als HTTP-Server
 *          → beweist Datenbank, Auth-Schutz, Object Storage, AI Gateway und
 *            die Function inkl. Zusammenspiel (Function → Gateway → Postgres →
 *            Live-Zustand der Lobby).
 *
 * Start: npm run test:e2e
 */
import { spawn } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

import {
  startFakeAuth,
  startFakeGateway,
  startFakeS3,
  startPgliteServer,
} from "./dev-mocks.mjs";

const ROOT = path.resolve(import.meta.dirname, "..");
const APP_A_PORT = 3100;
const APP_B_PORT = 3101;
const FUNCTION_PORT = 59090;
const S3_PORT = 59000;
const GATEWAY_PORT = 59080;
const AUTH_PORT = 59070;
const PG_PORT = 55432;

const results = [];
let currentPhase = "A";

function check(name, ok, detail = "") {
  results.push({ phase: currentPhase, name, ok, detail });
  const mark = ok ? "PASS" : "FAIL";
  console.log(`  [${mark}] ${name}${detail ? ` – ${detail}` : ""}`);
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

const running = new Set();

/** Startet einen Dienst in einer eigenen Prozessgruppe, damit `npm run start`
 *  (samt `next start`-Kindprozess) beim Aufräumen wirklich verschwindet. */
function startProcess(command, args, env, { echo = false } = {}) {
  const child = spawn(command, args, {
    cwd: ROOT,
    env: { ...process.env, ...env },
    stdio: ["ignore", "pipe", "pipe"],
    detached: true,
  });
  const logs = [];
  const collect = (data) => {
    const text = String(data);
    logs.push(text);
    if (echo) process.stdout.write(text.replace(/^/gm, "    | "));
  };
  child.stdout.on("data", collect);
  child.stderr.on("data", collect);
  const entry = {
    child,
    logs,
    stop: () =>
      new Promise((resolve) => {
        running.delete(entry);
        if (child.exitCode !== null) return resolve();
        try {
          process.kill(-child.pid, "SIGTERM");
        } catch {
          child.kill("SIGTERM");
        }
        setTimeout(() => {
          try {
            process.kill(-child.pid, "SIGKILL");
          } catch {
            /* schon weg */
          }
          resolve();
        }, 4000);
        child.once("exit", resolve);
      }),
  };
  running.add(entry);
  return entry;
}

/** Notbremse: Bei Abbruch keine verwaisten Server zurücklassen. */
function stopAll() {
  for (const entry of [...running]) void entry.stop();
}
process.on("SIGINT", () => {
  stopAll();
  process.exit(130);
});
process.on("SIGTERM", () => {
  stopAll();
  process.exit(143);
});

/** Verhindert, dass der Test gegen verwaiste Server alter Läufe prüft. */
async function assertPortFree(port, label) {
  try {
    await fetch(`http://127.0.0.1:${port}/api/health`, {
      signal: AbortSignal.timeout(700),
    });
  } catch {
    return; // nichts erreichbar → gut
  }
  throw new Error(
    `Port ${port} (${label}) ist schon belegt – vermutlich ein verwaister Testlauf. ` +
      `Bitte mit \`pkill -f next-server\` aufräumen und erneut starten.`,
  );
}

async function waitForHealth(url, timeoutMs = 60_000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(`${url}/api/health`, { cache: "no-store" });
      if (response.status === 200 || response.status === 503) return true;
    } catch {
      /* noch nicht da */
    }
    await sleep(300);
  }
  return false;
}

const JSON_HEADERS = { "Content-Type": "application/json" };

async function postJson(url, body, headers = {}) {
  const response = await fetch(url, {
    method: "POST",
    headers: { ...JSON_HEADERS, ...headers },
    body: JSON.stringify(body),
  });
  const json = await response.json().catch(() => null);
  return { status: response.status, body: json, headers: response.headers };
}

async function getJson(url, headers = {}) {
  const response = await fetch(url, { headers, cache: "no-store" });
  const json = await response.json().catch(() => null);
  return { status: response.status, body: json, headers: response.headers };
}

/** 1×1 PNG als Data-URL (identisch für Upload und Vergleich). */
const PNG_BASE64 =
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";
const PNG_DATA_URL = `data:image/png;base64,${PNG_BASE64}`;

async function main() {
  const tmp = mkdtempSync(path.join(tmpdir(), "starafk-e2e-"));
  for (const [port, label] of [
    [APP_A_PORT, "App Phase A"],
    [APP_B_PORT, "App Phase B"],
    [FUNCTION_PORT, "Function"],
    [S3_PORT, "S3-Mock"],
    [GATEWAY_PORT, "Gateway-Mock"],
    [AUTH_PORT, "Auth-Mock"],
    [PG_PORT, "Postgres-Mock"],
  ]) {
    await assertPortFree(port, label);
  }
  const appUrlA = `http://127.0.0.1:${APP_A_PORT}`;
  const appUrlB = `http://127.0.0.1:${APP_B_PORT}`;

  /* ----------------------------- Phase A ----------------------------- */
  console.log("\n=== Phase A: App ohne Neon-Dienste (PGlite, Data-URL-Avatare) ===");
  const appA = startProcess("npm", ["run", "start"], {
    PORT: String(APP_A_PORT),
    PGLITE_DIR: path.join(tmp, "pglite-a"),
    DATABASE_URL: "",
    NEON_AUTH_BASE_URL: "",
    AWS_ENDPOINT_URL_S3: "",
    NEON_AI_GATEWAY_BASE_URL: "",
  });

  let healthyA = false;
  try {
    healthyA = await waitForHealth(appUrlA);
    check("App startet (next start)", healthyA, healthyA ? appUrlA : appA.logs.join("").slice(-400));
    if (!healthyA) throw new Error("App (Phase A) nicht erreichbar");

    const health = await getJson(`${appUrlA}/api/health`);
    check("Health: Postgres-Modus = pglite", health.body?.db === "pglite");
    check(
      "Health: keine Neon-Dienste aktiv",
      health.body?.services?.auth === false &&
        health.body?.services?.objectStorage === false &&
        health.body?.services?.aiGateway === false &&
        health.body?.services?.functions === false,
      JSON.stringify(health.body?.services),
    );

    const config = await getJson(`${appUrlA}/api/config`);
    check(
      "Config: Login aus, Game Master aus",
      config.body?.auth?.enabled === false && config.body?.gameMaster?.enabled === false,
    );

    const host = await postJson(`${appUrlA}/api/lobby/create`, {
      mode: "WERWOLF",
      profile: { name: "Host", color: "#ff0000", fadeIntensity: 60, frame: "none" },
    });
    check("Lobby anlegen (ohne Login erlaubt)", host.body?.ok === true && !!host.body?.selfId);
    check("Lobby-Zustand enthält `narration`", host.body?.lobby?.narration === null);
    const code = host.body?.lobby?.code;
    const hostId = host.body?.selfId;

    const guest = await postJson(`${appUrlA}/api/lobby/join`, {
      code,
      profile: { name: "Gast", color: "#00ff00" },
    });
    check("Zweiter Spieler tritt bei", guest.body?.ok === true);
    check("Zwei Spieler im Zustand", guest.body?.lobby?.players?.length === 2);

    const avatar = await postJson(`${appUrlA}/api/lobby/avatar`, {
      code,
      playerId: hostId,
      image: PNG_DATA_URL,
    });
    check("Profilbild hochladen (Fallback: Data-URL)", avatar.body?.ok === true && !!avatar.body?.url);
    const avatarGet = await fetch(`${appUrlA}${avatar.body?.url}`);
    const avatarBytes = Buffer.from(await avatarGet.arrayBuffer());
    check(
      "Profilbild ausliefern (Cache-Header, 1×1 PNG)",
      avatarGet.status === 200 &&
        avatarGet.headers.get("content-type") === "image/png" &&
        String(avatarGet.headers.get("cache-control")).includes("immutable") &&
        avatarBytes.toString("base64") === PNG_BASE64,
    );

    const roles = await postJson(`${appUrlA}/api/lobby/roles`, {
      code,
      playerId: hostId,
      roleCounts: { Werwolf: 1, Seher: 1, Dorfbewohner: 2 },
    });
    check("Rollen-Setup speichern (Host)", roles.body?.ok === true);
    const start = await postJson(`${appUrlA}/api/lobby/start`, {
      code,
      playerId: hostId,
      started: true,
    });
    check("Spiel starten (Host)", start.body?.ok === true);
    const state = await getJson(`${appUrlA}/api/lobby/state?code=${code}&pid=${hostId}`);
    check("Zustand abfragen", state.body?.ok === true && state.body?.state?.gameStarted === true);
    const leave = await postJson(`${appUrlA}/api/lobby/leave`, { code, playerId: guest.body?.selfId });
    check("Lobby verlassen", leave.body?.ok === true);
  } finally {
    await appA.stop();
  }

  /* ----------------------------- Phase B ----------------------------- */
  currentPhase = "B";
  console.log("\n=== Phase B: Neon-Dienste (Postgres-Socket, S3, Gateway, Auth, Function) ===");
  const pglite = await startPgliteServer({ port: PG_PORT, dataDir: path.join(tmp, "pg-b") });
  const s3 = await startFakeS3({ port: S3_PORT });
  const gateway = await startFakeGateway({ port: GATEWAY_PORT });
  const auth = await startFakeAuth({ port: AUTH_PORT });

  const functionEnv = {
    PORT: String(FUNCTION_PORT),
    DATABASE_URL: pglite.url,
    NEON_AI_GATEWAY_BASE_URL: `http://127.0.0.1:${GATEWAY_PORT}`,
    NEON_AI_GATEWAY_TOKEN: "nt_live_mock",
    NEON_AUTH_BASE_URL: auth.issuer,
    NEON_AUTH_JWKS_URL: auth.jwksUrl,
    NEON_BRANCH: "production",
  };
  const fn = startProcess(
    "node",
    ["--experimental-strip-types", "scripts/serve-function.mjs"],
    functionEnv,
    { echo: true },
  );

  const appB = startProcess("npm", ["run", "start"], {
    PORT: String(APP_B_PORT),
    PGLITE_DIR: "",
    DATABASE_URL: pglite.url,
    DATABASE_SSL: "false",
    NEON_AUTH_BASE_URL: auth.issuer,
    NEON_AUTH_COOKIE_SECRET: "e2e-cookie-secret-0123456789-0123456789",
    NEON_AUTH_JWKS_URL: auth.jwksUrl,
    AWS_ACCESS_KEY_ID: "mock-access-key",
    AWS_SECRET_ACCESS_KEY: "mock-secret-key",
    AWS_ENDPOINT_URL_S3: `http://127.0.0.1:${S3_PORT}`,
    AWS_REGION: "us-east-1",
    NEON_AI_GATEWAY_BASE_URL: `http://127.0.0.1:${GATEWAY_PORT}`,
    NEON_AI_GATEWAY_TOKEN: "nt_live_mock",
    NEON_FUNCTION_GAMEMASTER_BASE_URL: `http://127.0.0.1:${FUNCTION_PORT}`,
  });

  try {
    const healthyB = await waitForHealth(appUrlB);
    check("App startet mit Neon-Umgebung", healthyB, healthyB ? appUrlB : appB.logs.join("").slice(-400));
    if (!healthyB) throw new Error("App (Phase B) nicht erreichbar");

    const health = await getJson(`${appUrlB}/api/health`);
    check(
      "Health: Postgres extern (DATABASE_URL)",
      health.body?.db === "postgres",
      `db=${health.body?.db}`,
    );
    check(
      "Health: Auth + Bucket + Gateway + Function erkannt",
      health.body?.services?.auth === true &&
        health.body?.services?.objectStorage === "bucket:assets" &&
        health.body?.services?.aiGateway === true &&
        health.body?.services?.functions === true,
      JSON.stringify(health.body?.services),
    );

    // --- Neon Auth über die App-Route (Proxy → Auth-Server) ---
    const email = `host${Date.now()}@example.com`;
    const signUp = await fetch(`${appUrlB}/api/auth/sign-up/email`, {
      method: "POST",
      headers: JSON_HEADERS,
      body: JSON.stringify({ email, password: "geheim12345", name: "Host" }),
    });
    const cookies = signUp.headers.getSetCookie().map((entry) => entry.split(";")[0]);
    check("Auth: Sign-up über /api/auth/*", signUp.status === 200, `status=${signUp.status}`);
    check("Auth: Session-Cookie gesetzt", cookies.length > 0, cookies.join(" | ").slice(0, 120));

    const session = await getJson(`${appUrlB}/api/auth/get-session`, { Cookie: cookies.join("; ") });
    check(
      "Auth: get-session liefert den Nutzer",
      Boolean(session.body?.user?.email === email),
      JSON.stringify(session.body)?.slice(0, 120),
    );

    const unauthorized = await postJson(`${appUrlB}/api/lobby/create`, {
      mode: "WERWOLF",
      profile: { name: "Anonym" },
    });
    check("API geschützt: Lobby anlegen ohne Session → 401", unauthorized.status === 401);

    const host = await postJson(
      `${appUrlB}/api/lobby/create`,
      { mode: "WERWOLF", profile: { name: "Host", color: "#ff0000" } },
      { Cookie: cookies.join("; ") },
    );
    check("Lobby anlegen mit Session", host.body?.ok === true, `status=${host.status}`);
    const code = host.body?.lobby?.code;
    const hostId = host.body?.selfId;

    // --- Neon Object Storage (echtes S3-Protokoll über das AWS SDK) ---
    const upload = await postJson(
      `${appUrlB}/api/lobby/avatar`,
      { code, playerId: hostId, image: PNG_DATA_URL },
      { Cookie: cookies.join("; ") },
    );
    check("Object Storage: Upload über die App", upload.body?.ok === true, JSON.stringify(upload.body));

    const keys = s3.keys();
    const avatarKey = keys.find((key) => key.includes("/avatars/"));
    const stored = avatarKey ? s3.get(avatarKey) : null;
    check(
      "Object Storage: Objekt liegt im Bucket `assets`",
      Boolean(stored) && stored.body.toString("base64") === PNG_BASE64,
      avatarKey ?? keys.join(", "),
    );

    const avatarGet = await fetch(`${appUrlB}${upload.body?.url}`);
    const avatarBytes = Buffer.from(await avatarGet.arrayBuffer());
    check(
      "Object Storage: Auslieferung über /api/lobby/avatar",
      avatarGet.status === 200 &&
        avatarBytes.toString("base64") === PNG_BASE64 &&
        avatarGet.headers.get("content-type") === "image/png",
    );

    const dbRows = await pglite.query(
      "SELECT image, image_key FROM players WHERE id = $1",
      [hostId],
    );
    check(
      "Postgres: nur der Bucket-Key steht in der Zeile (keine Bilddaten)",
      dbRows.rows?.[0]?.image === null && typeof dbRows.rows?.[0]?.image_key === "string",
      JSON.stringify(dbRows.rows?.[0]),
    );

    // --- AI Game Master: Browser holt JWT, ruft die Neon Function, Text landet in Postgres ---
    const tokenResponse = await getJson(`${appUrlB}/api/auth/token`, { Cookie: cookies.join("; ") });
    const jwt = tokenResponse.body?.token;
    check("Auth: JWT über /api/auth/token", typeof jwt === "string" && jwt.split(".").length === 3);

    const noToken = await postJson(
      `http://127.0.0.1:${FUNCTION_PORT}/narration`,
      { code, kind: "intro", playerId: hostId },
    );
    check("Function: ohne JWT → 401", noToken.status === 401);

    const narration = await postJson(
      `http://127.0.0.1:${FUNCTION_PORT}/narration`,
      { code, kind: "intro", playerId: hostId },
      { Authorization: `Bearer ${jwt}` },
    );
    check(
      "Function: erzeugt Text über das AI Gateway",
      narration.body?.ok === true && typeof narration.body?.narration?.text === "string",
      JSON.stringify(narration.body)?.slice(0, 200),
    );
    check(
      "Function: Modell aus /v1/models gewählt",
      narration.body?.narration?.model === "mock/werwolf-mini",
      `model=${narration.body?.narration?.model}`,
    );
    check(
      "Function: Anfrage kam am Gateway an (deutscher Prompt)",
      gateway.calls.length >= 1 &&
        String(gateway.calls[0]?.messages?.[0]?.content ?? "").includes("Spielleiter"),
    );

    const state = await getJson(`${appUrlB}/api/lobby/state?code=${code}&pid=${hostId}`, {
      Cookie: cookies.join("; "),
    });
    check(
      "Zusammenspiel: Game-Master-Text erscheint im Live-Zustand",
      state.body?.state?.narration?.text === narration.body?.narration?.text &&
        state.body?.state?.narration?.kind === "intro",
      JSON.stringify(state.body?.state?.narration)?.slice(0, 140),
    );

    const lineCount = await pglite.query("SELECT count(*)::int AS n FROM game_master_lines");
    check("Postgres: Text wurde persistiert", lineCount.rows?.[0]?.n === 1, JSON.stringify(lineCount.rows?.[0]));
  } finally {
    await appB.stop();
    await fn.stop();
    await auth.stop();
    await gateway.stop();
    await s3.stop();
    await pglite.stop();
    rmSync(tmp, { recursive: true, force: true });
  }

  /* ------------------------------ Bilanz ----------------------------- */
  const failed = results.filter((entry) => !entry.ok);
  console.log(
    `\n=== Ergebnis: ${results.length - failed.length}/${results.length} Prüfungen bestanden ===`,
  );
  for (const entry of failed) {
    console.log(`  FAIL (Phase ${entry.phase}): ${entry.name} ${entry.detail}`);
  }
  process.exit(failed.length === 0 ? 0 : 1);
}

main().catch((error) => {
  console.error("\nE2E-Test abgebrochen:", error);
  process.exit(1);
});
