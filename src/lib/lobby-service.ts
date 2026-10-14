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
