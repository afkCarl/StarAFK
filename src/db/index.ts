import { drizzle as drizzleNodePg } from "drizzle-orm/node-postgres";
import { Pool, type PoolConfig } from "pg";

/**
 * PGlite wird AUSSCHLIESSLICH als Typ importiert (`import type` verschwindet
 * beim Kompilieren). Grund: RAM.
 *
 * Gemessen (Node 22, `process.memoryUsage.rss()`):
 *   - `new PGlite(); await db.waitReady`        → +456 MB  (!)
 *   - kompletter `next start` mit PGlite        →  596 MB RSS
 *   - `node:sqlite` (`DatabaseSync`)            →   +1,6 MB RSS
 *   - kompletter `next start` mit SQLite        →  133 MB RSS
 *
 * Deshalb nutzt die App ohne externe `DATABASE_URL` standardmäßig die in
 * Node 22 eingebaute native SQLite-Datenbank (`node:sqlite` über
 * `drizzle-orm/pg-proxy`, gespeichert unter `.data/starafk.sqlite`). Damit
 * funktionieren „Lobby erstellen" und „Lobby beitreten" sofort – sowohl lokal
 * als auch auf Render (512 MB Free-Plan) – ohne einen Container zu sprengen.
 * Mit `PGLITE_IN_PRODUCTION=1` kann weiterhin explizit PGlite erzwungen werden.
 */
import type { PGlite as PGliteClient } from "@electric-sql/pglite";
import type { DatabaseSync as SqliteDatabaseSync } from "node:sqlite";

import { ensureSchema } from "@/db/migrate";

type Database = ReturnType<typeof drizzleNodePg>;

export type DbMode = "postgres" | "pglite";
export type DbStorage = "external" | "file" | "memory" | "none";

interface DbGlobals {
  pool?: Pool;
  db?: Database;
  pglite?: PGliteClient;
  sqlite?: SqliteDatabaseSync;
  pgliteInit?: Promise<Database>;
  pgliteStorage: DbStorage;
  /** Ist die externe DB ausgefallen und wir laufen im eingebetteten Fallback? */
  usingEmbeddedFallback?: boolean;
  /** Blockade-Hinweis nur EINMAL pro Prozess loggen (kein Log-Spam). */
  pgliteBlockLogged?: boolean;
  schemaInit?: WeakMap<object, Promise<void>>;
  failures: number;
  resets: number;
  ready: boolean;
  lastError?: string;
}

function globals(): DbGlobals {
  const g = globalThis as typeof globalThis & { __starafkDb?: DbGlobals };
  g.__starafkDb ??= {
    pgliteStorage: "none",
    failures: 0,
    resets: 0,
    ready: false,
  };
  return g.__starafkDb;
}

/**
 * Verbindungs-String der externen Datenbank – ganz ohne Handarbeit:
 * 1. `DATABASE_URL` – wird gesetzt, sobald eine eigene Datenbank (z. B. Neon)
 *    angebunden ist; diese Angabe gewinnt immer.
 * 2. `AUTO_DATABASE_URL` – wird von `render.yaml` automatisch mit der im
 *    Blueprint mit-provisionierten Datenbank befüllt (kein Eintragen nötig).
 * Ohne beides startet die eingebettete Datenbank (SQLite bzw. PGlite).
 */
export function resolveDatabaseUrl(): string | undefined {
  const own = process.env.DATABASE_URL?.trim();
  if (own) return sanitizeDatabaseUrl(own);
  const auto = process.env.AUTO_DATABASE_URL?.trim();
  if (auto) return sanitizeDatabaseUrl(auto);
  return undefined;
}

/**
 * Neon gibt im Dashboard Verbindungs-Strings mit `channel_binding=require`
 * aus. Der `pg`-Treiber unterstützt kein SCRAM-Channel-Binding und würde
 * die Verbindung sonst ablehnen – der Parameter wird deshalb entfernt.
 * TLS bleibt über `sslmode` / die Host-Erkennung (siehe `sslFor`) aktiv.
 */
