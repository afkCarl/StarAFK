/**
 * Neon Function: `gamemaster` (siehe `functions.gamemaster` in neon.ts).
 *
 * Hostet die AI-Game-Master-Endpunkte, die die Werwolf-App aufruft. Läuft als
 * Neon Function direkt neben der Datenbank (`DATABASE_URL` wird injiziert) und
 * nutzt das Neon AI Gateway für die Texte (Modell wird zur Laufzeit über
 * `/v1/models` ermittelt, damit das Angebot des Accounts passt).
 *
 * Authentifizierung: Der Browser holt sich ein kurzlebiges JWT aus Neon Auth
 * (`authClient.token()`) und schickt es als `Authorization: Bearer …`. Hier wird
 * es gegen die vom Branch injizierte JWKS (`NEON_AUTH_JWKS_URL`) geprüft –
 * niemand sonst kommt an die Endpunkte (die URL ist öffentlich erreichbar!).
 */
import { attachDatabasePool } from "@neon/functions";
import { createRemoteJWKSet, jwtVerify, type JWTPayload } from "jose";
import { Pool } from "pg";

const SERVICE = "gamemaster";
const KINDS = ["intro", "night", "recap"] as const;
type Kind = (typeof KINDS)[number];

const JSON_HEADERS: Record<string, string> = {
  "Content-Type": "application/json; charset=utf-8",
  "Cache-Control": "no-store",
};

/** Der Browser ruft diese Function direkt auf → CORS nötig (Bearer-Token, keine Cookies). */
function corsHeaders(): Record<string, string> {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "authorization, content-type",
    "Access-Control-Max-Age": "86400",
  };
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...JSON_HEADERS, ...corsHeaders() },
  });
}

/* ------------------------------------------------------------------ *
 * Postgres (Pool lebt im Isolate und wird über Requests hinweg geteilt)
 * ------------------------------------------------------------------ */

let pool: Pool | null = null;

function getPool(): Pool {
  if (!pool) {
    pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 5 });
    // Ohne diesen Hook beendet ein idle-Disconnect den Node-Prozess.
    attachDatabasePool(pool);
  }
  return pool;
}

/**
 * Tabellen, die die Function selbst braucht. Die App legt ihr Schema beim
 * ersten Zugriff ebenfalls an (`src/db/migrate.ts`); hier ist es idempotent
 * dupliziert, damit die Function auch dann funktioniert, wenn sie als erste
 * auf eine frische Datenbank trifft.
 */
let schemaReady: Promise<void> | null = null;

function ensureSchema(): Promise<void> {
  schemaReady ??= (async () => {
    await getPool().query(
      `CREATE TABLE IF NOT EXISTS game_master_lines (
         id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
         lobby_code varchar(6) NOT NULL REFERENCES lobbies(code) ON DELETE CASCADE,
         kind text NOT NULL,
         text text NOT NULL,
         model text,
         created_by uuid,
         created_at timestamptz NOT NULL DEFAULT now()
       )`,
    );
    await getPool().query(
      `CREATE INDEX IF NOT EXISTS game_master_lines_lobby_idx
         ON game_master_lines (lobby_code, created_at DESC)`,
    );
  })().catch((error: unknown) => {
    schemaReady = null; // nächster Aufruf versucht es erneut
    throw error;
  });
  return schemaReady;
}

/* ------------------------------------------------------------------ *
 * Auth: JWT aus Neon Auth gegen die Branch-JWKS prüfen
 * ------------------------------------------------------------------ */

let jwks: ReturnType<typeof createRemoteJWKSet> | null = null;

function getJwks(): ReturnType<typeof createRemoteJWKSet> | null {
  const url = process.env.NEON_AUTH_JWKS_URL;
  if (!url) return null;
  jwks ??= createRemoteJWKSet(new URL(url));
  return jwks;
}

async function verifyRequest(request: Request): Promise<JWTPayload | null> {
  const header = request.headers.get("authorization") ?? "";
  if (!header.toLowerCase().startsWith("bearer ")) return null;
  const keySet = getJwks();
  if (!keySet) return null;

  const baseUrl = process.env.NEON_AUTH_BASE_URL;
  const issuer = baseUrl ? new URL(baseUrl).origin : undefined;
  try {
    const { payload } = await jwtVerify(header.slice(7).trim(), keySet, {
      ...(issuer ? { issuer } : {}),
    });
    return payload.sub ? payload : null;
  } catch (error) {
    console.warn(`[${SERVICE}] JWT-Prüfung fehlgeschlagen`, error);
    return null;
  }
}

/* ------------------------------------------------------------------ *
 * AI Gateway (OpenAI-kompatibel, Modell zur Laufzeit ermitteln)
 * ------------------------------------------------------------------ */

