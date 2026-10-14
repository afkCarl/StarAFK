/**
 * Prüft die Neon-Dienste gegen den ECHTEN Branch – gedacht für den Rechner, auf
 * dem `neon deploy` gelaufen ist (dieser Sandkasten hat keinen Zugang zu Neon).
 *
 *   node --env-file=.env.local scripts/verify-neon.mjs
 *
 * Geprüft werden: Postgres (Verbindung + Tabellen), Neon Auth (JWKS/Session),
 * Object Storage (Put/Get/Delete am echten Bucket), AI Gateway (/v1/models +
 * eine Mini-Completion) und die Neon Function (`/health` + 401-Schutz).
 * Was hier NICHT geprüft werden kann (Login im Browser, Game-Master-Text mit
 * echtem JWT), steht am Ende als „manuell prüfen“ dabei.
 */
import {
  DeleteObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import pg from "pg";

/* .env.local laden, falls nicht per --env-file übergeben. */
try {
  process.loadEnvFile?.(".env.local");
  process.loadEnvFile?.(".env");
} catch {
  /* Datei fehlt oder Node zu alt – dann zählt die Umgebung. */
}

const results = [];
function check(name, ok, detail = "") {
  results.push({ name, ok, detail });
  console.log(`  [${ok ? "PASS" : "FAIL"}] ${name}${detail ? ` – ${detail}` : ""}`);
}
function skip(name, detail = "") {
  results.push({ name, ok: true, skipped: true, detail });
  console.log(`  [SKIP] ${name}${detail ? ` – ${detail}` : ""}`);
}

const BUCKET = process.env.NEON_STORAGE_BUCKET || "assets";

async function checkPostgres() {
  const url = process.env.DATABASE_URL;
  if (!url) return check("Postgres: DATABASE_URL vorhanden", false, "Variable fehlt");
  const pool = new pg.Pool({
    connectionString: url,
    max: 2,
    // Neon verlangt TLS; das Zertifikat ist öffentlich nachprüfbar.
    ssl: /sslmode=(require|prefer|verify)/.test(url) || /\.neon\.tech/.test(url)
      ? { rejectUnauthorized: false }
      : undefined,
    connectionTimeoutMillis: 10_000,
  });
  try {
    const one = await pool.query("select 1 as ok");
    check("Postgres: Verbindung (gepoolte URL)", one.rows[0]?.ok === 1);
    const version = await pool.query("select version() as v");
    console.log(`        ${String(version.rows[0]?.v).slice(0, 70)}…`);
    const tables = await pool.query(
      `select table_name from information_schema.tables
        where table_schema = 'public' and table_name in ('lobbies','players','game_master_lines')`,
    );
    const found = tables.rows.map((row) => row.table_name).sort();
    check(
      "Postgres: Tabellen vorhanden",
      found.length === 3,
      found.join(", ") || "keine – App einmal über /api/health aufrufen (Schema entsteht automatisch)",
    );
    const unpooled = process.env.DATABASE_URL_UNPOOLED;
    check("Postgres: direkte URL vorhanden (für Migrationen)", Boolean(unpooled), unpooled ? "" : "optional");
  } catch (error) {
    check("Postgres: Verbindung", false, String(error?.message ?? error).slice(0, 160));
  } finally {
    await pool.end().catch(() => {});
  }
}

async function checkAuth() {
  const baseUrl = process.env.NEON_AUTH_BASE_URL;
  const jwksUrl = process.env.NEON_AUTH_JWKS_URL;
  if (!baseUrl) return check("Auth: NEON_AUTH_BASE_URL vorhanden", false, "Variable fehlt");
  if (!process.env.NEON_AUTH_COOKIE_SECRET) {
    check(
      "Auth: NEON_AUTH_COOKIE_SECRET gesetzt (≥ 32 Zeichen)",
      false,
      'in .env.local ergänzen: NEON_AUTH_COOKIE_SECRET="$(openssl rand -base64 32)"',
    );
  } else {
    check(
      "Auth: NEON_AUTH_COOKIE_SECRET gesetzt (≥ 32 Zeichen)",
      process.env.NEON_AUTH_COOKIE_SECRET.length >= 32,
      `${process.env.NEON_AUTH_COOKIE_SECRET.length} Zeichen`,
    );
  }

  try {
    const response = await fetch(`${baseUrl.replace(/\/+$/, "")}/get-session`, {
      headers: { Accept: "application/json" },
    });
    check(
      "Auth: Managed-Auth-Server antwortet (/get-session ohne Cookie → 200/null)",
      response.ok,
      `status=${response.status}`,
    );
  } catch (error) {
    check("Auth: Managed-Auth-Server erreichbar", false, String(error?.message ?? error).slice(0, 160));
  }

  if (!jwksUrl) return check("Auth: NEON_AUTH_JWKS_URL vorhanden", false, "Variable fehlt");
  try {
    const response = await fetch(jwksUrl);
    const body = await response.json();
    check(
      "Auth: JWKS liefert Schlüssel (für Function-JWT-Prüfung)",
      Array.isArray(body?.keys) && body.keys.length > 0,
      `${body?.keys?.length ?? 0} Schlüssel`,
    );
  } catch (error) {
    check("Auth: JWKS erreichbar", false, String(error?.message ?? error).slice(0, 160));
  }
  skip("Auth: Sign-up/Sign-in im Browser", "im App-Fenster testen (E-Mail + Passwort)");
}

async function checkStorage() {
  if (!process.env.AWS_ENDPOINT_URL_S3) {
    return check("Object Storage: AWS_* Variablen vorhanden", false, "AWS_ENDPOINT_URL_S3 fehlt");
  }
  const s3 = new S3Client({ forcePathStyle: true });
  const key = `verify/probe-${Date.now()}.txt`;
  const payload = Buffer.from("starafk-storage-probe");
  try {
    await s3.send(
      new PutObjectCommand({ Bucket: BUCKET, Key: key, Body: payload, ContentType: "text/plain" }),
    );
    check("Object Storage: PutObject in Bucket", true, `${BUCKET}/${key}`);

    const object = await s3.send(new GetObjectCommand({ Bucket: BUCKET, Key: key }));
    const bytes = Buffer.from(await object.Body.transformToByteArray());
    check("Object Storage: GetObject liefert die Bytes", bytes.equals(payload));

    await s3.send(new DeleteObjectCommand({ Bucket: BUCKET, Key: key }));
    let deleted = false;
    try {
      await s3.send(new GetObjectCommand({ Bucket: BUCKET, Key: key }));
    } catch {
      deleted = true;
    }
    check("Object Storage: DeleteObject", deleted);
  } catch (error) {
    check("Object Storage: Zugriff", false, String(error?.message ?? error).slice(0, 160));
  }
}

async function checkGateway() {
  const baseUrl = process.env.NEON_AI_GATEWAY_BASE_URL?.replace(/\/+$/, "");
  const token = process.env.NEON_AI_GATEWAY_TOKEN;
  if (!baseUrl || !token) {
    return check("AI Gateway: Variablen vorhanden", false, "BASE_URL/TOKEN fehlen");
  }
  try {
    const response = await fetch(`${baseUrl}/v1/models`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    check("AI Gateway: /v1/models erreichbar", response.ok, `status=${response.status}`);
    const body = await response.json();
    const ids = (body?.data ?? []).map((entry) => entry.id).filter(Boolean);
    check("AI Gateway: Modelle für diesen Branch", ids.length > 0, `${ids.length} Modelle, z. B. ${ids.slice(0, 3).join(", ")}`);

    if (ids.length > 0) {
      const completion = await fetch(`${baseUrl}/v1/chat/completions`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model: ids[0],
          messages: [{ role: "user", content: "Antworte mit genau einem Wort: Bereit?" }],
          max_tokens: 16,
        }),
      });
      const completionBody = await completion.json().catch(() => null);
      const text = completionBody?.choices?.[0]?.message?.content;
      check(
        "AI Gateway: Chat-Completion",
        completion.ok && typeof text === "string" && text.length > 0,
        typeof text === "string" ? JSON.stringify(text.slice(0, 60)) : `status=${completion.status}`,
      );
    }
  } catch (error) {
    check("AI Gateway: Zugriff", false, String(error?.message ?? error).slice(0, 160));
  }
}