function sanitizeDatabaseUrl(raw: string): string {
  try {
    const url = new URL(raw);
    if (url.searchParams.has("channel_binding")) {
      url.searchParams.delete("channel_binding");
      return url.toString();
    }
    return raw;
  } catch {
    return raw;
  }
}

export type DbProvider = "neon" | "postgres" | "pglite";

/** Anbieter der aktiven Datenbank (nur für Anzeige/Health – ohne Secrets). */
export function getDbProvider(): DbProvider {
  const g = globals();
  if (g.usingEmbeddedFallback) return "pglite";
  const url = resolveDatabaseUrl();
  if (!url) return "pglite";
  try {
    if (/\.neon\.tech$/i.test(new URL(url).hostname)) return "neon";
  } catch {
    /* kein URL-Format → unten allgemein als Postgres melden */
  }
  return "postgres";
}

/**
 * Welche Datenbank-Variante gerade aktiv ist:
 * - `postgres`: externe PostgreSQL-Instanz (Neon oder automatisch von Render
 *   provisioniert – siehe `resolveDatabaseUrl`)
 * - `pglite`: eingebettete Datenbank im Ordner `.data/` –
 *   null Konfiguration nötig, ideal für einen einfachen Start.
 */
export function getDbMode(): DbMode {
  const g = globals();
  if (g.usingEmbeddedFallback) return "pglite";
  return resolveDatabaseUrl() ? "postgres" : "pglite";
}

function envFlag(name: string): boolean {
  const raw = (process.env[name] ?? "").trim().toLowerCase();
  return raw === "1" || raw === "true" || raw === "yes" || raw === "on";
}

/**
 * Fehler, den ein Neuaufbau der Verbindung NICHT beheben kann (fehlende
 * Konfiguration). Wichtig, damit `noteDbFailure` nicht endlos Pools verwirft
 * und `resets` in `/api/health` ins Uferlose steigt.
 */
export class DbUnavailableError extends Error {
  readonly permanent = true;
  constructor(message: string) {
    super(message);
    this.name = "DbUnavailableError";
  }
}

export function isPermanentDbError(error: unknown): boolean {
  return Boolean((error as { permanent?: unknown } | null)?.permanent);
}

export type PglitePolicy =
  | { allowed: true }
  | { allowed: false; reason: string; hint: string };

/**
 * Die eingebettete Datenbank ist immer erlaubt: Standardmäßig läuft das
 * leichtgewichtige native `node:sqlite` (~1,6 MB RAM), und mit
 * `PGLITE_IN_PRODUCTION=1` auf Wunsch auch WASM-PGlite.
 */
export function pglitePolicy(): PglitePolicy {
  return { allowed: true };
}

export interface DbStatus {
  mode: DbMode;
  /** Konkreter Anbieter: `neon`, sonstiges externes `postgres` oder `pglite`. */
  provider: DbProvider;
  storage: DbStorage;
  /** Letzte Datenbank-Aktion war erfolgreich (Schema angelegt, Abfrage ok). */
  ready: boolean;
  /** Fehler in Folge (0 = alles gut). */
  failures: number;
  /** Wie oft die Verbindung bereits automatisch neu aufgebaut wurde. */
  resets: number;
  lastError?: string;
  notice?: string;
}

export function dbStatus(): DbStatus {
  const g = globals();
  const mode = getDbMode();
  return {
    mode,
    provider: getDbProvider(),
    storage: mode === "postgres" ? "external" : g.pgliteStorage,
    ready: g.ready,
    failures: g.failures,
    resets: g.resets,
    ...(g.lastError ? { lastError: g.lastError } : {}),
  };
}

function errorMessage(error: unknown): string {
  if (error instanceof Error) return error.message.slice(0, 300);
  return String(error).slice(0, 300);
}

function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(
      () => reject(new Error(`${label} hat nach ${ms} ms nicht geantwortet`)),
      ms,
    );
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error: unknown) => {
        clearTimeout(timer);
        reject(error);
      },
    );
  });
}

async function resolveDataDir(): Promise<string> {
  if (process.env.PGLITE_DIR) return process.env.PGLITE_DIR;
  const path = await import("node:path");
  const cwd = typeof process.cwd === "function" ? process.cwd() : ".";
  return path.join(cwd, ".data", "pglite");
}

