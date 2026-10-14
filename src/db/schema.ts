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