type ChatMessage = { role: "system" | "user"; content: string };

function gatewayConfig(): { baseUrl: string; token: string } | null {
  const baseUrl = process.env.NEON_AI_GATEWAY_BASE_URL;
  const token = process.env.NEON_AI_GATEWAY_TOKEN;
  return baseUrl && token ? { baseUrl, token } : null;
}

/** Katalog dieses Branches – der Account kann weniger Modelle freischalten. */
async function listModels(baseUrl: string, token: string): Promise<string[]> {
  try {
    const response = await fetch(`${baseUrl}/v1/models`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!response.ok) return [];
    const body = (await response.json()) as { data?: Array<{ id?: unknown }> };
    return (body.data ?? [])
      .map((entry) => (typeof entry.id === "string" ? entry.id : null))
      .filter((id): id is string => Boolean(id));
  } catch {
    return [];
  }
}

const PREFERRED_PATTERNS = [/gpt-5[^/]*mini/i, /mini/i, /flash/i, /haiku/i, /small/i, /instruct/i];

/** Schnelles, günstiges Chat-Modell wählen; `GAMEMASTER_MODEL` überschreibt. */
async function resolveModel(baseUrl: string, token: string): Promise<string> {
  const configured = process.env.GAMEMASTER_MODEL?.trim();
  if (configured) return configured;

  const models = await listModels(baseUrl, token);
  for (const pattern of PREFERRED_PATTERNS) {
    const match = models.find((id) => pattern.test(id));
    if (match) return match;
  }
  return models[0] ?? "gpt-4o-mini";
}