/* ------------------------------------------------------------------ *
 * Eingebettete SQLite-Datenbank (`node:sqlite` + `drizzle-orm/pg-proxy`)
 * Braucht nur ~1,6 MB RAM und läuft damit auch im 512-MB-Container auf
 * Render stabil und dauerhaft.
 * ------------------------------------------------------------------ */

const SQLITE_SCHEMA = `
  PRAGMA foreign_keys = ON;
  PRAGMA busy_timeout = 5000;
  CREATE TABLE IF NOT EXISTS lobbies (
    code TEXT PRIMARY KEY,
    mode TEXT NOT NULL DEFAULT 'WERWOLF',
    role_counts TEXT NOT NULL,
    game_started INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
  );
  CREATE TABLE IF NOT EXISTS players (
    id TEXT PRIMARY KEY,
    lobby_code TEXT NOT NULL REFERENCES lobbies(code) ON DELETE CASCADE,
    user_id TEXT,
    name TEXT NOT NULL,
    color TEXT NOT NULL,
    fade_intensity INTEGER NOT NULL DEFAULT 50,
    frame TEXT NOT NULL DEFAULT 'none',
    image TEXT,
    image_key TEXT,
    image_updated_at TEXT,
    is_host INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
    last_seen TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
  );
  CREATE INDEX IF NOT EXISTS players_lobby_code_idx ON players (lobby_code);
  CREATE INDEX IF NOT EXISTS players_last_seen_idx ON players (last_seen);
  CREATE INDEX IF NOT EXISTS players_user_id_idx ON players (user_id);
  CREATE INDEX IF NOT EXISTS lobbies_created_at_idx ON lobbies (created_at);
  CREATE TABLE IF NOT EXISTS game_master_lines (
    id TEXT PRIMARY KEY,
    lobby_code TEXT NOT NULL REFERENCES lobbies(code) ON DELETE CASCADE,
    kind TEXT NOT NULL,
    text TEXT NOT NULL,
    model TEXT,
    created_by TEXT,
    created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
  );
  CREATE INDEX IF NOT EXISTS game_master_lines_lobby_idx
    ON game_master_lines (lobby_code, created_at DESC);
  DELETE FROM players WHERE last_seen < strftime('%Y-%m-%dT%H:%M:%fZ', 'now', '-7 days');
`;

const SQLITE_BOOL_COLUMNS = new Set(["game_started", "is_host"]);

function rewriteSqliteInsertDefaults(
  query: string,
  params: unknown[],
  makeUuid: () => string,
): { query: string; params: unknown[] } {
  const match =
    /^insert\s+into\s+"([^"]+)"\s*\(([^)]+)\)\s*values\s*\(([^)]+)\)(.*)$/is.exec(
      query,
    );
  if (!match) return { query, params };
  const [, table, colsRaw, valsRaw, rest] = match;
  const cols = colsRaw.split(",").map((part) => part.trim());
  const vals = valsRaw.split(",").map((part) => part.trim());
  if (cols.length !== vals.length) return { query, params };

  const newCols: string[] = [];
  const newVals: string[] = [];
  const nextParams = [...params];

  for (let i = 0; i < cols.length; i += 1) {
    const colName = cols[i].replace(/"/g, "");
    if (vals[i].toLowerCase() === "default") {
      if (colName === "id") {
        nextParams.push(makeUuid());
        newCols.push(cols[i]);
        newVals.push(`$${nextParams.length}`);
      }
      // Andere `default`-Spalten weglassen, damit SQLite den Spalten-DEFAULT nutzt.
    } else {
      newCols.push(cols[i]);
      newVals.push(vals[i]);
    }
  }

  return {
    query: `insert into "${table}" (${newCols.join(", ")}) values (${newVals.join(", ")})${rest}`,
    params: nextParams,
  };
}