async function checkFunction() {
  const url = process.env.NEON_FUNCTION_GAMEMASTER_BASE_URL?.replace(/\/+$/, "");
  if (!url) return check("Function: NEON_FUNCTION_GAMEMASTER_BASE_URL vorhanden", false, "Variable fehlt");
  try {
    const health = await fetch(`${url}/health`);
    const body = await health.json().catch(() => null);
    check(
      "Function: /health",
      health.ok && body?.ok === true,
      JSON.stringify(body).slice(0, 160),
    );
    check(
      "Function: Datenbank + Auth + Gateway injiziert",
      body?.database === true && body?.auth === true && body?.aiGateway === true,
      `db=${body?.database} auth=${body?.auth} aiGateway=${body?.aiGateway} model=${body?.model}`,
    );
    const unauthorized = await fetch(`${url}/narration`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code: "ABCDEF", kind: "intro", playerId: "00000000-0000-0000-0000-000000000000" }),
    });
    check("Function: /narration ohne JWT → 401", unauthorized.status === 401, `status=${unauthorized.status}`);
    skip("Function: /narration mit echtem JWT", "im App-Fenster „AI Game Master“ klicken");
  } catch (error) {
    check("Function: erreichbar", false, String(error?.message ?? error).slice(0, 160));
  }
}

async function main() {
  console.log("Neon-Überprüfung (Werte aus .env.local bzw. der Umgebung)\n");
  console.log("— Neon Postgres —");
  await checkPostgres();
  console.log("\n— Neon Auth —");
  await checkAuth();
  console.log("\n— Neon Object Storage —");
  await checkStorage();
  console.log("\n— Neon AI Gateway —");
  await checkGateway();
  console.log("\n— Neon Function `gamemaster` —");
  await checkFunction();

  const failed = results.filter((entry) => !entry.ok);
  console.log(
    `\nErgebnis: ${results.length - failed.length}/${results.length} Prüfungen bestanden` +
      (failed.length ? ` (FEHLER: ${failed.map((entry) => entry.name).join(" | ")})` : ""),
  );
  process.exit(failed.length === 0 ? 0 : 1);
}

main().catch((error) => {
  console.error("Abbruch:", error);
  process.exit(1);
});
