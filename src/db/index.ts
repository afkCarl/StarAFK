import { mkdirSync } from "node:fs";
import path from "node:path";

import { drizzle as drizzleNodePg } from "drizzle-orm/node-postgres";
import { Pool, type PoolConfig } from "pg";

/**
 * PGlite wird AUSSCHLIESSLICH als Typ importiert (`import type` verschwindet
 * beim Kompilieren). Grund: RAM.
 *
 * Gemessen (Node 22, `process.memoryUsage.rss()`):
 *   - `import("@electric-sql/pglite")`          →  +9 MB
 *   - `new PGlite(); await db.waitReady`        → +456 MB  (!)
 *   - kompletter `next start` mit PGlite        →  596 MB RSS
 * Eine eingebettete PostgreSQL-Instanz lebt als WASM IN DIESEM Node-Prozess und
 * sprengt damit das 512-MB-Limit der Render-Free-Instanz. Deshalb wird das
 * Modul nicht mehr pauschal beim Serverstart geladen, sondern nur noch in dem
 * Moment, in dem PGlite tatsächlich gestartet werden darf (siehe `pglitePolicy`).
 */
import type { PGlite as PGliteClient } from "@electric-sql/pglite";

import { ensureSchema } from "@/db/migrate";

type Database = ReturnType<typeof drizzleNodePg>;

export type DbMode = "postgres" | "pglite";
export type DbStorage = "external" | "file" | "memory" | "none";