async function initSqlite(): Promise<Database> {
  const g = globals();
  const [{ mkdirSync }, path, { randomUUID }, { DatabaseSync }, { drizzle }] =
    await Promise.all([
      import("node:fs"),
      import("node:path"),
      import("node:crypto"),
      import("node:sqlite"),
      import("drizzle-orm/pg-proxy"),
    ]);

  const baseDir = await resolveDataDir();
  const dbFile = path.join(baseDir, "starafk.sqlite");

  let sqlite: SqliteDatabaseSync;
  try {
    mkdirSync(baseDir, { recursive: true });
    sqlite = new DatabaseSync(dbFile);
    try {
      sqlite.exec("PRAGMA journal_mode = WAL; PRAGMA synchronous = NORMAL;");
    } catch {
      /* WAL optional */
    }
    g.pgliteStorage = "file";
  } catch (error) {
    console.warn(
      `[db] SQLite konnte ${dbFile} nicht öffnen – weiter im Speicher-Modus (:memory:).`,
      error,
    );
    sqlite = new DatabaseSync(":memory:");
    g.pgliteStorage = "memory";
  }

  sqlite.exec(SQLITE_SCHEMA);
  g.sqlite = sqlite;

  const proxyDb = drizzle(async (rawQuery, rawParams, method) => {
    const trimmed = rawQuery.trim();
    // Postgres-spezifische Migrations-Statements aus ensureSchema() überspringen
    // (das Schema wurde bereits über SQLITE_SCHEMA angelegt).
    if (
      rawParams.length === 0 &&
      /^(create\s+table|create\s+index|alter\s+table|update\s+players\s+set\s+image_updated_at|delete\s+from\s+players\s+where\s+last_seen)/i.test(
        trimmed,
      )
    ) {
      return { rows: [] };
    }

    const { query, params } = rewriteSqliteInsertDefaults(
      trimmed,
      rawParams,
      randomUUID,
    );

    const bound: (string | number | bigint | Uint8Array | null)[] = [];
    const sqliteSql = query.replace(/\$(\d+)/g, (_, idx: string) => {
      const val = params[Number(idx) - 1];
      if (val === undefined || val === null) {
        bound.push(null);
      } else if (typeof val === "boolean") {
        bound.push(val ? 1 : 0);
      } else if (val instanceof Date) {
        bound.push(val.toISOString());
      } else if (typeof val === "number" || typeof val === "bigint" || typeof val === "string") {
        bound.push(val);
      } else if (val instanceof Uint8Array) {
        bound.push(val);
      } else {
        bound.push(JSON.stringify(val));
      }
      return "?";
    });

    const stmt = sqlite.prepare(sqliteSql);
    const columns = stmt.columns();
    if (method === "execute" || columns.length === 0) {
      stmt.run(...bound);
      return { rows: [] };
    }

    const colNames = columns.map((col) => col.name);
    stmt.setReturnArrays(true);
    const rawRows = stmt.all(...bound) as unknown as unknown[][];
    const rows = rawRows.map((row) =>
      row.map((val, idx) =>
        SQLITE_BOOL_COLUMNS.has(colNames[idx]) && typeof val === "number"
          ? val !== 0
          : val,
      ),
    );
    return { rows };
  }) as unknown as Database;

  g.schemaInit ??= new WeakMap<object, Promise<void>>();
  g.schemaInit.set(proxyDb, Promise.resolve());
  g.db = proxyDb;
  g.ready = true;
  return proxyDb;
}

/**
 * Lädt PGlite und den passenden Drizzle-Treiber – nur wenn explizit über
 * `PGLITE_IN_PRODUCTION=1` angefordert.
 */
async function loadPgliteModules(): Promise<{
  create: (dir: string | null) => Promise<PGliteClient>;
  wrap: (client: PGliteClient) => Database;
}> {
  const [{ mkdirSync }, { PGlite }, { drizzle }] = await Promise.all([
    import("node:fs"),
    import("@electric-sql/pglite"),
    import("drizzle-orm/pglite"),
  ]);
  return {
    create: async (dir) => {
      if (dir) mkdirSync(dir, { recursive: true });
      const client = dir ? new PGlite(dir) : new PGlite();
      await withTimeout(client.waitReady, 30_000, "PGlite-Start");
      return client;
    },
    wrap: (client) => drizzle(client) as unknown as Database,
  };
}

