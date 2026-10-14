import { mkdirSync } from "node:fs";
import path from "node:path";

import { PGlite } from "@electric-sql/pglite";
import { drizzle as drizzleNodePg } from "drizzle-orm/node-postgres";
import { drizzle as drizzlePglite } from "drizzle-orm/pglite";
import { Pool } from "pg";

import { ensureSchema } from "@/db/migrate";

type Database = ReturnType<typeof drizzleNodePg>;

export type DbMode = "postgres" | "pglite";

const globalForDb = globalThis as typeof globalThis & {
  __arenaNextJsPostgresqlPool?: Pool;
  __arenaNextJsDatabase?: Database;
  __arenaPgliteDatabase?: Database;
  __arenaPgliteInit?: Promise<Database>;
  __arenaSchemaReady?: WeakSet<object>;
};

/**
 * Welche Datenbank-Variante gerade aktiv ist:
 * - `postgres`: externe PostgreSQL-Instanz aus `DATABASE_URL`
 * - `pglite`: eingebettetes PostgreSQL (PGlite) im Datensatz-Ordner –
 *   null Konfiguration nötig, ideal für einen einfachen Start.
 */
export function getDbMode(): DbMode {
  return process.env.DATABASE_URL ? "postgres" : "pglite";
}

function pgliteDataDir(): string {
  return (
    process.env.PGLITE_DIR ?? path.join(process.cwd(), ".data", "pglite")
  );
}

function getPgliteDatabase(): Promise<Database> {
  // Singleton pro Prozess – wichtig für Next.js Dev-Hot-Reload und
  // parallele erste Anfragen.
  globalForDb.__arenaPgliteInit ??= (async () => {
    const dataDir = pgliteDataDir();
    // PGlite legt den Zielordner nicht rekursiv an – Elternordner sicherstellen.
    mkdirSync(dataDir, { recursive: true });
    const client = new PGlite(dataDir);
    await client.waitReady;
    const db = drizzlePglite(client) as unknown as Database;
    globalForDb.__arenaPgliteDatabase = db;
    return db;
  })();
  return globalForDb.__arenaPgliteInit;
}

async function initSchema(db: Database): Promise<void> {
  globalForDb.__arenaSchemaReady ??= new WeakSet<object>();
  if (globalForDb.__arenaSchemaReady.has(db)) return;
  await ensureSchema(db);
  globalForDb.__arenaSchemaReady.add(db);
}

/**
 * Liefert die Datenbank-Verbindung und stellt beim ersten Aufruf sicher,
 * dass alle Tabellen existieren (völlig automatisch – ohne manuelle
 * Migrationsschritte). API-Handler rufen dies asynchron auf, weil `next build`
 * Route-Module ohne Runtime-Secrets importiert.
 */
export async function getDb(): Promise<Database> {
  const databaseUrl = process.env.DATABASE_URL;

  let db: Database;
  if (databaseUrl) {
    const pool =
      globalForDb.__arenaNextJsPostgresqlPool ??
      (globalForDb.__arenaNextJsPostgresqlPool = new Pool({
        connectionString: databaseUrl,
      }));
    db = globalForDb.__arenaNextJsDatabase ??= drizzleNodePg(pool);
  } else {
    db = await getPgliteDatabase();
  }

  await initSchema(db);
  return db;
}
