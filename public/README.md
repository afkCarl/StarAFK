# Werwolf Lobby — Vollständiger Quellcode

> **ANLEITUNG FÜR KI-ASSISTENTEN / MENSCHEN ZUM 1:1-WIEDERAUFBAU:**
> Diese Datei enthält den KOMPLETTEN Quellcode aller Textdateien dieses Projekts.
> Jede Datei beginnt mit einer Überschrift `## Datei: <pfad>`, gefolgt von genau
> einem Code-Block, dessen Inhalt EXAKT so (Byte für Byte) unter dem angegebenen
> Pfad gespeichert werden muss. Binärdateien (Bilder) sind unten gelistet und
> können direkt von diesem Server unter ihrem Pfad heruntergeladen werden
> (z. B. `GET /sky.png` → speichern als `public/sky.png`).
>
> **Reihenfolge beim Wiederaufbau:**
> 1. Leeres Next.js-Projekt anlegen (oder Dateien einfach in einen Ordner schreiben).
> 2. ALLE Textdateien exakt wie hier abgedruckt anlegen.
> 3. Alle Binärdateien von dieser Website herunterladen (Liste unten).
> 4. `npm install` → `npm run build` → `npm run start` — fertig, die App läuft
>    1:1 identisch OHNE jede Datenbank-Vorbereitung: ohne `DATABASE_URL` wird
>    automatisch eine eingebettete PostgreSQL-Datenbank (PGlite) in `.data/` angelegt.
> 5. Optional: `.env` mit `DATABASE_URL=postgresql://…` für eine externe
>    PostgreSQL-Datenbank — die Tabellen werden ebenfalls automatisch angelegt
>    (kein `drizzle-kit push` nötig).

## Projektübersicht

Mehrspieler-Lobby für das Partyspiel **Werwolf** (Bonus-Modus: **Höhle der Löwen**):

- **Menü**: Spielmodus-Karussell (SPIELMODUS 1/2) mit Slide-Animation, Nachthimmel
  mit Wolken-Parallax und Dorf-Silhouette, „Lobby erstellen" / „Lobby beitreten"
  (6-stelliger Code, A–Z), Menüpunkte „Spielerkarte" / „Statistiken" / „Einstellungen".
- **Spielerkarte**: Name (max. 12 Zeichen), Farbe + Intensität (135°-Farbverlauf),
  Profilbild-Upload (Data-URL), Rahmenwahl (Rahmen 1 = laufende Katze `Cd`/`WalkingCat`).
  Persistenz in `localStorage` unter `werwolf-player-profile`.
- **Lobby**: kopierbarer Lobbycode, Glaskarten-Grid der Spieler (Farbe/Avatar/Host-Badge),
  Seitenleiste mit Spielmodus, „Rollen für diese Runde", „Sonstige Regeln",
  „Spiel starten" (Host) bzw. „Warte auf Host…" (Gäste).
- **15 Rollen** (Teams gut/böse/neutral) mit Beschreibung, Gewinnkondition und
  Host-Zählern; Standard: 1× Werwolf, 2× Dorfbewohner.
- **Einladungslink**: `?code=ABCDEF` öffnet das Beitreten-Feld vorausgefüllt.
- **Realtime**: REST-Polling (1,2 s) + Heartbeat-Cleanup (15 s), automatische
  Host-Nachfolge, Lobbys/Spieler in PostgreSQL via Drizzle ORM. „Spiel starten"
  (Host) synchronisiert den Spielstart in Echtzeit an alle Spieler.

## Binärdateien (von diesem Server laden, nicht inline)

- `/sky.png` → speichern als `public/sky.png`
- `/clouds.png` → speichern als `public/clouds.png`
- `/foreground.png` → speichern als `public/foreground.png`
- `/frames/GrayCatWalkingOne.png` → speichern als `public/frames/GrayCatWalkingOne.png`
- `/frames/GrayCatWalkingTwo.png` → speichern als `public/frames/GrayCatWalkingTwo.png`

Falls ein Asset nicht mehr lädt: beliebige dunkle Nachthimmel-/Wolken-/Dorfsilhouetten-
Grafiken erzeugen ein nahezu identisches Bild; die Katzen-Sprites sind zwei Laufphasen
einer grauen Katze (transparente PNGs).

## Verzeichnisstruktur

```
package.json
next.config.ts
tsconfig.json
drizzle.config.json
postcss.config.mjs
src/db/index.ts
src/db/migrate.ts
src/db/schema.ts
src/lib/game.ts
src/lib/lobby-service.ts
src/app/layout.tsx
src/app/page.tsx
src/app/globals.css
src/app/api/health/route.ts
src/app/api/lobby/create/route.ts
src/app/api/lobby/join/route.ts
src/app/api/lobby/state/route.ts
src/app/api/lobby/profile/route.ts
src/app/api/lobby/roles/route.ts
src/app/api/lobby/start/route.ts
src/app/api/lobby/leave/route.ts
src/components/werwolf/werwolf-app.tsx
src/components/werwolf/sky-background.tsx
src/components/werwolf/walking-cat.tsx
src/components/werwolf/role-icon.tsx
src/components/werwolf/glass-card.tsx
public/favicon-light.svg
public/favicon-dark.svg
public/roles/Amoricon.svg
public/roles/Bürgermeistericon.svg
public/roles/Detektivicon.svg
public/roles/Diebicon.svg
public/roles/Doktoricon.svg
public/roles/Dorfbewohnericon.svg
public/roles/Dorftrottelicon.svg
public/roles/Goetheicon.svg
public/roles/Hexeicon.svg
public/roles/Jägericon.svg
public/roles/Kopfgeldjägericon.svg
public/roles/Mediumicon.svg
public/roles/Sandmannicon.svg
public/roles/Sehericon.svg
public/roles/Werwolficon.svg
public/sky.png
public/clouds.png
public/foreground.png
public/frames/GrayCatWalkingOne.png
public/frames/GrayCatWalkingTwo.png
```

---

## Datei: `package.json`

```json
{
  "name": "react-vite-tailwind",
  "private": true,
  "version": "0.0.0",
  "type": "module",
  "scripts": {
    "dev": "next dev --hostname 0.0.0.0",
    "build": "next build",
    "start": "next start --hostname 0.0.0.0",
    "typecheck": "tsc --noEmit"
  },
  "dependencies": {
    "@electric-sql/pglite": "^0.5.9",
    "clsx": "2.1.1",
    "drizzle-orm": "0.45.2",
    "lucide-react": "^1.54.0",
    "next": "16.2.6",
    "pg": "8.20.0",
    "react": "19.2.6",
    "react-dom": "19.2.6",
    "tailwind-merge": "3.4.0"
  },
  "devDependencies": {
    "@tailwindcss/postcss": "4.1.17",
    "@tailwindcss/vite": "4.1.17",
    "@types/node": "22.19.17",
    "@types/pg": "8.18.0",
    "@types/react": "19.2.7",
    "@types/react-dom": "19.2.3",
    "@vitejs/plugin-react": "5.1.1",
    "postcss": "8.5.8",
    "tailwindcss": "4.1.17",
    "typescript": "5.9.3",
    "vite": "7.3.2",
    "vite-plugin-singlefile": "2.3.0"
  }
}
```

## Datei: `next.config.ts`

```tsx
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Datenbank-Treiber nicht bundlen (stehen in node_modules und werden zur
  // Laufzeit von Node geladen) – wichtig für eingebettetes PGlite und `pg`.
  serverExternalPackages: ["@electric-sql/pglite", "pg"],
};

export default nextConfig;
```

## Datei: `tsconfig.json`

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "useDefineForClassFields": true,
    "lib": [
      "ES2020",
      "DOM",
      "DOM.Iterable"
    ],
    "module": "ESNext",
    "skipLibCheck": true,
    "types": [
      "node"
    ],
    /* Bundler mode */
    "moduleResolution": "bundler",
    "allowImportingTsExtensions": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "noEmit": true,
    "jsx": "react-jsx",
    /* Path mapping */
    "baseUrl": ".",
    "paths": {
      "@/*": [
        "src/*"
      ]
    },
    /* Linting */
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noFallthroughCasesInSwitch": true,
    "allowJs": true,
    "incremental": true,
    "esModuleInterop": true,
    "plugins": [
      {
        "name": "next"
      }
    ]
  },
  "include": [
    "next-env.d.ts",
    "src",
    "vite.config.ts",
    ".next/types/**/*.ts",
    ".next/dev/types/**/*.ts"
  ],
  "exclude": [
    "node_modules"
  ]
}
```

## Datei: `drizzle.config.json`

```json
{
  "dialect": "postgresql",
  "schema": "./src/db/schema.ts",
  "dbCredentials": {
    "url": "postgresql://postgres:postgres@127.0.0.1:5432/app_db"
  }
}
```

## Datei: `postcss.config.mjs`

```js
const postcssConfig = {
  plugins: {
    "@tailwindcss/postcss": {},
  },
};

