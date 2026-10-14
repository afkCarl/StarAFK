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
  /**
   * Neon-Auth-Nutzer (`user.id` aus der Session), sobald Login aktiv ist.
   * Verknüpft die Spielfigur mit dem Konto: nur wer angemeldet ist und zu
   * dieser Zeile gehört, darf sie verändern. NULL = Zeile aus der Zeit ohne
   * Login (oder Login ist nicht konfiguriert).
   */
  userId: text("user_id"),
  name: text("name").notNull(),
  color: text("color").notNull(),
  fadeIntensity: integer("fade_intensity").notNull().default(50),
  frame: text("frame").notNull().default("none"),
  /**
   * Profilbild als Data-URL. ACHTUNG: Diese Spalte wird absichtlich NICHT in
   * den Lobby-Zustand geladen – Bilder sind groß (bis ~200 KB) und würden jede
   * Statusabfrage im Sekundentakt aufblähen. Ausgeliefert werden sie separat
   * über `GET /api/lobby/avatar?pid=…&v=…` (mit langem Browser-Cache).
   */
  image: text("image"),
  /**
   * Schlüssel des Profilbilds im Neon-Object-Storage-Bucket (`assets`), z. B.
   * `avatars/<player-id>/<uuid>.jpg`. Ist er gesetzt, liegen die Bilddaten NICHT
   * in der Datenbank, sondern im Bucket; `image` bleibt als Fallback (lokale
   * Entwicklung ohne Bucket) erhalten.
   */
  imageKey: text("image_key"),
  /** Zeitpunkt des letzten Bildwechsels – dient als Cache-Version in der Avatar-URL. */
  imageUpdatedAt: timestamp("image_updated_at", { withTimezone: true }),
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

/**
 * Vom AI Game Master (Neon Function `gamemaster`) erzeugte Texte. Pro Lobby
 * wird der jeweils neueste Text im Live-Zustand ausgeliefert, damit ihn alle
 * Spieler sehen – die vollständige Historie bleibt hier liegen.
 */
export const gameMasterLines = pgTable("game_master_lines", {
  id: uuid("id").primaryKey().defaultRandom(),
  lobbyCode: varchar("lobby_code", { length: 6 })
    .notNull()
    .references(() => lobbies.code, { onDelete: "cascade" }),
  /** Art des Textes: `intro` (Rollen-Intro), `night` (Nacht), `recap` (Lage). */
  kind: text("kind").notNull(),
  text: text("text").notNull(),
  /** Modell, das über das AI Gateway geantwortet hat. */
  model: text("model"),
  /** Neon-Auth-Nutzer, der den Text angestoßen hat. */
  createdBy: text("created_by"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export type GameMasterLineRow = typeof gameMasterLines.$inferSelect;