async function initEmbeddedDatabase(): Promise<Database> {
  const g = globals();

  // Nur wenn explizit PGLITE_IN_PRODUCTION=1 gesetzt ist (z. B. E2E-Test Phase A
  // oder RAM-Messung --scenario pglite), das WASM-PGlite starten; sonst immer
  // das leichtgewichtige native SQLite (~1,6 MB RAM) nutzen.
  if (!envFlag("PGLITE_IN_PRODUCTION")) {
    return initSqlite();
  }

  const { create, wrap } = await loadPgliteModules();
  const dir = await resolveDataDir();
  let client: PGliteClient;
  try {
    client = await create(dir);
    g.pgliteStorage = "file";
  } catch (error) {
    console.warn(
      `[db] PGlite konnte ${dir} nicht öffnen (z. B. read-only Dateisystem) – ` +
        `weiter im Speicher-Modus. Lobbys überleben dann keinen Neustart, ` +
        `für dauerhafte Lobbys DATABASE_URL setzen.`,
      error,
    );
    client = await create(null);
    g.pgliteStorage = "memory";
  }
  g.pglite = client;
  g.db = wrap(client);
  return g.db;
}

function getEmbeddedDatabase(): Promise<Database> {
  const g = globals();
  // Singleton pro Prozess – wichtig für Next.js Dev-Hot-Reload und
  // parallele erste Anfragen.
  g.pgliteInit ??= initEmbeddedDatabase().catch((error: unknown) => {
    // Entscheidend: einen fehlgeschlagenen Start NICHT dauerhaft cachen.
    // Sonst liefert jede weitere Anfrage bis zum nächsten Neustart 500er.
    g.pgliteInit = undefined;
    throw error;
  });
  return g.pgliteInit;
}

function sslFor(connectionString: string): PoolConfig["ssl"] {
  const explicit = (process.env.DATABASE_SSL ?? "").toLowerCase();
  if (explicit === "false" || explicit === "disable") return undefined;
  if (explicit === "true" || explicit === "require") {
    return { rejectUnauthorized: false };
  }

  let host = "";
  try {
    host = new URL(connectionString).hostname;
  } catch {
    /* Verbindungs-String ohne URL-Form – unten ohne TLS versuchen. */
  }
  if (!host || host === "localhost" || host === "127.0.0.1" || host === "::1") {
    return undefined;
  }
  if (/sslmode=(require|prefer|verify-ca|verify-full)/i.test(connectionString)) {
    return { rejectUnauthorized: false };
  }
  // Gängige Managed-Anbieter verlangen TLS ohne öffentliches CA-Zertifikat.
  if (
    /(\.neon\.tech|\.supabase\.(co|com|net)|\.render\.com|\.railway\.app|\.aivencloud\.com|\.timescale\.com|\.fly\.io)$/i.test(
      host,
    )
  ) {
    return { rejectUnauthorized: false };
  }
  return undefined;
}

function poolOptions(connectionString: string): PoolConfig {
  const configured = Number(process.env.DATABASE_POOL_MAX ?? 4);
  return {
    connectionString,
    max: Number.isFinite(configured) && configured > 0 ? configured : 4,
    // Bewusst kürzer als das Zeitlimit der API-Aufrufe im Browser (15 s) –
    // so antwortet die API mit einem klaren Fehler statt ins Leere zu laufen.
    // 10 s geben einer gerade aufwachenden Neon-Datenbank (Scale-to-Zero)
    // genug Zeit für den ersten Verbindungsaufbau.
    connectionTimeoutMillis: 10_000,
    // Einzelne Anfrage nie länger als 20 s hängen lassen.
    query_timeout: 20_000,
    statement_timeout: 20_000,
    idleTimeoutMillis: 30_000,
    allowExitOnIdle: true,
    keepAlive: true,
    keepAliveInitialDelayMillis: 10_000,
    ssl: sslFor(connectionString),
  };
}

async function initSchema(db: Database): Promise<void> {
  const g = globals();
  g.schemaInit ??= new WeakMap<object, Promise<void>>();
  let pending = g.schemaInit.get(db);
  if (!pending) {
    pending = ensureSchema(db);
    g.schemaInit.set(db, pending);
  }
  try {
    await pending;
    g.ready = true;
  } catch (error) {
    // Nächster Aufruf versucht es erneut (statt dauerhaft zu scheitern).
    g.schemaInit.delete(db);
    g.ready = false;
    throw error;
  }
}