export default postcssConfig;
```

## Datei: `src/db/index.ts`

```tsx
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
```

## Datei: `src/db/migrate.ts`

```tsx
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
```

## Datei: `src/db/schema.ts`

```tsx
import {
  boolean,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";

export type RoleCounts = Record<string, number>;

export const lobbies = pgTable("lobbies", {
  code: varchar("code", { length: 6 }).primaryKey(),
  mode: text("mode").notNull().default("WERWOLF"),
  roleCounts: jsonb("role_counts").$type<RoleCounts>().notNull(),
  gameStarted: boolean("game_started").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const players = pgTable("players", {
  id: uuid("id").primaryKey().defaultRandom(),
  lobbyCode: varchar("lobby_code", { length: 6 })
    .notNull()
    .references(() => lobbies.code, { onDelete: "cascade" }),
  name: text("name").notNull(),
  color: text("color").notNull(),
  fadeIntensity: integer("fade_intensity").notNull().default(50),
  frame: text("frame").notNull().default("none"),
  image: text("image"),
  isHost: boolean("is_host").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  lastSeen: timestamp("last_seen", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export type LobbyRow = typeof lobbies.$inferSelect;
export type PlayerRow = typeof players.$inferSelect;
```

## Datei: `src/lib/game.ts`

```tsx
export interface Role {
  short: string;
  name: string;
  team: "gut" | "böse" | "neutral";
  description: string;
}

export const ROLES: Role[] = [
  { short: "DB", name: "Dorfbewohner", team: "gut", description: "Hat keine Spezialfähigkeit und muss tagsüber die Werwölfe entlarven." },
  { short: "SE", name: "Seher", team: "gut", description: "Darf jede Nacht einen Spieler überprüfen und erfährt, ob er gut, böse oder neutral ist." },
  { short: "HX", name: "Hexe", team: "gut", description: "Besitzt einen Heil- und einen Gifttrank und entscheidet nachts über deren Einsatz." },
  { short: "JG", name: "Jäger", team: "gut", description: "Nimmt beim eigenen Ausscheiden sofort einen weiteren Spieler mit." },
  { short: "DK", name: "Doktor", team: "gut", description: "Kann jede Nacht einen Spieler schützen und so einen Angriff verhindern." },
  { short: "AM", name: "Amor", team: "gut", description: "Bestimmt zu Beginn zwei Verliebte, deren Schicksal miteinander verbunden ist." },
  { short: "MD", name: "Medium", team: "gut", description: "Erhält Hinweise aus dem Jenseits und kann dem Dorf wichtige Informationen liefern." },
  { short: "BM", name: "Bürgermeister", team: "gut", description: "Seine Stimme zählt bei Abstimmungen doppelt und entscheidet Gleichstände." },
  { short: "GO", name: "Goethe", team: "gut", description: "Die ausgewählte Person darf am nächsten Tag nur in Reimen sprechen." },
  { short: "DT", name: "Detektiv", team: "gut", description: "Darf jede Nacht bei einem Spieler sehen, mit wem er interagiert hat, erhält aber 3 Spieler von denen einer stimmt." },
  { short: "WW", name: "Werwolf", team: "böse", description: "Greift nachts gemeinsam an und versucht das Dorf unbemerkt zu kontrollieren." },
  { short: "KJ", name: "Kopfgeldjäger", team: "neutral", description: "Kriegt jeden Tag ein neues Ziel und gewinnt nur, wenn dieses bestimmte Ziel ausscheidet." },
  { short: "TT", name: "Dorftrottel", team: "neutral", description: "Muss am ersten Tag rausgevotet werden, um zu gewinnen, oder wird sonst zum Dorfbewohner." },
  { short: "SM", name: "Sandmann", team: "neutral", description: "Kann eine Person zum Schlafen bringen. Diese kann am nächsten Tag nicht reden oder voten." },
  { short: "DI", name: "Dieb", team: "neutral", description: "Stiehlt zu Beginn des Spiels eine der übrigen Rollen und übernimmt deren Rolle." },
];

export interface GameMode {
  title: string;
  description: string;
}

export const MODES: GameMode[] = [
  {
    title: "WERWOLF",
    description:
      "Finde die Werwölfe im Dorf und rette die Bewohner. Nutze deine Fähigkeiten weise, um die unschuldigen Dorfbewohner vor den Gefahren der Nacht zu beschützen und die versteckten Feinde zu enttarnen, bevor es zu spät ist und die Werwölfe die Überhand gewinnen.",
  },
  {
    title: "HÖHLE DER LÖWEN",
    description:
      "Präsentiere deine Idee vor der Runde und gewinne die Investoren für dich. Stelle dein innovatives Geschäftsmodell vor, verhandle hart und überzeuge die Löwen davon, dass dein Unternehmen das nächste große Ding auf dem Markt wird, um dir das nötige Kapital zu sichern.",
  },
];

export const DEFAULT_COLOR = "#6b7280";

export function randomName(): string {
  return `Player${Math.floor(100 + Math.random() * 900)}`;
}

export function defaultRoleCounts(): Record<string, number> {
  const counts = Object.fromEntries(ROLES.map((r) => [r.name, 0]));
  counts.Werwolf = 1;
  counts.Dorfbewohner = 2;
  return counts;
}

/** Appends an alpha channel (0-100 percent) to a hex color. */
export function withAlpha(hex: string, alphaPct: number): string {
  const clamped = Math.max(0, Math.min(100, alphaPct));
  const alpha = Math.round((clamped / 100) * 255)
    .toString(16)
    .padStart(2, "0");
  return `${hex}${alpha}`;
}

/** Diagonal colour wash used on player cards (135deg fade). */
export function colorWash(color: string, intensity: number, size: number): string {
  const strong = Math.max(8, Math.min(100, intensity));
  const mid = Math.max(6, Math.round(strong * 0.62));
  const weak = Math.max(4, Math.round(strong * 0.34));
  const stop1 = Math.max(12, Math.round(size * 0.28));
  const stop2 = Math.max(24, Math.round(size * 0.58));
  const end = Math.max(stop2 + 8, size);
  return `linear-gradient(135deg, ${withAlpha(color, strong)} 0%, ${withAlpha(
    color,
    mid,
  )} ${stop1}%, ${withAlpha(color, weak)} ${stop2}%, transparent ${end}%)`;
}

export function winCondition(role: Role): string {
  if (role.team === "gut") return "Alle Werwölfe müssen eliminiert werden.";
  if (role.team === "böse") return "Alle Dorfbewohner müssen eliminiert werden.";
  if (role.name === "Dorftrottel") return "Muss am ersten Tag rausgevotet werden.";
  if (role.name === "Kopfgeldjäger") return "Das tägliche Ziel muss ausscheiden.";
  return "Eigene Gewinnbedingung erfüllen.";
}

export interface PlayerProfile {
  name: string;
  color: string;
  fadeIntensity: number;
  frame: string;
  image: string | null;
}

export interface LobbyPlayer extends PlayerProfile {
  id: string;
  isHost: boolean;
}

export interface LobbyState {
  code: string;
  players: LobbyPlayer[];
  roleCounts: Record<string, number>;
  gameStarted: boolean;
}
```

## Datei: `src/lib/lobby-service.ts`

```tsx
import { and, asc, eq, lt } from "drizzle-orm";

import { getDb } from "@/db";
import { lobbies, players, type PlayerRow } from "@/db/schema";
import {
  DEFAULT_COLOR,
  defaultRoleCounts,
  type LobbyPlayer,
  type LobbyState,
  type PlayerProfile,
  ROLES,
} from "@/lib/game";

const STALE_MS = 15_000;
const CODE_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
/** Maximale Spielerzahl pro Lobby. */
export const MAX_PLAYERS = 12;
/** Lobbys, die älter als ein Tag sind, werden automatisch aufgeräumt. */
const LOBBY_MAX_AGE_MS = 24 * 60 * 60 * 1000;

export function sanitizeProfile(input: unknown): PlayerProfile {
  const raw = (typeof input === "object" && input !== null ? input : {}) as Record<
    string,
    unknown
  >;
  const name =
    typeof raw.name === "string" && raw.name.trim()
      ? raw.name.trim().slice(0, 12)
      : "Player";
  const color =
    typeof raw.color === "string" && /^#[0-9a-fA-F]{6}$/.test(raw.color)
      ? raw.color
      : DEFAULT_COLOR;
  const fadeIntensity =
    typeof raw.fadeIntensity === "number" && Number.isFinite(raw.fadeIntensity)
      ? Math.max(0, Math.min(100, Math.round(raw.fadeIntensity)))
      : 50;
  const frame = typeof raw.frame === "string" ? raw.frame.slice(0, 24) : "none";
  const image =
    typeof raw.image === "string" && raw.image.startsWith("data:image/")
      ? raw.image.slice(0, 400_000)
      : null;
  return { name, color, fadeIntensity, frame, image };
}

function sanitizeRoleCounts(input: unknown): Record<string, number> {
  const counts = defaultRoleCounts();
  if (typeof input === "object" && input !== null) {
    for (const role of ROLES) {
      const value = (input as Record<string, unknown>)[role.name];
      if (typeof value === "number" && Number.isFinite(value)) {
        counts[role.name] = Math.max(0, Math.min(30, Math.round(value)));
      }
    }
  }
  return counts;
}

function generateCode(): string {
  let code = "";
  for (let i = 0; i < 6; i += 1) {
    code += CODE_ALPHABET[Math.floor(Math.random() * CODE_ALPHABET.length)];
  }
  return code;
}

function toLobbyPlayer(row: PlayerRow): LobbyPlayer {
  return {
    id: row.id,
    name: row.name,
    color: row.color,
    fadeIntensity: row.fadeIntensity,
    frame: row.frame,
    image: row.image,
    isHost: row.isHost,
  };
}

async function listPlayers(code: string): Promise<PlayerRow[]> {
  const db = await getDb();
  return db
    .select()
    .from(players)
    .where(eq(players.lobbyCode, code))
    .orderBy(asc(players.createdAt));
}

/** Entfernt verwaiste Lobbys, die älter als ein Tag sind (inkl. Spieler per Cascade). */
async function purgeOldLobbies(): Promise<void> {
  const db = await getDb();
  await db
    .delete(lobbies)
    .where(lt(lobbies.createdAt, new Date(Date.now() - LOBBY_MAX_AGE_MS)));
}

export async function createLobby(
  mode: string,
  profileInput: unknown,
): Promise<{ selfId: string; lobby: LobbyState }> {
  const db = await getDb();
  const profile = sanitizeProfile(profileInput);

  // Nebenbei alte/verwaiste Lobbys aufräumen.
  await purgeOldLobbies();

  let code = generateCode();
  for (let attempt = 0; attempt < 10; attempt += 1) {
    const existing = await db
      .select({ code: lobbies.code })
      .from(lobbies)
      .where(eq(lobbies.code, code));
    if (existing.length === 0) break;
    code = generateCode();
  }

  const roleCounts = defaultRoleCounts();
  await db.insert(lobbies).values({ code, mode: mode || "WERWOLF", roleCounts });
  const [self] = await db
    .insert(players)
    .values({ lobbyCode: code, ...profile, isHost: true })
    .returning();

  return {
    selfId: self.id,
    lobby: {
      code,
      players: [toLobbyPlayer(self)],
      roleCounts,
      gameStarted: false,
    },
  };
}

export type JoinOutcome =
  | { ok: true; selfId: string; lobby: LobbyState }
  | { ok: false; reason: "not_found" | "full" };

export async function joinLobby(
  codeInput: string,
  profileInput: unknown,
): Promise<JoinOutcome> {
  const code = (codeInput || "").toUpperCase().replace(/[^A-Z]/g, "").slice(0, 6);
  if (code.length !== 6) return { ok: false, reason: "not_found" };

  const db = await getDb();
  const [lobby] = await db.select().from(lobbies).where(eq(lobbies.code, code));
  if (!lobby) return { ok: false, reason: "not_found" };

  const existingPlayers = await listPlayers(code);
  if (existingPlayers.length >= MAX_PLAYERS) {
    return { ok: false, reason: "full" };
  }

  const profile = sanitizeProfile(profileInput);
  const [self] = await db
    .insert(players)
    .values({ lobbyCode: code, ...profile, isHost: false })
    .returning();

  const rows = await listPlayers(code);
  return {
    ok: true,
    selfId: self.id,
    lobby: {
      code,
      players: rows.map(toLobbyPlayer),
      roleCounts: lobby.roleCounts,
      gameStarted: lobby.gameStarted,
    },
  };
}

export async function touchPlayer(code: string, playerId: string): Promise<void> {
  const db = await getDb();
  await db
    .update(players)
    .set({ lastSeen: new Date() })
    .where(and(eq(players.id, playerId), eq(players.lobbyCode, code)));
}

/** Removes stale players, promotes a new host when needed, returns fresh state. */
export async function getLobbyState(
  codeInput: string,
  playerId?: string,
): Promise<LobbyState | "gone" | "kicked" | null> {
  const code = (codeInput || "").toUpperCase().slice(0, 6);
  if (code.length !== 6) return null;

  const db = await getDb();
  const [lobby] = await db.select().from(lobbies).where(eq(lobbies.code, code));
  if (!lobby) return null;

  const cutoff = new Date(Date.now() - STALE_MS);
  await db
    .delete(players)
    .where(and(eq(players.lobbyCode, code), lt(players.lastSeen, cutoff)));

  let rows = await listPlayers(code);

  if (rows.length === 0) {
    await db.delete(lobbies).where(eq(lobbies.code, code));
    return "gone";
  }

  if (!rows.some((row) => row.isHost)) {
    await db
      .update(players)
      .set({ isHost: true })
      .where(eq(players.id, rows[0].id));
    rows = await listPlayers(code);
  }

  if (playerId) {
    const self = rows.find((row) => row.id === playerId);
    if (!self) return "kicked";
    await touchPlayer(code, playerId);
  }

  return {
    code,
    players: rows.map(toLobbyPlayer),
    roleCounts: lobby.roleCounts,
    gameStarted: lobby.gameStarted,
  };
}

/**
 * Startet (oder beendet) das Spiel für alle Spieler der Lobby.
 * Nur der Host darf den Status ändern.
 */
export async function setGameStarted(
  codeInput: string,
  playerId: string,
  started: boolean,
): Promise<boolean> {
  const code = (codeInput || "").toUpperCase().slice(0, 6);
  if (code.length !== 6) return false;

  const db = await getDb();
  const [host] = await db
    .select({ id: players.id })
    .from(players)
    .where(
      and(
        eq(players.id, playerId),
        eq(players.lobbyCode, code),
        eq(players.isHost, true),
      ),
    );
  if (!host) return false;

  await db
    .update(lobbies)
    .set({ gameStarted: started })
    .where(eq(lobbies.code, code));
  await touchPlayer(code, playerId);
  return true;
}

export async function updateProfile(
  code: string,
  playerId: string,
  profileInput: unknown,
): Promise<boolean> {
  const db = await getDb();
  const profile = sanitizeProfile(profileInput);
  const updated = await db
    .update(players)
    .set({ ...profile, lastSeen: new Date() })
    .where(and(eq(players.id, playerId), eq(players.lobbyCode, code)))
    .returning({ id: players.id });
  return updated.length > 0;
}

export async function updateRoleCounts(
  code: string,
  playerId: string,
  roleCountsInput: unknown,
): Promise<boolean> {
  const db = await getDb();
  const [host] = await db
    .select({ id: players.id })
    .from(players)
    .where(
      and(
        eq(players.id, playerId),
        eq(players.lobbyCode, code),
        eq(players.isHost, true),
      ),
    );
  if (!host) return false;

  await db
    .update(lobbies)
    .set({ roleCounts: sanitizeRoleCounts(roleCountsInput) })
    .where(eq(lobbies.code, code));
  await touchPlayer(code, playerId);
  return true;
}

export async function removePlayer(code: string, playerId: string): Promise<void> {
  const db = await getDb();
  await db
    .delete(players)
    .where(and(eq(players.id, playerId), eq(players.lobbyCode, code)));

  // Promote another player if the host left.
  const rows = await db
    .select({ id: players.id, isHost: players.isHost })
    .from(players)
    .where(eq(players.lobbyCode, code))
    .orderBy(asc(players.createdAt));
  if (rows.length > 0 && !rows.some((row) => row.isHost)) {
    await db.update(players).set({ isHost: true }).where(eq(players.id, rows[0].id));
  }
  if (rows.length === 0) {
    await db.delete(lobbies).where(eq(lobbies.code, code));
  }
}
```

## Datei: `src/app/layout.tsx`

```tsx
import type { Metadata } from "next";
import type { ReactNode } from "react";
import "./globals.css";

export const metadata: Metadata = {
  title: "Werwolf Lobby",
  description:
    "Erstelle eine private Lobby, lade deine Freunde ein und konfiguriert gemeinsam eure Werwolf-Runde.",
  other: {
    "source-code": "/README.md",
    "full-source":
      "Der vollständige Quellcode dieses Projekts liegt öffentlich unter /README.md",
  },
  icons: [
    {
      rel: "icon",
      url: "/favicon-light.svg",
      type: "image/svg+xml",
      media: "(prefers-color-scheme: light)",
    },
    {
      rel: "icon",
      url: "/favicon-dark.svg",
      type: "image/svg+xml",
      media: "(prefers-color-scheme: dark)",
    },
  ],
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="de">
      <body className="antialiased">{children}</body>
    </html>
  );
}
```

## Datei: `src/app/page.tsx`

```tsx
import WerwolfApp from "@/components/werwolf/werwolf-app";

export default function HomePage() {
  return <WerwolfApp />;
}
```

## Datei: `src/app/globals.css`

```css
@import "tailwindcss";

@keyframes slideCloudsRight {
  0% {
    transform: translate(-50%);
  }
  to {
    transform: translate(0);
  }
}

.custom-scroll::-webkit-scrollbar {
  width: 6px;
}
.custom-scroll::-webkit-scrollbar-track {
  background: transparent;
}
.custom-scroll::-webkit-scrollbar-thumb {
  background: #ffffff26;
  border-radius: 999px;
}
.custom-scroll::-webkit-scrollbar-thumb:hover {
  background: #ffffff4d;
}
.custom-scroll {
  scrollbar-width: thin;
  scrollbar-color: #ffffff26 transparent;
}

.card-slider {
  appearance: none;
  background: transparent;
  width: 100%;
}
.card-slider::-webkit-slider-runnable-track {
  background: #ffffff2e;
  border-radius: 999px;
  height: 6px;
}
.card-slider::-webkit-slider-thumb {
  appearance: none;
  background: #d4d4d8;
  border: 1px solid #ffffff47;
  border-radius: 999px;
  width: 20px;
  height: 20px;
  margin-top: -7px;
  box-shadow: 0 4px 12px #00000059;
}
.card-slider::-moz-range-track {
  background: #ffffff2e;
  border-radius: 999px;
  height: 6px;
}
.card-slider::-moz-range-thumb {
  background: #d4d4d8;
  border: 1px solid #ffffff47;
  border-radius: 999px;
  width: 20px;
  height: 20px;
  box-shadow: 0 4px 12px #00000059;
}
```

## Datei: `src/app/api/health/route.ts`

```tsx
import { sql } from "drizzle-orm";

import { getDb, getDbMode } from "@/db";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await (await getDb()).execute(sql`select 1`);
    return Response.json({ ok: true, db: getDbMode() });
  } catch (error) {
    console.error("health check failed", error);
    return Response.json(
      { ok: false, db: getDbMode() },
      { status: 500 },
    );
  }
}
```

## Datei: `src/app/api/lobby/create/route.ts`

```tsx
import { NextResponse } from "next/server";

import { createLobby } from "@/lib/lobby-service";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const result = await createLobby(String(body?.mode ?? "WERWOLF"), body?.profile);
    return NextResponse.json({ ok: true, selfId: result.selfId, lobby: result.lobby });
  } catch (error) {
    console.error("lobby:create failed", error);
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
```

## Datei: `src/app/api/lobby/join/route.ts`

```tsx
import { NextResponse } from "next/server";

import { joinLobby } from "@/lib/lobby-service";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const result = await joinLobby(String(body?.code ?? ""), body?.profile);
    if (!result.ok) {
      return NextResponse.json(
        { ok: false, reason: result.reason },
        { status: result.reason === "full" ? 409 : 404 },
      );
    }
    return NextResponse.json({ ok: true, selfId: result.selfId, lobby: result.lobby });
  } catch (error) {
    console.error("lobby:join failed", error);
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
```

## Datei: `src/app/api/lobby/state/route.ts`

```tsx
import { NextResponse } from "next/server";

import { getLobbyState } from "@/lib/lobby-service";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const code = url.searchParams.get("code") ?? "";
    const pid = url.searchParams.get("pid") ?? undefined;

    const state = await getLobbyState(code, pid);
    if (state === null || state === "gone") {
      return NextResponse.json({ ok: false, reason: "not_found" }, { status: 404 });
    }
    if (state === "kicked") {
      return NextResponse.json({ ok: false, reason: "kicked" }, { status: 409 });
    }
    return NextResponse.json({ ok: true, state });
  } catch (error) {
    console.error("lobby:state failed", error);
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
```

## Datei: `src/app/api/lobby/profile/route.ts`

```tsx
import { NextResponse } from "next/server";

import { updateProfile } from "@/lib/lobby-service";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const ok = await updateProfile(
      String(body?.code ?? ""),
      String(body?.playerId ?? ""),
      body?.profile,
    );
    return NextResponse.json({ ok });
  } catch (error) {
    console.error("lobby:updateProfile failed", error);
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
```

## Datei: `src/app/api/lobby/roles/route.ts`

```tsx
import { NextResponse } from "next/server";

import { updateRoleCounts } from "@/lib/lobby-service";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const ok = await updateRoleCounts(
      String(body?.code ?? ""),
      String(body?.playerId ?? ""),
      body?.roleCounts,
    );
    return NextResponse.json({ ok });
  } catch (error) {
    console.error("lobby:updateRoles failed", error);
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
```

## Datei: `src/app/api/lobby/start/route.ts`

```tsx
import { NextResponse } from "next/server";

import { setGameStarted } from "@/lib/lobby-service";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const ok = await setGameStarted(
      String(body?.code ?? ""),
      String(body?.playerId ?? ""),
      body?.started !== false,
    );
    return NextResponse.json({ ok });
  } catch (error) {
    console.error("lobby:start failed", error);
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
```

## Datei: `src/app/api/lobby/leave/route.ts`

```tsx
import { NextResponse } from "next/server";

import { removePlayer } from "@/lib/lobby-service";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    await removePlayer(String(body?.code ?? ""), String(body?.playerId ?? ""));
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("lobby:leave failed", error);
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
```

## Datei: `src/components/werwolf/werwolf-app.tsx`

```tsx
"use client";

import {
  Check,
  ChevronLeft,
  ChevronRight,
  Copy,
  Info,
  Minus,
  Plus,
  Trash2,
  X,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

import { GlassCard } from "@/components/werwolf/glass-card";
import { RoleIcon } from "@/components/werwolf/role-icon";
import { SkyBackground } from "@/components/werwolf/sky-background";
import { WalkingCat } from "@/components/werwolf/walking-cat";
import {
  DEFAULT_COLOR,
  MODES,
  ROLES,
  colorWash,
  randomName,
  winCondition,
  type LobbyPlayer,
  type LobbyState,
  type PlayerProfile,
  type Role,
} from "@/lib/game";

const PROFILE_KEY = "werwolf-player-profile";

const FRAME_OPTIONS = [
  { id: "none", name: "Kein Rahmen" },
  { id: "frame1", name: "Rahmen 1" },
  { id: "frame2", name: "Rahmen 2" },
  { id: "frame3", name: "Rahmen 3" },
  { id: "frame4", name: "Rahmen 4" },
  { id: "frame5", name: "Rahmen 5" },
];

type Screen = "menu" | "menuLeaving" | "lobbyEntering" | "lobby";
type SlidePhase = "idle" | "start" | "go";
type JoinPanel = "closed" | "opening" | "open" | "closing";
type Direction = "left" | "right";

function loadStoredProfile<K extends keyof PlayerProfile>(
  key: K,
  fallback: PlayerProfile[K],
): PlayerProfile[K] {
  try {
    const stored = JSON.parse(localStorage.getItem(PROFILE_KEY) || "{}");
    return stored[key] ?? fallback;
  } catch {
    return fallback;
  }
}

export default function WerwolfApp() {
  const [modeIndex, setModeIndex] = useState(0);
  const [prevModeIndex, setPrevModeIndex] = useState<number | null>(null);
  const [modeLocked, setModeLocked] = useState(false);
  const [direction, setDirection] = useState<Direction>("right");
  const [slidePhase, setSlidePhase] = useState<SlidePhase>("idle");
  const [joinPanel, setJoinPanel] = useState<JoinPanel>("closed");
  const [screen, setScreen] = useState<Screen>("menu");
  const [joinCode, setJoinCode] = useState("");
  const [copied, setCopied] = useState(false);
  const [selfId, setSelfId] = useState<string | null>(null);
  const [lobbyCode, setLobbyCode] = useState("");
  const [roleModalOpen, setRoleModalOpen] = useState(false);
  const [roleDetail, setRoleDetail] = useState<string | null>(null);
  const [players, setPlayers] = useState<LobbyPlayer[]>([]);
  const [isHost, setIsHost] = useState(true);
  const [defaultCounts] = useState<Record<string, number>>(() => {
    const counts = Object.fromEntries(ROLES.map((r) => [r.name, 0]));
    counts.Werwolf = 1;
    counts.Dorfbewohner = 2;
    return counts;
  });
  const [roleCounts, setRoleCounts] = useState<Record<string, number>>(defaultCounts);
  const [cardModalOpen, setCardModalOpen] = useState(false);
  const [gameStarted, setGameStarted] = useState(false);
  const [busy, setBusy] = useState<null | "create" | "join" | "start">(null);
  const [actionError, setActionError] = useState<string | null>(null);

  // Deterministische Initialwerte; localStorage wird nach dem Mount geladen,
  // damit Server-Render und Hydration identisch sind (Multi-Tab-sicher).
  const [name, setName] = useState<string>("Player");
  const [color, setColor] = useState<string>(DEFAULT_COLOR);
  const [fadeIntensity, setFadeIntensity] = useState<number>(50);
  const [nameWarn, setNameWarn] = useState(false);
  const [frame, setFrame] = useState<string>("none");
  const [image, setImage] = useState<string | null>(null);
  const [failedFrames, setFailedFrames] = useState<Record<string, boolean>>({});

  const fileInputRef = useRef<HTMLInputElement>(null);
  const switchStartRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const switchEndRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const joinTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const leaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const enterTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lobbyCodeRef = useRef("");
  const selfIdRef = useRef<string | null>(null);

  lobbyCodeRef.current = lobbyCode;
  selfIdRef.current = selfId;

  // Gespeichertes Profil nach dem Mount laden.
  useEffect(() => {
    setName(loadStoredProfile("name", randomName()));
    setColor(loadStoredProfile("color", DEFAULT_COLOR));
    setFadeIntensity(loadStoredProfile("fadeIntensity", 50));
    setFrame(loadStoredProfile("frame", "none"));
    setImage(loadStoredProfile("image", null));
  }, []);

  // Einladungslinks (?code=ABCDEF) öffnen das Beitreten-Feld vorausgefüllt —
  // so kann die Lobby einfach in einem anderen Tab / Gerät geöffnet werden.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const code = (params.get("code") ?? "")
      .toUpperCase()
      .replace(/[^A-Z]/g, "")
      .slice(0, 6);
    if (code.length === 6) {
      setJoinCode(code);
      setJoinPanel("opening");
      joinTimerRef.current = setTimeout(() => setJoinPanel("open"), 20);
    }
  }, []);

  const skipInitialPersist = useRef(true);
  useEffect(() => {
    if (skipInitialPersist.current) {
      skipInitialPersist.current = false;
      return;
    }
    localStorage.setItem(
      PROFILE_KEY,
      JSON.stringify({ name, color, fadeIntensity, frame, image }),
    );
  }, [name, color, fadeIntensity, frame, image]);

  const profile = useMemo<PlayerProfile>(
    () => ({
      name: name.trim() || "Player",
      color,
      fadeIntensity,
      frame,
      image,
    }),
    [name, color, fadeIntensity, frame, image],
  );

  const applyState = (state: LobbyState) => {
    setLobbyCode(state.code);
    setPlayers(state.players);
    setRoleCounts(state.roleCounts);
    setGameStarted(Boolean(state.gameStarted));
    setSelfId((current) => {
      if (current) {
        const self = state.players.find((p) => p.id === current);
        if (self) setIsHost(self.isHost);
      }
      return current;
    });
  };

  // Poll lobby state while inside a lobby (replaces the original socket push).
  useEffect(() => {
    if (screen !== "lobby" && screen !== "lobbyEntering") return;
    let cancelled = false;

    const poll = async () => {
      const code = lobbyCodeRef.current;
      const pid = selfIdRef.current;
      if (!code || !pid) return;
      try {
        const res = await fetch(
          `/api/lobby/state?code=${encodeURIComponent(code)}&pid=${encodeURIComponent(pid)}`,
          { cache: "no-store" },
        );
        if (cancelled) return;
        if (!res.ok) {
          setScreen("menu");
          setSelfId(null);
          setPlayers([]);
          setActionError(
            "Die Lobby ist nicht mehr verfügbar – sie wurde geschlossen oder du wurdest entfernt.",
          );
          return;
        }
        const data = await res.json();
        if (!cancelled && data?.ok) applyState(data.state as LobbyState);
      } catch {
        /* keep polling */
      }
    };

    poll();
    const interval = setInterval(poll, 1200);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [screen]);

  // Push profile changes (debounced) while inside a lobby.
  useEffect(() => {
    if (screen === "lobby" || screen === "lobbyEntering") {
      const timeout = setTimeout(() => {
        const code = lobbyCodeRef.current;
        const pid = selfIdRef.current;
        if (!code || !pid) return;
        fetch("/api/lobby/profile", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ code, playerId: pid, profile }),
        }).catch(() => {});
      }, 150);
      return () => clearTimeout(timeout);
    }
  }, [profile, screen]);

  // Leave the lobby when the tab is closed.
  useEffect(() => {
    const handler = () => {
      const code = lobbyCodeRef.current;
      const pid = selfIdRef.current;
      if (!code || !pid) return;
      const body = new Blob([JSON.stringify({ code, playerId: pid })], {
        type: "application/json",
      });
      navigator.sendBeacon("/api/lobby/leave", body);
    };
    window.addEventListener("pagehide", handler);
    return () => window.removeEventListener("pagehide", handler);
  }, []);

  useEffect(
    () => () => {
      [switchStartRef, switchEndRef, joinTimerRef, leaveTimerRef, enterTimerRef].forEach(
        (ref) => {
          if (ref.current) clearTimeout(ref.current);
        },
      );
    },
    [],
  );

  const handleImageUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = () => setImage(String(reader.result));
      reader.readAsDataURL(file);
    }
  };

  const mode = MODES[modeIndex];
  const prevMode = prevModeIndex !== null ? MODES[prevModeIndex] : null;
  const modeLabel = mode.title === "WERWOLF" ? "Werwolf (Standard)" : mode.title;
  const modeShort = mode.title === "WERWOLF" ? "WW" : mode.title.slice(0, 2);
  const inMenu = screen === "menu" || screen === "menuLeaving";
  const inLobby = screen === "lobbyEntering" || screen === "lobby";
  const isDark = (inMenu && mode.title === "WERWOLF") || inLobby;
  const selectedRoles = ROLES.filter((role) => roleCounts[role.name] > 0);

  const switchMode = (nextIndex: number, dir: Direction) => {
    if (modeLocked || screen !== "menu") return;
    setModeLocked(true);
    setDirection(dir);
    setPrevModeIndex(modeIndex);
    setModeIndex(nextIndex);
    setSlidePhase("start");
    switchStartRef.current = setTimeout(() => setSlidePhase("go"), 20);
    switchEndRef.current = setTimeout(() => {
      setPrevModeIndex(null);
      setSlidePhase("idle");
      setModeLocked(false);
    }, 470);
  };
  const nextMode = () => switchMode((modeIndex + 1) % MODES.length, "right");
  const prevModeFn = () =>
    switchMode((modeIndex - 1 + MODES.length) % MODES.length, "left");

  const toggleJoinPanel = () => {
    if (screen !== "menu") return;
    if (joinTimerRef.current) clearTimeout(joinTimerRef.current);
    if (joinPanel === "closed") {
      setJoinPanel("opening");
      joinTimerRef.current = setTimeout(() => setJoinPanel("open"), 20);
    } else if (joinPanel === "open") {
      setJoinPanel("closing");
      joinTimerRef.current = setTimeout(() => {
        setJoinPanel("closed");
        setJoinCode("");
      }, 350);
    }
  };

  const copyCode = () => {
    navigator.clipboard.writeText(lobbyCode).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  };

  const enterLobby = (
    code: string,
    lobbyPlayers: LobbyPlayer[],
    host: boolean,
    id: string,
    counts: Record<string, number>,
    started: boolean,
  ) => {
    setSelfId(id);
    setLobbyCode(code);
    setIsHost(host);
    setPlayers(lobbyPlayers);
    setRoleCounts(counts);
    setGameStarted(started);
    setScreen("menuLeaving");
    leaveTimerRef.current = setTimeout(() => {
      setScreen("lobbyEntering");
      enterTimerRef.current = setTimeout(() => setScreen("lobby"), 20);
    }, 440);
  };

  const handleCreate = () => {
    if (screen !== "menu" || modeLocked || busy) return;
    if (mode.title !== "WERWOLF") return;
    if (joinTimerRef.current) clearTimeout(joinTimerRef.current);
    setJoinPanel("closed");
    setJoinCode("");
    setCopied(false);
    setRoleModalOpen(false);
    setActionError(null);
    setBusy("create");
    fetch("/api/lobby/create", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mode: mode.title, profile }),
    })
      .then(async (res) => {
        const data = await res.json().catch(() => null);
        if (!res.ok || !data?.ok) throw new Error("create failed");
        enterLobby(
          data.lobby.code,
          data.lobby.players,
          true,
          data.selfId,
          data.lobby.roleCounts,
          Boolean(data.lobby.gameStarted),
        );
      })
      .catch(() => {
        setActionError(
          "Lobby konnte nicht erstellt werden – Server oder Datenbank nicht erreichbar. Bitte versuche es gleich noch einmal.",
        );
      })
      .finally(() => setBusy(null));
  };

  const handleJoin = () => {
    if (screen !== "menu" || modeLocked || busy) return;
    if (joinCode.length !== 6) {
      setActionError("Bitte gib einen 6-stelligen Lobbycode ein (A–Z).");
      return;
    }
    if (joinTimerRef.current) clearTimeout(joinTimerRef.current);
    setCopied(false);
    setRoleModalOpen(false);
    setActionError(null);
    setBusy("join");
    fetch("/api/lobby/join", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code: joinCode, profile }),
    })
      .then(async (res) => {
        const data = await res.json().catch(() => null);
        if (!res.ok || !data?.ok) {
          if (data?.reason === "full") {
            throw new Error("full");
          }
          throw new Error("not_found");
        }
        const self = (data.lobby.players as LobbyPlayer[]).find(
          (p) => p.id === data.selfId,
        );
        setJoinPanel("closed");
        setJoinCode("");
        enterLobby(
          data.lobby.code,
          data.lobby.players,
          self?.isHost || false,
          data.selfId,
          data.lobby.roleCounts,
          Boolean(data.lobby.gameStarted),
        );
      })
      .catch((error: unknown) => {
        const message =
          error instanceof Error && error.message === "full"
            ? "Die Lobby ist leider voll (max. 12 Spieler)."
            : error instanceof Error && error.message === "not_found"
              ? "Lobby mit diesem Code wurde nicht gefunden."
              : "Beitreten fehlgeschlagen – der Server ist gerade nicht erreichbar.";
        setActionError(message);
      })
      .finally(() => setBusy(null));
  };

  const handleStartGame = (started: boolean) => {
    const code = lobbyCodeRef.current;
    const pid = selfIdRef.current;
    if (!code || !pid || busy) return;
    setActionError(null);
    setBusy("start");
    fetch("/api/lobby/start", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code, playerId: pid, started }),
    })
      .then(async (res) => {
        const data = await res.json().catch(() => null);
        if (!res.ok || !data?.ok) throw new Error("start failed");
        setGameStarted(started);
      })
      .catch(() => {
        setActionError(
          started
            ? "Das Spiel konnte nicht gestartet werden. Bitte versuche es erneut."
            : "Das Spiel konnte nicht zurückgesetzt werden.",
        );
      })
      .finally(() => setBusy(null));
  };

  const changeRoleCount = (roleName: string, delta: number) => {
    if (!isHost) return;
    const next = {
      ...roleCounts,
      [roleName]: Math.max(0, (roleCounts[roleName] ?? 0) + delta),
    };
    setRoleCounts(next);
    const code = lobbyCodeRef.current;
    const pid = selfIdRef.current;
    if (!code || !pid) return;
    fetch("/api/lobby/roles", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code, playerId: pid, roleCounts: next }),
    }).catch(() => {});
  };

  // --- animation helpers -------------------------------------------------
  const outgoingStyle = (): React.CSSProperties =>
    slidePhase === "start"
      ? { transform: "translateX(0)", opacity: 1, transition: "none" }
      : slidePhase === "go"
        ? {
            transform: `translateX(${direction === "right" ? "-115%" : "115%"})`,
            opacity: 0,
            transition:
              "transform 420ms cubic-bezier(0.4,0,0.2,1), opacity 420ms ease",
          }
        : { transform: "translateX(0)", opacity: 1 };

  const incomingStyle = (): React.CSSProperties =>
    slidePhase === "start"
      ? {
          transform: `translateX(${direction === "right" ? "115%" : "-115%"})`,
          opacity: 0,
          transition: "none",
        }
      : slidePhase === "go"
        ? {
            transform: "translateX(0)",
            opacity: 1,
            transition:
              "transform 420ms cubic-bezier(0.22,1,0.36,1), opacity 420ms ease",
          }
        : { transform: "translateX(0)", opacity: 1 };

  const joinPanelStyle = (): React.CSSProperties =>
    joinPanel === "opening"
      ? { transform: "translateX(-100vw)", opacity: 0, transition: "none" }
      : joinPanel === "closing"
        ? {
            transform: "translateX(-100vw)",
            opacity: 0,
            transition:
              "transform 350ms cubic-bezier(0.4,0,0.2,1), opacity 350ms ease",
          }
        : joinPanel === "open"
          ? {
              transform: "translateX(0)",
              opacity: 1,
              transition:
                "transform 350ms cubic-bezier(0.22,1,0.36,1), opacity 350ms ease",
            }
          : {};

  const leftExitStyle = (): React.CSSProperties =>
    screen === "menuLeaving"
      ? {
          transform: "translateX(-110vw)",
          opacity: 0,
          transition:
            "transform 440ms cubic-bezier(0.4,0,0.2,1), opacity 300ms ease",
        }
      : { transform: "translateX(0)", opacity: 1 };

  const rightExitStyle = (): React.CSSProperties =>
    screen === "menuLeaving"
      ? {
          transform: "translateX(110vw)",
          opacity: 0,
          transition:
            "transform 440ms cubic-bezier(0.4,0,0.2,1), opacity 300ms ease",
        }
      : { transform: "translateX(0)", opacity: 1 };

  const lobbyEnterStyle = (): React.CSSProperties =>
    screen === "lobbyEntering"
      ? { transform: "translateY(110%)", opacity: 0, transition: "none" }
      : screen === "lobby"
        ? {
            transform: "translateY(0)",
            opacity: 1,
            transition:
              "transform 520ms cubic-bezier(0.22,1,0.36,1), opacity 520ms ease",
          }
        : {};

  const menuButtons =
    "w-fit text-left text-[1.75rem] font-bold uppercase transition-all duration-200 hover:translate-x-3 hover:text-neutral-400 sm:text-[2.1rem]";

  const detailRole: Role | null = roleDetail
    ? (ROLES.find((r) => r.name === roleDetail) ?? null)
    : null;

  return (
    <div
      className={`relative min-h-screen w-full overflow-hidden transition-colors duration-700 ${
        isDark ? "bg-[#0b1220] text-white" : "bg-white text-black"
      }`}
    >
      <SkyBackground isActive={isDark} />

      {actionError && (
        <div
          className="fixed inset-x-0 bottom-4 z-[60] flex justify-center px-4"
          role="alert"
        >
          <div className="flex max-w-[min(36rem,92vw)] items-start gap-3 rounded-[1.2rem] border border-red-400/40 bg-red-950/90 px-4 py-3 text-sm font-semibold text-red-100 shadow-2xl backdrop-blur-md">
            <span className="leading-relaxed">{actionError}</span>
            <button
              onClick={() => setActionError(null)}
              aria-label="Fehlermeldung schließen"
              className="mt-0.5 shrink-0 text-red-200/70 transition-colors hover:text-red-100"
            >
              <X size={16} />
            </button>
          </div>
        </div>
      )}

      {inMenu && (
        <>
          <div
            className="relative z-10 flex min-h-screen flex-col px-4 py-3 sm:px-6 sm:py-4 md:px-8 md:py-5"
            style={leftExitStyle()}
          >
            <div className="relative flex flex-col pt-0.5">
              <p className="text-[1.4rem] font-black uppercase tracking-wide sm:text-[1.6rem]">
                SPIELMODUS {modeIndex + 1}/{MODES.length}
              </p>
              <div className="relative mt-0.5 min-h-[14rem] -translate-y-2 overflow-hidden sm:min-h-[16rem] md:min-h-[18rem]">
                {prevMode && slidePhase !== "idle" && (
                  <div className="absolute inset-0" style={outgoingStyle()}>
                    <h1 className="overflow-visible whitespace-nowrap pt-1 text-[clamp(4rem,8vw,8rem)] font-black uppercase leading-none tracking-tight">
                      {prevMode.title}
                    </h1>
                    <div
                      className={`mt-2 h-[4px] w-full max-w-[57rem] bg-gradient-to-r to-transparent ${
                        isDark ? "from-white" : "from-black"
                      }`}
                    />
                    <p className="mt-3 w-[66vw] text-base font-semibold sm:text-lg">
                      {prevMode.description}
                    </p>
                  </div>
                )}
                <div
                  className={slidePhase !== "idle" ? "absolute inset-0" : ""}
                  style={slidePhase !== "idle" ? incomingStyle() : {}}
                >
                  <h1 className="overflow-visible whitespace-nowrap pt-1 text-[clamp(4rem,8vw,8rem)] font-black uppercase leading-none tracking-tight">
                    {mode.title}
                  </h1>
                  <div
                    className={`mt-2 h-[4px] w-full max-w-[57rem] bg-gradient-to-r to-transparent ${
                      isDark ? "from-white" : "from-black"
                    }`}
                  />
                  <p className="mt-3 w-[66vw] text-base font-semibold sm:text-lg">
                    {mode.description}
                  </p>
                </div>
              </div>
            </div>
            <div className="mt-auto mb-4 flex flex-col gap-2">
              <button onClick={() => setCardModalOpen(true)} className={menuButtons}>
                Spielerkarte
              </button>
              <button className={menuButtons}>Statistiken</button>
              <button className={menuButtons}>Einstellungen</button>
            </div>
          </div>

          <button
            onClick={prevModeFn}
            className="absolute left-1 top-[42%] z-20 -translate-y-1/2 p-3 transition-all duration-200 hover:-translate-x-1 hover:scale-110 hover:text-neutral-400 sm:left-2 md:left-3"
            aria-label="Vorheriger Gamemode"
            style={leftExitStyle()}
          >
            <ChevronLeft size={72} strokeWidth={1.5} />
          </button>
          <button
            onClick={nextMode}
            className="absolute right-1 top-[42%] z-20 -translate-y-1/2 p-3 transition-all duration-200 hover:translate-x-1 hover:scale-110 hover:text-neutral-400 sm:right-2 md:right-3"
            aria-label="Nächster Gamemode"
            style={rightExitStyle()}
          >
            <ChevronRight size={72} strokeWidth={1.5} />
          </button>

          <div
            className="absolute left-4 top-[calc(42%+120px)] z-20 flex flex-col gap-3 sm:left-6 md:left-8"
            style={leftExitStyle()}
          >
            <button
              onClick={handleCreate}
              disabled={busy === "create"}
              className={`w-fit text-left text-[1.75rem] font-bold uppercase transition-all duration-200 sm:text-[2.1rem] ${
                mode.title === "WERWOLF"
                  ? "hover:translate-x-3 hover:text-neutral-400"
                  : "cursor-not-allowed opacity-30"
              } ${busy === "create" ? "animate-pulse opacity-70" : ""}`}
            >
              {busy === "create" ? "Erstelle Lobby…" : "Lobby erstellen"}
            </button>
            <div className="flex w-fit flex-col">
              <button onClick={toggleJoinPanel} className={menuButtons}>
                Lobby beitreten
              </button>
              {joinPanel !== "closed" && (
                <div
                  className="mt-4 flex items-end justify-between border-b-2 border-current pb-1"
                  style={joinPanelStyle()}
                >
                  <input
                    type="text"
                    value={joinCode}
                    onChange={(e) =>
                      setJoinCode(
                        e.target.value
                          .toUpperCase()
                          .replace(/[^A-Z]/g, "")
                          .slice(0, 6),
                      )
                    }
                    onKeyDown={(e) => {
                      if (e.key === "Enter") handleJoin();
                    }}
                    placeholder="LOBBY-CODE"
                    maxLength={6}
                    className="w-full bg-transparent text-[1.4rem] font-medium tracking-widest outline-none placeholder:text-neutral-400 sm:text-[1.6rem]"
                    autoFocus
                  />
                  <button
                    onClick={handleJoin}
                    disabled={busy === "join"}
                    className="ml-4 shrink-0 text-[1.4rem] font-bold uppercase transition-all hover:text-neutral-400 disabled:animate-pulse disabled:opacity-60 sm:text-[1.6rem]"
                  >
                    {busy === "join" ? "Trete bei…" : "Beitreten"}
                  </button>
                </div>
              )}
            </div>
          </div>

          {cardModalOpen && (
            <div
              className="absolute inset-0 z-50 flex items-center justify-center bg-[#030712]/85 px-4 py-6 backdrop-blur-lg"
              onClick={() => setCardModalOpen(false)}
            >
              <div
                className="flex w-full max-w-[95vw] items-center justify-center gap-8"
                onClick={(e) => e.stopPropagation()}
              >
                <div
                  className="custom-scroll flex max-h-[85vh] shrink-0 flex-col overflow-y-auto rounded-[2rem] border border-white/10 bg-[#0c1525]/95 p-6 shadow-[0_18px_80px_rgba(0,0,0,0.6)] backdrop-blur-2xl sm:p-8"
                  style={{ width: "780px" }}
                >
                  <div className="flex shrink-0 items-center justify-between gap-4 border-b border-white/10 pb-3">
                    <div>
                      <p className="text-[0.65rem] font-black uppercase tracking-[0.3em] text-white/45">
                        Profil anpassen
                      </p>
                      <h2 className="mt-1 text-[1.5rem] font-black uppercase text-white">
                        Spielerkarte
                      </h2>
                    </div>
                    <button
                      onClick={() => setCardModalOpen(false)}
                      className="group flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-white/10 text-white/50 transition-all duration-200 hover:border-white/30 hover:bg-white/10 hover:text-white"
                    >
                      <X
                        size={20}
                        className="transition-transform duration-200 group-hover:rotate-90"
                      />
                    </button>
                  </div>
                  <div className="mt-5 flex flex-col gap-5">
                    <div>
                      <div className="mb-1.5 flex items-center justify-between">
                        <label className="block text-xs font-black uppercase tracking-[0.2em] text-white/60">
                          User:
                        </label>
                        {nameWarn && (
                          <span className="animate-pulse text-[0.65rem] font-bold uppercase tracking-wider text-red-400">
                            (Max. Zeichen erreicht)
                          </span>
                        )}
                      </div>
                      <input
                        type="text"
                        maxLength={12}
                        value={name}
                        onKeyDown={(e) => {
                          if (
                            e.key === "Backspace" ||
                            e.key === "Delete" ||
                            e.key.includes("Arrow")
                          )
                            return;
                          if (name.length >= 12 && e.key.length === 1) {
                            setNameWarn(true);
                            setTimeout(() => setNameWarn(false), 2000);
                          }
                        }}
                        onChange={(e) =>
                          setName(e.target.value.replace(/[^a-zA-Z0-9 ]/g, ""))
                        }
                        className="w-full rounded-[0.9rem] border border-white/20 bg-white/5 px-3 py-2.5 text-base font-bold text-white outline-none transition-all focus:border-white/40 focus:bg-white/10"
                        placeholder="Dein Name"
                      />
                    </div>
                    <div>
                      <label className="mb-1.5 block text-xs font-black uppercase tracking-[0.2em] text-white/60">
                        Farbe:
                      </label>
                      <div className="grid grid-cols-[8.5rem_1fr] gap-4 rounded-[1rem] border border-white/10 bg-white/[0.03] p-3.5">
                        <div className="flex flex-col justify-center gap-2">
                          <div className="flex items-center gap-3">
                            <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-full border-2 border-white/20">
                              <input
                                type="color"
                                value={color}
                                onChange={(e) => setColor(e.target.value)}
                                className="absolute -inset-2 h-[150%] w-[150%] cursor-pointer border-none bg-transparent"
                              />
                            </div>
                            <span className="font-mono text-[0.72rem] font-bold text-white/45">
                              {color.toUpperCase()}
                            </span>
                          </div>
                        </div>
                        <div className="flex flex-col justify-center gap-1.5">
                          <div className="flex items-center justify-between text-[0.68rem] font-black uppercase tracking-[0.18em] text-white/55">
                            <span>Intensität</span>
                            <span className="text-white/85">{fadeIntensity}%</span>
                          </div>
                          <input
                            type="range"
                            min="0"
                            max="100"
                            value={fadeIntensity}
                            onChange={(e) => setFadeIntensity(Number(e.target.value))}
                            className="card-slider"
                          />
                        </div>
                      </div>
                    </div>
                    <div>
                      <label className="mb-1.5 block text-xs font-black uppercase tracking-[0.2em] text-white/60">
                        Profilbild:
                      </label>
                      <input
                        type="file"
                        ref={fileInputRef}
                        onChange={handleImageUpload}
                        className="hidden"
                        accept="image/*"
                      />
                      <div className="flex items-center gap-3">
                        <button
                          onClick={() => fileInputRef.current?.click()}
                          className="rounded-[0.9rem] border border-white/20 bg-white/5 px-4 py-2.5 text-xs font-bold uppercase tracking-[0.1em] text-white transition-all hover:bg-white/10"
                        >
                          Bild hochladen
                        </button>
                        {image && (
                          <button
                            onClick={() => setImage(null)}
                            className="flex h-10 w-10 items-center justify-center rounded-[0.9rem] border border-red-500/30 bg-red-500/10 text-red-400 transition-all hover:border-red-500/50 hover:bg-red-500/20"
                          >
                            <Trash2 size={16} />
                          </button>
                        )}
                      </div>
                    </div>
                    <div>
                      <label className="mb-1.5 block text-xs font-black uppercase tracking-[0.2em] text-white/60">
                        Spielerrahmen wählen
                      </label>
                      <div className="grid grid-cols-2 gap-4">
                        {FRAME_OPTIONS.map((option) => (
                          <button
                            key={option.id}
                            onClick={() => setFrame(option.id)}
                            className={`flex flex-col items-center justify-center overflow-hidden rounded-[1.4rem] border transition-all ${
                              frame === option.id
                                ? "border-white/60 bg-white/15 ring-1 ring-white/30"
                                : "border-white/15 bg-white/5 hover:border-white/30 hover:bg-white/10"
                            }`}
                            style={{ width: "351.5px", height: "200.3px" }}
                          >
                            {option.id !== "none" && !failedFrames[option.id] ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img
                                src={`/frames/${option.id}.png`}
                                alt={option.name}
                                className="h-full w-full object-contain p-2 opacity-70"
                                onError={() =>
                                  setFailedFrames((prev) => ({
                                    ...prev,
                                    [option.id]: true,
                                  }))
                                }
                              />
                            ) : null}
                            <span
                              className={`text-[0.65rem] font-bold uppercase tracking-[0.12em] ${
                                option.id !== "none" && !failedFrames[option.id]
                                  ? "hidden"
                                  : ""
                              } ${frame === option.id ? "text-white" : "text-white/40"}`}
                            >
                              {option.name}
                            </span>
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
                <div className="hidden shrink-0 items-center justify-center md:flex">
                  <div
                    className="relative flex flex-col items-center justify-center overflow-hidden rounded-[2rem] border border-white/15 bg-white/[0.06] text-center backdrop-blur-sm"
                    style={{ width: "703px", height: "400.6px" }}
                  >
                    {color !== DEFAULT_COLOR && (
                      <div
                        className="pointer-events-none absolute inset-0"
                        style={{ background: colorWash(color, fadeIntensity, 70) }}
                      />
                    )}
                    <div className="relative z-10 flex h-40 w-40 items-center justify-center overflow-hidden rounded-full text-5xl font-black uppercase text-white drop-shadow-lg">
                      {image ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={image}
                          alt="Profile"
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center bg-white/10">
                          {name.slice(0, 1) || "?"}
                        </div>
                      )}
                    </div>
                    <p className="relative z-10 mt-8 break-all text-center text-[3rem] font-black uppercase leading-none text-white drop-shadow-lg">
                      {name || "NAME"}
                    </p>
                    <p className="relative z-10 mt-3 text-sm font-bold uppercase tracking-[0.4em] text-white">
                      Punkte: 0
                    </p>
                    {frame === "frame1" && <WalkingCat cardWidth={703} />}
                  </div>
                </div>
              </div>
            </div>
          )}
        </>
      )}

      {inLobby && (
        <div
          className="absolute inset-0 z-20 px-4 py-4 text-white sm:px-6 sm:py-6 md:px-8 md:py-8"
          style={lobbyEnterStyle()}
        >
          <div className="mx-auto flex h-full w-full max-w-[96rem] flex-col">
            <div className="grid h-full min-h-0 grid-cols-1 gap-4 xl:grid-cols-[minmax(0,2.4fr)_minmax(22rem,1fr)]">
              <div className="flex min-h-0 flex-col gap-4">
                <GlassCard className="relative px-5 py-5 sm:px-6 sm:py-6">
                  <p className="text-sm font-black uppercase tracking-[0.32em] text-white/50">
                    Lobbycode
                  </p>
                  <p className="mt-3 font-mono text-[clamp(2.3rem,6vw,4.8rem)] font-black uppercase tracking-[0.28em] text-white">
                    {lobbyCode}
                  </p>
                  <button
                    onClick={copyCode}
                    className="absolute right-4 top-4 flex items-center gap-2 rounded-[1rem] border border-white/30 bg-white/10 px-3 py-2 text-sm font-bold uppercase tracking-wide text-white backdrop-blur-sm transition-all duration-200 hover:-translate-y-0.5 hover:bg-white/20 sm:right-5 sm:top-5"
                  >
                    {copied ? <Check size={18} /> : <Copy size={18} />}
                    {copied ? "Kopiert" : "Kopieren"}
                  </button>
                </GlassCard>
                <GlassCard className="flex min-h-0 flex-1 flex-col p-3 sm:p-4">
                  <div className="custom-scroll grid auto-rows-[minmax(11rem,1fr)] grid-cols-1 gap-3 overflow-y-auto md:grid-cols-2 2xl:grid-cols-3">
                    {players.map((player) => {
                      const displayName =
                        player.id === selfId ? name || "NAME" : player.name;
                      const displayColor = player.id === selfId ? color : player.color;
                      const displayIntensity =
                        player.id === selfId ? fadeIntensity : player.fadeIntensity;
                      const displayImage = player.id === selfId ? image : player.image;
                      const displayFrame = player.id === selfId ? frame : player.frame;
                      return (
                        <div
                          key={player.id || player.name}
                          className="relative flex min-h-[11rem] flex-col items-center justify-center overflow-hidden rounded-[1.4rem] border border-white/15 bg-white/[0.06] px-4 py-5 text-center backdrop-blur-sm"
                        >
                          {displayColor && displayColor !== DEFAULT_COLOR && (
                            <div
                              className="pointer-events-none absolute inset-0"
                              style={{
                                background: colorWash(
                                  displayColor,
                                  displayIntensity ?? 50,
                                  70,
                                ),
                              }}
                            />
                          )}
                          <div className="relative z-10 flex h-20 w-20 items-center justify-center overflow-hidden rounded-full text-xl font-black uppercase text-white drop-shadow-md">
                            {displayImage ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img
                                src={displayImage}
                                alt="Profile"
                                className="h-full w-full object-cover"
                              />
                            ) : (
                              <div className="flex h-full w-full items-center justify-center bg-white/10">
                                {displayName.slice(0, 1) || "?"}
                              </div>
                            )}
                          </div>
                          {displayFrame === "frame1" && (
                            <WalkingCat cardWidth={280} />
                          )}
                          <p className="relative z-10 mt-4 break-all text-[1.6rem] font-black uppercase leading-none text-white drop-shadow-md sm:text-[1.9rem]">
                            {displayName}
                          </p>
                          {player.isHost && (
                            <p className="relative z-10 mt-2 text-xs font-bold uppercase tracking-[0.3em] text-white/50">
                              Host
                            </p>
                          )}
                        </div>
                      );
                    })}
                    <div className="min-h-[11rem] rounded-[1.4rem] border border-dashed border-white/20" />
                    <div className="hidden min-h-[11rem] rounded-[1.4rem] border border-dashed border-white/20 md:block" />
                    <div className="hidden min-h-[11rem] rounded-[1.4rem] border border-dashed border-white/20 2xl:block" />
                  </div>
                </GlassCard>
              </div>
              <aside className="flex min-h-0 flex-col gap-4">
                <GlassCard className="p-4">
                  <p className="text-xs font-black uppercase tracking-[0.28em] text-white/50">
                    Spielmodus
                  </p>
                  <div className="mt-3 flex items-center gap-4 rounded-[1.3rem] border border-white/15 bg-white/[0.06] px-3 py-3">
                    <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-[1rem] border border-white/30 text-xl font-black uppercase text-white">
                      {modeShort}
                    </div>
                    <div>
                      <p className="text-[1.75rem] font-black uppercase leading-tight text-white">
                        {modeLabel}
                      </p>
                      <p className="mt-1 text-sm font-semibold uppercase tracking-[0.2em] text-white/50">
                        Privatlobby · {players.length} Spieler verbunden
                      </p>
                    </div>
                  </div>
                </GlassCard>
                <GlassCard className="flex min-h-0 flex-1 flex-col p-4">
                  <p className="shrink-0 text-xs font-black uppercase tracking-[0.28em] text-white/50">
                    Rollen für diese Runde
                  </p>
                  <div className="custom-scroll mt-4 flex-1 space-y-2 overflow-y-auto pr-1">
                    {selectedRoles.length > 0 ? (
                      selectedRoles.map((role) => (
                        <button
                          key={role.name}
                          onClick={() => setRoleDetail(role.name)}
                          className="flex w-full items-center justify-between rounded-[1rem] border border-white/15 bg-white/5 px-3 py-2 text-left transition-all duration-150 hover:border-white/30 hover:bg-white/10"
                        >
                          <div className="flex items-center gap-3">
                            <div className="flex h-9 w-9 shrink-0 items-center justify-center text-[0.8rem] text-white/70">
                              <RoleIcon name={role.name} short={role.short} />
                            </div>
                            <span className="text-[1.05rem] font-bold uppercase text-white">
                              {role.name}
                            </span>
                          </div>
                          <span className="text-[1.1rem] font-black text-white">
                            {roleCounts[role.name]}
                          </span>
                        </button>
                      ))
                    ) : (
                      <div className="rounded-[1rem] border border-dashed border-white/20 bg-white/5 px-3 py-4 text-sm font-semibold text-white/45">
                        Keine Rollen ausgewählt.
                      </div>
                    )}
                  </div>
                  {isHost && (
                    <button
                      onClick={() => setRoleModalOpen(true)}
                      className="mt-4 rounded-[1rem] border border-white/30 bg-white/10 px-4 py-3 text-sm font-black uppercase tracking-[0.18em] text-white transition-all duration-200 hover:bg-white/20"
                    >
                      Rollen auswählen
                    </button>
                  )}
                </GlassCard>
                <GlassCard className="p-4">
                  <p className="text-xs font-black uppercase tracking-[0.28em] text-white/50">
                    Sonstige Regeln
                  </p>
                  <p className="mt-3 text-sm font-semibold text-white/30">
                    Keine besonderen Regeln festgelegt.
                  </p>
                </GlassCard>
                {isHost ? (
                  gameStarted ? (
                    <div className="flex flex-col gap-2">
                      <div className="rounded-[1.5rem] border border-green-400/40 bg-green-400/15 px-5 py-4 text-center text-[1.25rem] font-black uppercase tracking-[0.16em] text-green-200">
                        Spiel läuft
                      </div>
                      <button
                        onClick={() => handleStartGame(false)}
                        disabled={busy === "start"}
                        className="rounded-[1rem] border border-white/20 bg-white/5 px-4 py-2 text-xs font-bold uppercase tracking-[0.18em] text-white/60 transition-all duration-200 hover:bg-white/10 hover:text-white disabled:animate-pulse disabled:opacity-50"
                      >
                        Zurück zur Lobby
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => handleStartGame(true)}
                      disabled={busy === "start"}
                      className="rounded-[1.5rem] border border-white/30 bg-white/15 px-5 py-4 text-[1.25rem] font-black uppercase tracking-[0.16em] text-white backdrop-blur-sm transition-all duration-200 hover:-translate-y-1 hover:bg-white hover:text-black disabled:animate-pulse disabled:opacity-50"
                    >
                      {busy === "start" ? "Startet…" : "Spiel starten"}
                    </button>
                  )
                ) : (
                  <div
                    className={`rounded-[1.5rem] border px-5 py-4 text-center text-sm font-bold uppercase tracking-[0.16em] ${
                      gameStarted
                        ? "border-green-400/40 bg-green-400/15 text-green-200"
                        : "border-white/10 bg-white/5 text-white/40"
                    }`}
                  >
                    {gameStarted ? "Das Spiel läuft!" : "Warte auf Host…"}
                  </div>
                )}
              </aside>
            </div>
          </div>

          {detailRole &&
            (() => {
              const teamLabel =
                detailRole.team === "gut"
                  ? "Gut"
                  : detailRole.team === "böse"
                    ? "Böse"
                    : "Neutral";
              const teamText =
                detailRole.team === "gut"
                  ? "text-green-400"
                  : detailRole.team === "böse"
                    ? "text-red-400"
                    : "text-[#8ba4d4]";
              const teamBox =
                detailRole.team === "gut"
                  ? "border-green-400/40 bg-green-400/10"
                  : detailRole.team === "böse"
                    ? "border-red-400/40 bg-red-400/10"
                    : "border-[#6382be]/40 bg-[#6382be]/10";
              return (
                <div
                  className="absolute inset-0 z-50 flex items-center justify-center bg-[#030712]/80 px-4 py-6 backdrop-blur-md"
                  onClick={() => setRoleDetail(null)}
                >
                  <div
                    className="w-full max-w-[44rem] rounded-[2rem] border border-white/15 bg-[#0c1525]/95 p-6 shadow-[0_18px_80px_rgba(0,0,0,0.6)] backdrop-blur-2xl sm:p-8"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <div className="flex items-start gap-5">
                      <div
                        className={`flex h-28 w-28 shrink-0 items-center justify-center rounded-[1.2rem] border p-2 text-2xl text-white/70 ${teamBox}`}
                      >
                        <RoleIcon name={detailRole.name} short={detailRole.short} />
                      </div>
                      <div className="flex flex-col justify-center">
                        <h2 className="text-[2.2rem] font-black uppercase leading-none text-white sm:text-[2.8rem]">
                          {detailRole.name}
                        </h2>
                        <p className="mt-2.5 text-sm font-bold uppercase tracking-[0.2em]">
                          <span className="text-white/40">Team: </span>
                          <span className={teamText}>{teamLabel}</span>
                        </p>
                      </div>
                    </div>
                    <div className="my-6 h-[1px] w-full bg-gradient-to-r from-transparent via-white/20 to-transparent" />
                    <div>
                      <p className="text-xs font-black uppercase tracking-[0.28em] text-white/40">
                        Beschreibung
                      </p>
                      <p className="mt-3 text-[1rem] font-medium leading-7 text-white/75">
                        {detailRole.description}
                      </p>
                    </div>
                    <div className="my-6 h-[1px] w-full bg-gradient-to-r from-transparent via-white/20 to-transparent" />
                    <div>
                      <p className="text-xs font-black uppercase tracking-[0.28em] text-white/40">
                        Gewinnkondition
                      </p>
                      <p className="mt-3 text-[1rem] font-medium leading-7 text-white/50">
                        {winCondition(detailRole)}
                      </p>
                    </div>
                    <button
                      onClick={() => setRoleDetail(null)}
                      className="mt-8 w-full rounded-[1.2rem] border border-white/20 bg-white/10 py-3 text-sm font-black uppercase tracking-[0.2em] text-white transition-all duration-200 hover:bg-white/20"
                    >
                      Schließen
                    </button>
                  </div>
                </div>
              );
            })()}

          {roleModalOpen && (
            <div
              className="absolute inset-0 z-40 flex items-center justify-center bg-[#030712]/85 px-4 py-6 backdrop-blur-lg"
              onClick={() => setRoleModalOpen(false)}
            >
              <div
                className="flex h-[min(90vh,58rem)] w-full max-w-[84rem] flex-col rounded-[2rem] p-2 sm:p-4"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="flex shrink-0 items-center justify-between gap-4 pb-4">
                  <div>
                    <p className="text-xs font-black uppercase tracking-[0.3em] text-white/45">
                      Rollen auswählen
                    </p>
                    <h2 className="mt-2 text-[1.8rem] font-black uppercase text-white sm:text-[2.2rem]">
                      Rollen-Konfiguration
                    </h2>
                  </div>
                  <button
                    onClick={() => setRoleModalOpen(false)}
                    className="group flex h-12 w-12 shrink-0 items-center justify-center rounded-full border border-white/10 bg-transparent text-white/50 transition-all duration-200 hover:border-white/30 hover:bg-white/10 hover:text-white"
                    aria-label="Popup schließen"
                  >
                    <X
                      size={22}
                      className="transition-transform duration-200 group-hover:rotate-90"
                    />
                  </button>
                </div>
                <div className="custom-scroll mt-4 min-h-0 flex-1 overflow-y-auto pr-1">
                  {(["gut", "böse", "neutral"] as const).map((team, teamIdx) => {
                    const teamRoles = ROLES.filter((r) => r.team === team);
                    const sectionLabel =
                      team === "gut"
                        ? "Gute Rollen"
                        : team === "böse"
                          ? "Böse Rollen"
                          : "Neutrale Rollen";
                    const accentColor =
                      team === "gut"
                        ? "rgba(34,197,94,0.7)"
                        : team === "böse"
                          ? "rgba(239,68,68,0.7)"
                          : "rgba(99,130,190,0.7)";
                    const cardClasses =
                      team === "gut"
                        ? "border-green-400/30 bg-green-400/[0.09]"
                        : team === "böse"
                          ? "border-red-400/30 bg-red-400/[0.09]"
                          : "border-[#6382be]/30 bg-[#6382be]/[0.09]";
                    const iconClasses =
                      team === "gut"
                        ? "border-green-400/40 bg-green-400/10"
                        : team === "böse"
                          ? "border-red-400/40 bg-red-400/10"
                          : "border-[#6382be]/40 bg-[#6382be]/10";
                    return (
                      <div key={team} className={teamIdx > 0 ? "mt-5" : ""}>
                        <div className="mb-3 flex items-center gap-0">
                          <div
                            className="h-[1.5px] flex-1"
                            style={{
                              background: `linear-gradient(to right, transparent, ${accentColor} 40%, ${accentColor} 60%, transparent)`,
                            }}
                          />
                          <span
                            className="mx-3 shrink-0 text-[0.7rem] font-black uppercase tracking-[0.25em]"
                            style={{ color: accentColor }}
                          >
                            {sectionLabel}
                          </span>
                          <div
                            className="h-[1.5px] flex-1"
                            style={{
                              background: `linear-gradient(to left, transparent, ${accentColor} 40%, ${accentColor} 60%, transparent)`,
                            }}
                          />
                        </div>
                        <div className="grid grid-cols-1 gap-x-3 gap-y-2 sm:grid-cols-2 xl:grid-cols-3">
                          {teamRoles.map((role) => (
                            <div
                              key={role.name}
                              className={`group relative z-0 flex h-[5.4rem] items-center gap-4 rounded-[1.2rem] border px-4 backdrop-blur-sm hover:z-50 ${cardClasses}`}
                            >
                              <div
                                className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-[0.9rem] border p-2 text-base text-white/70 ${iconClasses}`}
                              >
                                <RoleIcon name={role.name} short={role.short} />
                              </div>
                              <div className="flex min-w-0 flex-1 flex-col items-center justify-center">
                                <span className="text-[1.12rem] font-black uppercase leading-none text-white">
                                  {role.name}
                                </span>
                                <div className="mt-1.5 flex items-center gap-3">
                                  <button
                                    onClick={() => changeRoleCount(role.name, 1)}
                                    className="text-white/60 transition-all hover:text-white"
                                  >
                                    <Plus size={18} />
                                  </button>
                                  <span className="min-w-[1.6rem] text-center text-[1.12rem] font-black text-white">
                                    {roleCounts[role.name] ?? 0}
                                  </span>
                                  <button
                                    onClick={() => changeRoleCount(role.name, -1)}
                                    disabled={(roleCounts[role.name] ?? 0) === 0}
                                    className="text-white/60 transition-all hover:text-white disabled:opacity-20"
                                  >
                                    <Minus size={18} />
                                  </button>
                                </div>
                              </div>
                              <div className="relative shrink-0">
                                <div className="peer flex h-[2.1rem] w-[2.1rem] cursor-default items-center justify-center rounded-full border border-white/20 text-white/40 transition-all hover:bg-white/10 hover:text-white">
                                  <Info size={17} />
                                </div>
                                <div className="pointer-events-none absolute right-0 top-11 z-50 w-56 rounded-[0.95rem] border border-white/20 bg-[#0c1525]/98 px-3 py-2 text-[0.78rem] font-medium leading-5 text-white/85 opacity-0 shadow-[0_8px_30px_rgba(0,0,0,0.6)] backdrop-blur-2xl transition-opacity duration-200 peer-hover:pointer-events-auto peer-hover:opacity-100">
                                  {role.description}
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
```

## Datei: `src/components/werwolf/sky-background.tsx`

```tsx
"use client";

export function SkyBackground({ isActive }: { isActive: boolean }) {
  return (
    <div
      className={`pointer-events-none absolute inset-0 z-0 transition-opacity duration-1000 ${
        isActive ? "opacity-100" : "opacity-0"
      }`}
    >
      {/* Ebenen von hinten nach vorne: sky (z-0) → clouds (z-10) → foreground (z-20).
          Der z-Index der Wolken liegt auf den animierten, geblendeten Elementen selbst
          (nicht auf den overflow-hidden-Wrappern), damit mix-blend-screen weiterhin
          gegen den Himmel blendet und der Vordergrund trotzdem davor liegt. */}
      <div className="absolute inset-0 z-0 bg-[url('/sky.png')] bg-cover bg-center" />
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute left-0 top-0 z-10 flex h-full w-[200vw] animate-[slideCloudsRight_140s_linear_infinite] opacity-40 mix-blend-screen">
          <div className="h-full w-[100vw] scale-x-[-1.1] scale-y-110 bg-[url('/clouds.png')] bg-cover bg-center" />
          <div className="h-full w-[100vw] scale-x-[-1.1] scale-y-110 bg-[url('/clouds.png')] bg-cover bg-center" />
        </div>
      </div>
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute left-0 top-0 z-10 flex h-full w-[200vw] animate-[slideCloudsRight_80s_linear_infinite] opacity-75 mix-blend-screen">
          <div className="h-full w-[100vw] bg-[url('/clouds.png')] bg-cover bg-center" />
          <div className="h-full w-[100vw] bg-[url('/clouds.png')] bg-cover bg-center" />
        </div>
      </div>
      {/* Vordergrund liegt deckend vor den Wolken. Bewusst ohne Maske/Verlauf:
          eine Ausblendung der oberen Bildhälfte ließ die Wolken vor dem Dorf
          durchscheinen, obwohl die Ebene korrekt gestapelt war. */}
      <div className="absolute inset-0 z-20 bg-[url('/foreground.png')] bg-bottom bg-cover bg-no-repeat" />
    </div>
  );
}
```

## Datei: `src/components/werwolf/walking-cat.tsx`

```tsx
"use client";

import { useEffect, useState } from "react";

export function WalkingCat({ cardWidth }: { cardWidth: number }) {
  const [frame, setFrame] = useState(0);
  const [position, setPosition] = useState(0);
  const [forward, setForward] = useState(true);
  const [failed, setFailed] = useState(false);

  const size = Math.max(16, cardWidth / 8);
  const maxPosition = cardWidth - size;

  useEffect(() => {
    const interval = setInterval(() => setFrame((f) => (f === 0 ? 1 : 0)), 300);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const interval = setInterval(() => {
      setPosition((current) => {
        const step = Math.max(0.5, cardWidth / 200);
        let next = forward ? current + step : current - step;
        if (next >= maxPosition) {
          next = maxPosition;
          setForward(false);
        } else if (next <= 0) {
          next = 0;
          setForward(true);
        }
        return next;
      });
    }, 16);
    return () => clearInterval(interval);
  }, [forward, maxPosition, cardWidth]);

  if (failed) return null;

  const src =
    frame === 0 ? "/frames/GrayCatWalkingOne.png" : "/frames/GrayCatWalkingTwo.png";

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt="Walking Cat"
      onError={() => setFailed(true)}
      className="pointer-events-none absolute bottom-0"
      style={{
        width: size,
        height: size,
        left: position,
        transform: forward ? "scaleX(1)" : "scaleX(-1)",
        objectFit: "contain",
      }}
      draggable={false}
    />
  );
}
```

## Datei: `src/components/werwolf/role-icon.tsx`

```tsx
"use client";

import { useState } from "react";

export function RoleIcon({
  name,
  short,
  className = "",
}: {
  name: string;
  short?: string;
  className?: string;
}) {
  const [failed, setFailed] = useState(false);

  if (failed) {
    return (
      <span
        className={`flex h-full w-full items-center justify-center font-black uppercase tracking-wide ${className}`}
      >
        {short ?? name.slice(0, 2)}
      </span>
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={`/roles/${encodeURIComponent(name)}icon.svg`}
      alt={name}
      onError={() => setFailed(true)}
      className={`h-full w-full object-contain ${className}`}
      draggable={false}
    />
  );
}
```

## Datei: `src/components/werwolf/glass-card.tsx`

```tsx
import type { ReactNode } from "react";

export function GlassCard({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`rounded-[1.75rem] border border-white/15 bg-white/[0.06] shadow-[0_8px_32px_rgba(0,0,0,0.35)] backdrop-blur-md ${className}`}
    >
      {children}
    </div>
  );
}
```

## Datei: `scripts/build-readme.mjs`

````js
#!/usr/bin/env node
/**
 * Generiert public/README.md mit dem VOLLSTÄNDIGEN Quellcode des Projekts.
 * Aufruf: node scripts/build-readme.mjs
 *
 * Ziel: Wer die Website-URL kennt, kann über <url>/README.md alle Dateien
 * 1:1 rekonstruieren (Textdateien inline, Binärdateien per Pfad ladbar).
 */
import { readFileSync, writeFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

const ROOT = process.cwd();

/** Textdateien, die vollständig eingebettet werden (Reihenfolge = Ausgabe). */
const TEXT_FILES = [
  "package.json",
  "next.config.ts",
  "tsconfig.json",
  "drizzle.config.json",
  "postcss.config.mjs",
  "src/db/index.ts",
  "src/db/migrate.ts",
  "src/db/schema.ts",
  "src/lib/game.ts",
  "src/lib/lobby-service.ts",
  "src/app/layout.tsx",
  "src/app/page.tsx",
  "src/app/globals.css",
  "src/app/api/health/route.ts",
  "src/app/api/lobby/create/route.ts",
  "src/app/api/lobby/join/route.ts",
  "src/app/api/lobby/state/route.ts",
  "src/app/api/lobby/profile/route.ts",
  "src/app/api/lobby/roles/route.ts",
  "src/app/api/lobby/start/route.ts",
  "src/app/api/lobby/leave/route.ts",
  "src/components/werwolf/werwolf-app.tsx",
  "src/components/werwolf/sky-background.tsx",
  "src/components/werwolf/walking-cat.tsx",
  "src/components/werwolf/role-icon.tsx",
  "src/components/werwolf/glass-card.tsx",
  "scripts/build-readme.mjs",
];

/** Binärdateien: nicht inline, sondern über die Website-URL ladbar. */
const BINARY_FILES = [
  "public/sky.png",
  "public/clouds.png",
  "public/foreground.png",
  "public/frames/GrayCatWalkingOne.png",
  "public/frames/GrayCatWalkingTwo.png",
];

function langFor(path) {
  if (path.endsWith(".ts") || path.endsWith(".tsx")) return "tsx";
  if (path.endsWith(".css")) return "css";
  if (path.endsWith(".json")) return "json";
  if (path.endsWith(".mjs")) return "js";
  if (path.endsWith(".svg")) return "xml";
  return "";
}

function fence(content) {
  // Längeren Zaun wählen, falls der Inhalt bereits ``` enthält.
  let longest = 0;
  for (const match of content.matchAll(/`+/g)) {
    longest = Math.max(longest, match[0].length);
  }
  return "`".repeat(Math.max(3, longest + 1));
}

const svgFiles = readdirSync(join(ROOT, "public/roles"))
  .filter((f) => f.endsWith(".svg"))
  .sort()
  .map((f) => `public/roles/${f}`);

const allTextFiles = [
  ...TEXT_FILES,
  "public/favicon-light.svg",
  "public/favicon-dark.svg",
  ...svgFiles,
];

const sections = [];
sections.push(`# Werwolf Lobby — Vollständiger Quellcode

> **ANLEITUNG FÜR KI-ASSISTENTEN / MENSCHEN ZUM 1:1-WIEDERAUFBAU:**
> Diese Datei enthält den KOMPLETTEN Quellcode aller Textdateien dieses Projekts.
> Jede Datei beginnt mit einer Überschrift \`## Datei: <pfad>\`, gefolgt von genau
> einem Code-Block, dessen Inhalt EXAKT so (Byte für Byte) unter dem angegebenen
> Pfad gespeichert werden muss. Binärdateien (Bilder) sind unten gelistet und
> können direkt von diesem Server unter ihrem Pfad heruntergeladen werden
> (z. B. \`GET /sky.png\` → speichern als \`public/sky.png\`).
>
> **Reihenfolge beim Wiederaufbau:**
> 1. Leeres Next.js-Projekt anlegen (oder Dateien einfach in einen Ordner schreiben).
> 2. ALLE Textdateien exakt wie hier abgedruckt anlegen.
> 3. Alle Binärdateien von dieser Website herunterladen (Liste unten).
> 4. \`npm install\` → \`npm run build\` → \`npm run start\` — fertig, die App läuft
>    1:1 identisch OHNE jede Datenbank-Vorbereitung: ohne \`DATABASE_URL\` wird
>    automatisch eine eingebettete PostgreSQL-Datenbank (PGlite) in \`.data/\` angelegt.
> 5. Optional: \`.env\` mit \`DATABASE_URL=postgresql://…\` für eine externe
>    PostgreSQL-Datenbank — die Tabellen werden ebenfalls automatisch angelegt
>    (kein \`drizzle-kit push\` nötig).

## Projektübersicht

Mehrspieler-Lobby für das Partyspiel **Werwolf** (Bonus-Modus: **Höhle der Löwen**):

- **Menü**: Spielmodus-Karussell (SPIELMODUS 1/2) mit Slide-Animation, Nachthimmel
  mit Wolken-Parallax und Dorf-Silhouette, „Lobby erstellen" / „Lobby beitreten"
  (6-stelliger Code, A–Z), Menüpunkte „Spielerkarte" / „Statistiken" / „Einstellungen".
- **Spielerkarte**: Name (max. 12 Zeichen), Farbe + Intensität (135°-Farbverlauf),
  Profilbild-Upload (Data-URL), Rahmenwahl (Rahmen 1 = laufende Katze \`Cd\`/\`WalkingCat\`).
  Persistenz in \`localStorage\` unter \`werwolf-player-profile\`.
- **Lobby**: kopierbarer Lobbycode, Glaskarten-Grid der Spieler (Farbe/Avatar/Host-Badge),
  Seitenleiste mit Spielmodus, „Rollen für diese Runde", „Sonstige Regeln",
  „Spiel starten" (Host) bzw. „Warte auf Host…" (Gäste).
- **15 Rollen** (Teams gut/böse/neutral) mit Beschreibung, Gewinnkondition und
  Host-Zählern; Standard: 1× Werwolf, 2× Dorfbewohner.
- **Einladungslink**: \`?code=ABCDEF\` öffnet das Beitreten-Feld vorausgefüllt.
- **Realtime**: REST-Polling (1,2 s) + Heartbeat-Cleanup (15 s), automatische
  Host-Nachfolge, Lobbys/Spieler in PostgreSQL via Drizzle ORM. „Spiel starten"
  (Host) synchronisiert den Spielstart in Echtzeit an alle Spieler.

## Binärdateien (von diesem Server laden, nicht inline)

${BINARY_FILES.map((f) => `- \`/${f.replace(/^public\//, "")}\` → speichern als \`${f}\``).join("\n")}

Falls ein Asset nicht mehr lädt: beliebige dunkle Nachthimmel-/Wolken-/Dorfsilhouetten-
Grafiken erzeugen ein nahezu identisches Bild; die Katzen-Sprites sind zwei Laufphasen
einer grauen Katze (transparente PNGs).

## Verzeichnisstruktur

\`\`\`
${[...allTextFiles.filter((f) => f !== "scripts/build-readme.mjs"), ...BINARY_FILES].join("\n")}
\`\`\`

---
`);

for (const file of allTextFiles) {
  const content = readFileSync(join(ROOT, file), "utf8");
  const f = fence(content);
  sections.push(`## Datei: \`${file}\`\n\n${f}${langFor(file)}\n${content.replace(/\s+$/, "")}\n${f}\n`);
}

const output = sections.join("\n");
writeFileSync(join(ROOT, "public/README.md"), output, "utf8");
console.log(`public/README.md geschrieben (${(output.length / 1024).toFixed(1)} KB, ${allTextFiles.length} Textdateien).`);
````

## Datei: `public/favicon-light.svg`

````xml
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
  <circle cx="32" cy="32" r="30" fill="#0b1220"/>
  <path d="M42.5 12a21 21 0 1 0 9.4 27.6A17.5 17.5 0 0 1 42.5 12z" fill="#f1f5f9"/>
  <circle cx="24" cy="30" r="2.4" fill="#0b1220"/>
  <path d="M16 44c3-5 8-8 13-8" stroke="#0b1220" stroke-width="2.6" fill="none" stroke-linecap="round"/>
</svg>
```

## Datei: `public/favicon-dark.svg`
````

## Datei: `public/favicon-dark.svg`

````xml
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
  <circle cx="32" cy="32" r="30" fill="#f1f5f9"/>
  <path d="M42.5 12a21 21 0 1 0 9.4 27.6A17.5 17.5 0 0 1 42.5 12z" fill="#0b1220"/>
  <circle cx="24" cy="30" r="2.4" fill="#f1f5f9"/>
  <path d="M16 44c3-5 8-8 13-8" stroke="#f1f5f9" stroke-width="2.6" fill="none" stroke-linecap="round"/>
</svg>
```

## Datei: `public/roles/Amoricon.svg`
````

## Datei: `public/roles/Amoricon.svg`

````xml
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" fill="none" stroke="#ffffff" stroke-opacity="0.85" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round">
  <path d="M24 40S8 30 8 18.5C8 12.5 12.5 9 17 9c3 0 5.5 1.5 7 4 1.5-2.5 4-4 7-4 4.5 0 9 3.5 9 9.5C40 30 24 40 24 40z"/>
  <path d="M30 8l10-4M40 4l-3 1M40 4l-1 3" />
  <path d="M40 4L30 16"/>
</svg>
```

## Datei: `public/roles/Bürgermeistericon.svg`
````

## Datei: `public/roles/Bürgermeistericon.svg`

````xml
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" fill="none" stroke="#ffffff" stroke-opacity="0.85" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round">
  <path d="M16 30V12h16v18"/>
  <path d="M10 30h28"/>
  <path d="M14 38h20"/>
  <path d="M16 21h16"/>
  <circle cx="24" cy="15.5" r="1.6" fill="#ffffff" stroke="none"/>
</svg>
```

## Datei: `public/roles/Detektivicon.svg`
````

## Datei: `public/roles/Detektivicon.svg`

````xml
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" fill="none" stroke="#ffffff" stroke-opacity="0.85" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round">
  <circle cx="20" cy="20" r="11"/>
  <path d="M28 28l13 13"/>
  <path d="M15 20c1.5-3 4-4.5 7-4"/>
</svg>
```

## Datei: `public/roles/Diebicon.svg`
````

## Datei: `public/roles/Diebicon.svg`

````xml
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" fill="none" stroke="#ffffff" stroke-opacity="0.85" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round">
  <path d="M6 20c4-3 8-4.5 12-4.5S26 17 30 20c2-1.2 5-2 8-2-1 8-6 13-14 13S8 28 6 20z"/>
  <circle cx="17" cy="21.5" r="1.7" fill="#ffffff" stroke="none"/>
  <path d="M28 21c1.8.6 3.6 1.7 5 3"/>
  <path d="M14 38c3-2.5 7-4 10-4s7 1.5 10 4" stroke-dasharray="0.5 4"/>
</svg>
```

## Datei: `public/roles/Doktoricon.svg`
````

## Datei: `public/roles/Doktoricon.svg`

````xml
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" fill="none" stroke="#ffffff" stroke-opacity="0.85" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round">
  <path d="M24 5l14 5v11c0 10-6.5 17-14 22C16.5 38 10 31 10 21V10l14-5z"/>
  <path d="M24 17v14M17 24h14"/>
</svg>
```

## Datei: `public/roles/Dorfbewohnericon.svg`
````

## Datei: `public/roles/Dorfbewohnericon.svg`

````xml
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" fill="none" stroke="#ffffff" stroke-opacity="0.85" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round">
  <path d="M8 24L24 10l16 14"/>
  <path d="M12 22v16h24V22"/>
  <path d="M20 38v-9h8v9"/>
</svg>
```

## Datei: `public/roles/Dorftrottelicon.svg`
````

## Datei: `public/roles/Dorftrottelicon.svg`

````xml
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" fill="none" stroke="#ffffff" stroke-opacity="0.85" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round">
  <path d="M8 34c2-8 4-12 8-14-1-3 0-6 3-7 2 3 5 3 7 0 2 2 2 6 0 8 4 2 8 6 10 13"/>
  <circle cx="15" cy="35.5" r="2.2"/>
  <circle cx="33" cy="35.5" r="2.2"/>
  <circle cx="24" cy="41" r="2.2"/>
  <path d="M15 34l7 5M33 34l-7 5"/>
</svg>
```

## Datei: `public/roles/Goetheicon.svg`
````

## Datei: `public/roles/Goetheicon.svg`

````xml
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" fill="none" stroke="#ffffff" stroke-opacity="0.85" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round">
  <path d="M34 6c4 0 8 3 8 8 0 9-9 20-18 26l-3-3c6-9 6-18 7-22 1-5 3-9 6-9z"/>
  <path d="M21 37l-9 5 4-10"/>
  <path d="M27 20c2 2 5 2 7 0"/>
</svg>
```

## Datei: `public/roles/Hexeicon.svg`
````

## Datei: `public/roles/Hexeicon.svg`

````xml
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" fill="none" stroke="#ffffff" stroke-opacity="0.85" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round">
  <path d="M18 8h12"/>
  <path d="M20 8v8L12 34c-1.4 2.6.6 6 4 6h16c3.4 0 5.4-3.4 4-6L28 16V8"/>
  <path d="M15 30h18"/>
  <circle cx="21" cy="34" r="1.6" fill="#ffffff" stroke="none"/>
  <circle cx="27" cy="36" r="1.3" fill="#ffffff" stroke="none"/>
</svg>
```

## Datei: `public/roles/Jägericon.svg`
````

## Datei: `public/roles/Jägericon.svg`

````xml
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" fill="none" stroke="#ffffff" stroke-opacity="0.85" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round">
  <circle cx="24" cy="24" r="14"/>
  <circle cx="24" cy="24" r="7"/>
  <circle cx="24" cy="24" r="1.8" fill="#ffffff" stroke="none"/>
  <path d="M24 4v8M24 36v8M4 24h8M36 24h8"/>
</svg>
```

## Datei: `public/roles/Kopfgeldjägericon.svg`
````

## Datei: `public/roles/Kopfgeldjägericon.svg`

````xml
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" fill="none" stroke="#ffffff" stroke-opacity="0.85" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round">
  <path d="M24 6l4.8 9.6L40 17l-8 7.8L34 36l-10-5.2L14 36l2-11.2L8 17l11.2-1.4L24 6z"/>
  <circle cx="24" cy="22" r="3.4"/>
</svg>
```

## Datei: `public/roles/Mediumicon.svg`
````

## Datei: `public/roles/Mediumicon.svg`

````xml
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" fill="none" stroke="#ffffff" stroke-opacity="0.85" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round">
  <circle cx="24" cy="22" r="13"/>
  <path d="M16 40h16M19 35h10"/>
  <path d="M19 20c1.5-2 4-2 5 0s3.5 2 5 0"/>
  <path d="M18 26c2 2.5 4 2.5 6 0s4-2.5 6 0" stroke-dasharray="1 3.5"/>
</svg>
```

## Datei: `public/roles/Sandmannicon.svg`
````

## Datei: `public/roles/Sandmannicon.svg`

````xml
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" fill="none" stroke="#ffffff" stroke-opacity="0.85" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round">
  <path d="M30 8a14 14 0 1 0 8 22A12 12 0 0 1 30 8z"/>
  <path d="M34 32h7l-7 8h7"/>
  <path d="M10 10l3 3M13 9v4M9 13h4" />
</svg>
```

## Datei: `public/roles/Sehericon.svg`
````

## Datei: `public/roles/Sehericon.svg`

````xml
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" fill="none" stroke="#ffffff" stroke-opacity="0.85" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round">
  <path d="M4 24c6-8 12-12 20-12s14 4 20 12c-6 8-12 12-20 12S10 32 4 24z"/>
  <circle cx="24" cy="24" r="7"/>
  <circle cx="24" cy="24" r="2.4" fill="#ffffff" stroke="none"/>
</svg>
```

## Datei: `public/roles/Werwolficon.svg`
````

## Datei: `public/roles/Werwolficon.svg`

````xml
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" fill="none" stroke="#ffffff" stroke-opacity="0.85" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round">
  <path d="M10 6l6 8 8-3 8 3 6-8 3 12c0 2-1 4-3 5 3 2 4 5 4 8 0 7-8 11-18 11S6 38 6 31c0-3 1-6 4-8-2-1-3-3-3-5l3-12z"/>
  <circle cx="17.5" cy="27" r="1.6" fill="#ffffff" stroke="none"/>
  <circle cx="30.5" cy="27" r="1.6" fill="#ffffff" stroke="none"/>
  <path d="M24 33l-3 3h6l-3-3z" fill="#ffffff" stroke="none"/>
  <path d="M20 38c1.5 1.2 2.7 1.8 4 1.8s2.5-.6 4-1.8"/>
</svg>
```
````