async function complete(
  messages: ChatMessage[],
  model: string,
): Promise<{ text: string; model: string }> {
  const config = gatewayConfig();
  if (!config) throw new Error("AI Gateway ist nicht konfiguriert");

  const response = await fetch(`${config.baseUrl}/v1/chat/completions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${config.token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      messages,
      temperature: 0.9,
      max_tokens: 400,
    }),
  });

  if (!response.ok) {
    const detail = (await response.text()).slice(0, 300);
    throw new Error(`AI Gateway antwortete ${response.status}: ${detail}`);
  }

  const body = (await response.json()) as {
    model?: string;
    choices?: Array<{ message?: { content?: unknown } }>;
  };
  const content = body.choices?.[0]?.message?.content;
  if (typeof content !== "string" || !content.trim()) {
    throw new Error("AI Gateway lieferte keinen Text");
  }
  return { text: content.trim(), model: body.model ?? model };
}

/* ------------------------------------------------------------------ *
 * Prompt: deutscher Game-Master-Text zur aktuellen Runde
 * ------------------------------------------------------------------ */

type LobbyRow = {
  code: string;
  mode: string;
  role_counts: Record<string, number> | null;
  game_started: boolean;
};

type PlayerRow = { id: string; name: string; is_host: boolean };

function roleSummary(roleCounts: Record<string, number> | null): string {
  const entries = Object.entries(roleCounts ?? {}).filter(([, count]) => count > 0);
  if (entries.length === 0) return "Noch keine Rollen festgelegt.";
  return entries.map(([role, count]) => `${count}× ${role}`).join(", ");
}

function playerSummary(players: PlayerRow[]): string {
  if (players.length === 0) return "Noch niemand da.";
  return players
    .map((player) => `${player.name}${player.is_host ? " (Host)" : ""}`)
    .join(", ");
}

function buildPrompt(kind: Kind, lobby: LobbyRow, players: PlayerRow[]): ChatMessage[] {
  const context = [
    `Spielmodus: ${lobby.mode}`,
    `Spieler (${players.length}): ${playerSummary(players)}`,
    `Rollen-Setup: ${roleSummary(lobby.role_counts)}`,
    `Spiel gestartet: ${lobby.game_started ? "ja" : "nein"}`,
  ].join("\n");

  const task: Record<Kind, string> = {
    intro:
      "Schreibe die stimmungsvolle Eröffnung der Runde: Begrüße die Dorfbewohner, " +
      "erkläre kurz und atmosphärisch, welche Rollen im Spiel sind, und weise darauf hin, " +
      "dass unter ihnen Verräter stecken. Verrate auf keinen Fall, wer welche Rolle hat.",
    night:
      "Schreibe den Einbruch der Nacht: Das Dorf schläft ein, die Werwölfe erwachen. " +
      "Erzeuge Spannung, ohne eine konkrete Nacht-Aktion zu verraten oder Rollen zuzuordnen.",
    recap:
      "Fasse die Lage des Dorfes pointiert zusammen: Wer spielt mit, welche Rollen sind im " +
      "Spiel, wie ist die Stimmung. Keine Rollenzuordnung zu einzelnen Spielern.",
  };

  return [
    {
      role: "system",
      content:
        "Du bist der charismatische Spielleiter (Game Master) einer deutschsprachigen " +
        "Werwolf-Partie. Du sprichst die Gruppe direkt an, atmosphärisch, mit Humor und " +
        "leicht altertümlicher Erzählstimme. Antworte ausschließlich auf Deutsch, in 3–6 " +
        "Sätzen (maximal 120 Wörter), ohne Aufzählungen, ohne Emojis und ohne " +
        "Rollen-Verrat: Du weißt selbst nicht, wer welche Rolle hat.",
    },
    { role: "user", content: `${context}\n\nAufgabe: ${task[kind]}` },
  ];
}

/* ------------------------------------------------------------------ *
 * HTTP-Handler
 * ------------------------------------------------------------------ */

type NarrationBody = { code?: unknown; kind?: unknown; playerId?: unknown };

function normalizeCode(input: unknown): string {
  return String(input ?? "")
    .toUpperCase()
    .replace(/[^A-Z]/g, "")
    .slice(0, 6);
}

const UUID_RE = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;

async function handleNarration(request: Request, path: string): Promise<Response> {
  if (!path.endsWith("/narration") && path !== "/narration") {
    return json({ ok: false, reason: "not_found" }, 404);
  }

  const payload = await verifyRequest(request);
  if (!payload?.sub) {
    return json({ ok: false, reason: "unauthorized" }, 401);
  }

  let body: NarrationBody = {};
  try {
    body = (await request.json()) as NarrationBody;
  } catch {
    return json({ ok: false, reason: "bad_request" }, 400);
  }

  const code = normalizeCode(body.code);
  const kind = String(body.kind ?? "intro") as Kind;
  const playerId = typeof body.playerId === "string" ? body.playerId : "";

  if (code.length !== 6) return json({ ok: false, reason: "bad_request" }, 400);
  if (!KINDS.includes(kind)) return json({ ok: false, reason: "bad_kind" }, 400);
  if (!UUID_RE.test(playerId)) return json({ ok: false, reason: "bad_player" }, 400);

  try {
    await ensureSchema();
    const db = getPool();

    const { rows: lobbies } = await db.query<LobbyRow>(
      `SELECT code, mode, role_counts, game_started FROM lobbies WHERE code = $1`,
      [code],
    );
    const lobby = lobbies[0];
    if (!lobby) return json({ ok: false, reason: "not_found" }, 404);

    const { rows: players } = await db.query<PlayerRow & { user_id: string | null }>(
      `SELECT id, name, is_host, user_id FROM players WHERE lobby_code = $1 ORDER BY created_at`,
      [code],
    );

    // Nur Mitglieder dieser Lobby dürfen Texte erzeugen; ist die Zeile schon mit
    // einem Neon-Auth-Nutzer verknüpft, muss es derselbe sein.
    const self = players.find((player) => player.id === playerId);
    if (!self) return json({ ok: false, reason: "not_member" }, 403);
    if (self.user_id && self.user_id !== payload.sub) {
      return json({ ok: false, reason: "forbidden" }, 403);
    }

    const gateway = gatewayConfig();
    if (!gateway) return json({ ok: false, reason: "gateway_unconfigured" }, 503);

    const model = await resolveModel(gateway.baseUrl, gateway.token);
    const { text, model: usedModel } = await complete(buildPrompt(kind, lobby, players), model);

    const { rows: inserted } = await db.query<{ created_at: Date }>(
      `INSERT INTO game_master_lines (lobby_code, kind, text, model, created_by)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING created_at`,
      [code, kind, text, usedModel, payload.sub],
    );

    return json({
      ok: true,
      narration: {
        code,
        kind,
        text,
        model: usedModel,
        createdAt: inserted[0]?.created_at ?? new Date(),
      },
    });
  } catch (error) {
    console.error(`[${SERVICE}] narration failed`, error);
    return json({ ok: false, reason: "server" }, 500);
  }
}

export default {
  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    const path = url.pathname.replace(/\/+$/, "") || "/";

    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: corsHeaders() });
    }

    if (request.method === "GET" && (path === "/" || path === "/health")) {
      const gateway = gatewayConfig();
      return json({
        ok: true,
        service: SERVICE,
        branch: process.env.NEON_BRANCH ?? null,
        database: Boolean(process.env.DATABASE_URL),
        auth: Boolean(process.env.NEON_AUTH_JWKS_URL),
        aiGateway: Boolean(gateway),
        model: gateway ? await resolveModel(gateway.baseUrl, gateway.token) : null,
      });
    }

    if (request.method === "POST" && path.endsWith("narration")) {
      return handleNarration(request, path);
    }

    return json({ ok: false, reason: "not_found" }, 404);
  },
};
