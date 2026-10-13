import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";

type Database = ReturnType<typeof drizzle>;

const globalForDb = globalThis as typeof globalThis & {
  __arenaNextJsPostgresqlPool?: Pool;
  __arenaNextJsDatabase?: Database;
};

/**
 * Resolve the database only when an API handler actually needs it. Next.js
 * imports route modules during `next build`, when runtime secrets such as
 * DATABASE_URL may not yet be available.
 */
export function getDb(): Database {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error("DATABASE_URL is required");
  }

  const pool =
    globalForDb.__arenaNextJsPostgresqlPool ??
    (globalForDb.__arenaNextJsPostgresqlPool = new Pool({
      connectionString: databaseUrl,
    }));

  return (globalForDb.__arenaNextJsDatabase ??= drizzle(pool));
}