/**
 * Liefert die Datenbank-Verbindung und stellt beim ersten Aufruf sicher,
 * dass alle Tabellen existieren (völlig automatisch – ohne manuelle
 * Migrationsschritte). API-Handler rufen dies asynchron auf, weil `next build`
 * Route-Module ohne Runtime-Secrets importiert.
 */
async function getDbOnce(): Promise<Database> {
  const g = globals();
  const databaseUrl = resolveDatabaseUrl();

  let db: Database;
  if (databaseUrl && !g.usingEmbeddedFallback) {
    if (!g.db) {
      const pool = new Pool(poolOptions(databaseUrl));
      // Ohne diesen Handler kann ein Fehler einer idle-Verbindung den ganzen
      // Node-Prozess beenden (und damit alle Lobbys "verschwinden lassen").
      pool.on("error", (error) => {
        console.error("[db] Fehler auf einer idle-Pool-Verbindung", error);
        noteDbFailure(error);
      });
      g.pool = pool;
      g.db = drizzleNodePg(pool);
    }
    db = g.db;
  } else {
    db = await getEmbeddedDatabase();
  }

  await initSchema(db);
  return db;
}

export async function getDb(): Promise<Database> {
  try {
    return await getDbOnce();
  } catch (error) {
    if (!resolveDatabaseUrl() || globals().usingEmbeddedFallback) throw error;
    console.warn(
      "[db] Datenbankzugriff fehlgeschlagen – Verbindung wird neu aufgebaut und einmal wiederholt.",
      error,
    );
    await resetDb();
    try {
      return await getDbOnce();
    } catch (retryError) {
      console.warn(
        "[db] Externe PostgreSQL-Datenbank weiterhin nicht erreichbar – wechsle automatisch auf eingebettete SQLite-Datenbank, damit Lobbys funktionieren.",
        retryError,
      );
      await resetDb();
      globals().usingEmbeddedFallback = true;
      return getDbOnce();
    }
  }
}

/** Verbindung verwerfen – die nächste Anfrage startet frisch. */
export async function resetDb(): Promise<void> {
  const g = globals();
  const pglite = g.pglite;
  const sqlite = g.sqlite;
  const pool = g.pool;
  g.pglite = undefined;
  g.sqlite = undefined;
  g.pgliteInit = undefined;
  g.pgliteStorage = "none";
  g.db = undefined;
  g.pool = undefined;
  g.schemaInit = undefined;
  g.resets += 1;
  g.ready = false;

  if (pglite) {
    await withTimeout(pglite.close(), 3_000, "PGlite-close").catch(() => {});
  }
  if (sqlite) {
    try {
      sqlite.close();
    } catch {
      /* bereits geschlossen */
    }
  }
  if (pool) {
    await withTimeout(pool.end(), 3_000, "Pool-close").catch(() => {});
  }
}

/**
 * Wird von den API-Routen aufgerufen, wenn eine Anfrage fehlschlägt.
 * Nach mehreren Fehlern in Folge wird die Verbindung automatisch neu
 * aufgebaut – z. B. wenn eine PGlite-Instanz im WASM-Speicher gestorben ist.
 */
export function noteDbFailure(error?: unknown): void {
  const g = globals();
  g.ready = false;
  if (error !== undefined) g.lastError = errorMessage(error);

  if (isPermanentDbError(error)) {
    g.failures = 0;
    return;
  }

  g.failures += 1;
  if (g.failures === 3 || g.failures % 10 === 0) {
    console.error(
      `[db] ${g.failures} Fehler in Folge (${g.lastError ?? "unbekannt"}) – ` +
        `Verbindung wird automatisch neu aufgebaut.`,
    );
    void resetDb();
  }
}

/** Erfolgreiche Anfrage – Fehlerzähler zurücksetzen. */
export function noteDbSuccess(): void {
  const g = globals();
  g.ready = true;
  if (g.failures !== 0) {
    g.failures = 0;
    g.lastError = undefined;
  }
}
