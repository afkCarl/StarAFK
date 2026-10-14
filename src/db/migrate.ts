import { sql, type SQLWrapper } from "drizzle-orm";

/**
 * Idempente Schema-Initialisierung. Wird beim ersten Datenbank-Zugriff
 * automatisch ausgeführt – dadurch braucht es KEIN `drizzle-kit push` und
 * keine manuellen Migrationsschritte (egal ob eingebettete PGlite-Datenbank
 * oder externe PostgreSQL-Instanz via DATABASE_URL).
 */
const SCHEMA_STATEMENTS: string[] = [
  `CREATE TABLE IF NOT EXISTS lobbies (
    code varchar(6) PRIMARY KEY,
    mode text NOT NULL DEFAULT 'WERWOLF',
    role_counts jsonb NOT NULL,
    game_started boolean NOT NULL DEFAULT false,
    created_at timestamptz NOT NULL DEFAULT now()
  )`,
  `CREATE TABLE IF NOT EXISTS players (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    lobby_code varchar(6) NOT NULL REFERENCES lobbies(code) ON DELETE CASCADE,
    name text NOT NULL,
    color text NOT NULL,
    fade_intensity integer NOT NULL DEFAULT 50,
    frame text NOT NULL DEFAULT 'none',
    image text,
    is_host boolean NOT NULL DEFAULT false,
    created_at timestamptz NOT NULL DEFAULT now(),
    last_seen timestamptz NOT NULL DEFAULT now()
  )`,
  `CREATE INDEX IF NOT EXISTS players_lobby_code_idx ON players (lobby_code)`,
  // Upgrades für Tabellen aus älteren Ständen (ohne game_started-Spalte):
  `ALTER TABLE lobbies ADD COLUMN IF NOT EXISTS game_started boolean NOT NULL DEFAULT false`,
];

type Executable = {
  execute: (query: SQLWrapper) => Promise<unknown>;
};

export async function ensureSchema(db: Executable): Promise<void> {
  for (const statement of SCHEMA_STATEMENTS) {
    await db.execute(sql.raw(statement));
  }
}