interface DbGlobals {
  pool?: Pool;
  db?: Database;
  pglite?: PGliteClient;
  pgliteInit?: Promise<Database>;
  pgliteStorage: DbStorage;
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
 * Ohne beides startet die eingebettete PGlite-Datenbank (lokale Entwicklung).
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
 * - `pglite`: eingebettetes PostgreSQL (PGlite) im Ordner `.data/` –
 *   null Konfiguration nötig, ideal für einen einfachen Start.
 */
export function getDbMode(): DbMode {
  return resolveDatabaseUrl() ? "postgres" : "pglite";
}

/* ------------------------------------------------------------------ *
 * PGlite-Schutz: Die eingebettete Datenbank darf nie einen Container
 * sprengen (gemessen: +456 MB RSS, kompletter Server 596 MB > 512 MB).
 * ------------------------------------------------------------------ */

/**
 * Kleinste Container-RAM-Grenze, ab der PGlite noch gestartet werden darf.
 *
 * Herleitung aus der Messung: PGlite selbst ~456 MB + Node/Next.js-Server
 * ~145 MB ≈ 600 MB. Unter 900 MB bleibt also kein Spielraum für Requests,
 * GC und den Turbopack-Runtime-Overhead – deshalb Standard 900 MB.
 * Über `PGLITE_MIN_MEMORY_MB` anpassbar.
 */
const PGLITE_MIN_MEMORY_MB_DEFAULT = 900;

function envFlag(name: string): boolean {
  const raw = (process.env[name] ?? "").trim().toLowerCase();
  return raw === "1" || raw === "true" || raw === "yes" || raw === "on";
}

function pgliteMinMemoryMb(): number {
  const configured = Number(process.env.PGLITE_MIN_MEMORY_MB);
  return Number.isFinite(configured) && configured > 0
    ? configured
    : PGLITE_MIN_MEMORY_MB_DEFAULT;
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

/**
 * Handelt es sich um einen Konfigurationsfehler, den auch ein Neuaufbau der
 * Verbindung nicht heilt (z. B. blockiertes PGlite ohne DATABASE_URL)?
 * Öffentlich, damit Start-Hook und Health-Monitor solche Fehler kurz und ohne
 * Stacktrace loggen können, statt bei jedem Versuch denselben Text zu kippen.
 */
export function isPermanentDbError(error: unknown): boolean {
  return Boolean((error as { permanent?: unknown } | null)?.permanent);
}

export type PglitePolicy =
  | { allowed: true }
  | { allowed: false; reason: string; hint: string };

/**
 * Darf PGlite (eingebettetes PostgreSQL im Prozess) in DIESER Umgebung
 * gestartet werden?
 *
 * - `PGLITE_IN_PRODUCTION=1`      → immer erlaubt (bewusster Notausgang,
 *                                   nur auf Instanzen mit ≥ 1 GB RAM nutzen).
 * - Container meldet < 900 MB     → verboten (das ist der Render-Free-Fall:
 *                                   512 MB; PGlite würde die Instanz sofort
 *                                   über das Limit heben → OOM-Kill).
 * - `NODE_ENV=production`         → verboten, außer Override (Produktion soll
 *                                   eine echte Datenbank nutzen).
 * - sonst (lokale Entwicklung)    → erlaubt, Verhalten unverändert.
 *
 * `process.constrainedMemory()` liefert das cgroup-Limit des Containers und
 * `undefined`, wenn Node ohne Grenze läuft – dann greift nur die NODE_ENV-Regel.
 */
export function pglitePolicy(): PglitePolicy {
  if (envFlag("PGLITE_IN_PRODUCTION")) return { allowed: true };

  const hint =
    "Bitte eine externe PostgreSQL-Datenbank setzen: DATABASE_URL (z. B. Neon) " +
    "oder AUTO_DATABASE_URL (wird von der render.yaml-Blueprint automatisch " +
    "befüllt). Notfall-Override für Instanzen mit mindestens 1 GB RAM: " +
    "PGLITE_IN_PRODUCTION=1";

  const limitBytes =
    typeof process.constrainedMemory === "function"
      ? process.constrainedMemory()
      : undefined;
  const limitMb =
    typeof limitBytes === "number" && limitBytes > 0
      ? Math.round(limitBytes / 1_048_576)
      : undefined;
  const minMb = pgliteMinMemoryMb();

  if (limitMb !== undefined && limitMb < minMb) {
    return {
      allowed: false,
      reason:
        `Der Container meldet ein RAM-Limit von ${limitMb} MB ` +
        `(PGlite braucht allein ~456 MB, benötigt werden ≥ ${minMb} MB)`,
      hint,
    };
  }
  if (process.env.NODE_ENV === "production") {
    return {
      allowed: false,
      reason:
        "NODE_ENV=production – PGlite würde als WASM-PostgreSQL im Serverprozess " +
        "laufen und ~456 MB RAM belegen (gemessen: 596 MB RSS für next start)",
      hint,
    };
  }
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
  /**
   * Konfigurationshinweis, wenn die Datenbank BEWUSST nicht gestartet wurde
   * (PGlite-Schutz). Steht 1:1 in `/api/health`, damit die Ursache sofort
   * sichtbar ist und nicht erst in den Render-Logs gesucht werden muss.
   */
  notice?: string;
}

export function dbStatus(): DbStatus {
  const g = globals();
  const mode = getDbMode();
  let notice: string | undefined;
  if (mode === "pglite") {
    const policy = pglitePolicy();
    if (!policy.allowed) notice = `${policy.reason}. ${policy.hint}`;
  }
  return {
    mode,
    provider: getDbProvider(),
    storage: mode === "postgres" ? "external" : g.pgliteStorage,
    ready: g.ready,
    failures: g.failures,
    resets: g.resets,
    ...(g.lastError ? { lastError: g.lastError } : {}),
    ...(notice ? { notice } : {}),
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

/**
 * Lädt PGlite und den passenden Drizzle-Treiber – und zwar ERST hier.
 *
 * Vorher standen beide als statische `import`-Zeilen am Dateianfang. Folge:
 * Jeder Server-Chunk, der `@/db` importiert (also jede API-Route UND der
 * Instrumentation-Hook beim Start), hat das PGlite-Modul samt WASM-Lader
 * geladen, obwohl auf Render immer eine externe Datenbank genutzt wird.
 * `import()`-Ausdrücke sind dagegen lazy: ohne PGlite-Start bleiben Modul und
 * WASM komplett außerhalb des Prozesses.
 */
async function loadPgliteModules(): Promise<{
  create: (dir: string | null) => Promise<PGliteClient>;
  wrap: (client: PGliteClient) => Database;
}> {
  const [{ PGlite }, { drizzle }] = await Promise.all([
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

async function initPglite(): Promise<Database> {
  const g = globals();

  // RAM-Schutz: In Produktion bzw. in kleinen Containern (< 900 MB) wird
  // PGlite gar nicht erst geladen – sonst OOM-Kill durch Render.
  const policy = pglitePolicy();
  if (!policy.allowed) {
    const message = `PGlite wurde nicht gestartet: ${policy.reason}. ${policy.hint}`;
    if (!g.pgliteBlockLogged) {
      g.pgliteBlockLogged = true;
      console.error(`[db] ${message}`);
    }
    throw new DbUnavailableError(message);
  }

  const { create, wrap } = await loadPgliteModules();
  const dir = pgliteDataDir();
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

export async function getDb(): Promise<Database> {
  try {
    return await getDbOnce();
  } catch (error) {
    // Nur bei einer externen Datenbank lohnt der sofortige Neuaufbau:
    // Das betrifft z. B. den allerersten Verbindungsaufbau zu einer gerade
    // aufwachenden Neon-Datenbank oder eine vom Pooler geschlossene
    // Verbindung. Statt den Fehler (und damit einen fehlgeschlagenen
    // „Lobby erstellen“-Klick) an den Spieler weiterzugeben, wird die
    // Verbindung einmal frisch aufgebaut und der Zugriff wiederholt.
    if (!resolveDatabaseUrl()) throw error;
    console.warn(
      "[db] Datenbankzugriff fehlgeschlagen – Verbindung wird neu aufgebaut und einmal wiederholt.",
      error,
    );
    await resetDb();
    return getDbOnce();
  }
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
  g.ready = false;
  if (error !== undefined) g.lastError = errorMessage(error);

  // Konfigurationsfehler (z. B. PGlite-Schutz ohne DATABASE_URL) heilt kein
  // Neuaufbau. Würde hier mitgezählt, stiege `resets` in `/api/health` endlos
  // und alle 3 Aufrufe würde sinnlos ein Pool verworfen.
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
