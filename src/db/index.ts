import { mkdirSync } from "node:fs";
import path from "node:path";

import { PGlite } from "@electric-sql/pglite";
import { drizzle as drizzleNodePg } from "drizzle-orm/node-postgres";
import { drizzle as drizzlePglite } from "drizzle-orm/pglite";
import { Pool, type PoolConfig } from "pg";

import { ensureSchema } from "@/db/migrate";

type Database = ReturnType<typeof drizzleNodePg>;

export type DbMode = "postgres" | "pglite";
export type DbStorage = "external" | "file" | "memory" | "none";

interface DbGlobals {
  pool?: Pool;
  db?: Database;
  pglite?: PGlite;
  pgliteInit?: Promise<Database>;
  pgliteStorage: DbStorage;
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
 * Welche Datenbank-Variante gerade aktiv ist:
 * - `postgres`: externe PostgreSQL-Instanz aus `DATABASE_URL` (empfohlen für Render)
 * - `pglite`: eingebettetes PostgreSQL (PGlite) im Ordner `.data/` –
 *   null Konfiguration nötig, ideal für einen einfachen Start.
 */
export function getDbMode(): DbMode {
  return process.env.DATABASE_URL ? "postgres" : "pglite";
}

export interface DbStatus {
  mode: DbMode;
  storage: DbStorage;
  /** Letzte Datenbank-Aktion war erfolgreich (Schema angelegt, Abfrage ok). */
  ready: boolean;
  /** Fehler in Folge (0 = alles gut). */
  failures: number;
  /** Wie oft die Verbindung bereits automatisch neu aufgebaut wurde. */
  resets: number;
  lastError?: string;
}

export function dbStatus(): DbStatus {
  const g = globals();
  return {
    mode: getDbMode(),
    storage: getDbMode() === "postgres" ? "external" : g.pgliteStorage,
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

function pgliteDataDir(): string {
  return process.env.PGLITE_DIR ?? path.join(process.cwd(), ".data", "pglite");
}

async function createPglite(
  dir: string | null,
): Promise<{ client: PGlite; db: Database }> {
  if (dir) mkdirSync(dir, { recursive: true });
  const client = dir ? new PGlite(dir) : new PGlite();
  await withTimeout(client.waitReady, 30_000, "PGlite-Start");
  return { client, db: drizzlePglite(client) as unknown as Database };
}

async function initPglite(): Promise<Database> {
  const g = globals();
  const dir = pgliteDataDir();
  let client: PGlite;
  let db: Database;
  try {
    ({ client, db } = await createPglite(dir));
    g.pgliteStorage = "file";
  } catch (error) {
    console.warn(
      `[db] PGlite konnte ${dir} nicht öffnen (z. B. read-only Dateisystem) – ` +
        `weiter im Speicher-Modus. Lobbys überleben dann keinen Neustart, ` +
        `für dauerhafte Lobbys DATABASE_URL setzen.`,
      error,
    );
    ({ client, db } = await createPglite(null));
    g.pgliteStorage = "memory";
  }
  g.pglite = client;
  g.db = db;
  return db;
}

function getPgliteDatabase(): Promise<Database> {
  const g = globals();
  // Singleton pro Prozess – wichtig für Next.js Dev-Hot-Reload und
  // parallele erste Anfragen.
  g.pgliteInit ??= initPglite().catch((error: unknown) => {
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
    connectionTimeoutMillis: 8_000,
    idleTimeoutMillis: 30_000,
    allowExitOnIdle: true,
    keepAlive: true,
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
export async function getDb(): Promise<Database> {
  const g = globals();
  const databaseUrl = process.env.DATABASE_URL;

  let db: Database;
  if (databaseUrl) {
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
    db = await getPgliteDatabase();
  }

  await initSchema(db);
  return db;
}

/** Verbindung verwerfen – die nächste Anfrage startet frisch. */
export async function resetDb(): Promise<void> {
  const g = globals();
  const pglite = g.pglite;
  const pool = g.pool;
  g.pglite = undefined;
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
  g.failures += 1;
  g.ready = false;
  if (error !== undefined) g.lastError = errorMessage(error);
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
