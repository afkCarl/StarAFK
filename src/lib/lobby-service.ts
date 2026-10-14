import { and, asc, desc, eq, lt } from "drizzle-orm";

import { getDb } from "@/db";
import { gameMasterLines, lobbies, players } from "@/db/schema";
import {
  DEFAULT_COLOR,
  defaultRoleCounts,
  type LobbyNarration,
  type LobbyPlayer,
  type LobbyState,
  type PlayerProfile,
  ROLES,
} from "@/lib/game";
import { decodeImage, parseImageInput } from "@/lib/image";
import { deleteObject, putObject, storageEnabled } from "@/lib/storage";

/**
 * Nach dieser Zeit ohne Lebenszeichen gilt ein Spieler als getrennt.
 * Bewusst großzügig: Browser drosseln Timer im Hintergrund-Tab auf ~1/min und
 * Render-Free-Instanzen antworten manchmal erst nach Sekunden.
 */
const STALE_MS = Number(process.env.LOBBY_STALE_MS ?? 120_000);
/** Häufiger als das hier muss `last_seen` nicht geschrieben werden. */
const TOUCH_INTERVAL_MS = 20_000;
/** Aufräumen (stale Spieler) höchstens alle X ms pro Prozess. */
const CLEANUP_INTERVAL_MS = 10_000;
/** Alte Lobbys aufräumen höchstens alle X ms. */
const PURGE_INTERVAL_MS = 5 * 60_000;
/** Lobbys, die älter als ein Tag sind, werden automatisch gelöscht. */
const LOBBY_MAX_AGE_MS = 24 * 60 * 60 * 1000;
/** Leere Lobbys erst nach dieser Gnadenfrist löschen (Reconnect-Schutz). */
const EMPTY_LOBBY_GRACE_MS = 10 * 60_000;
const CODE_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
/** Spieler-IDs sind UUIDs (Postgres `gen_random_uuid()`). */
const UUID_RE = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;

/** Maximale Spielerzahl pro Lobby. */
export const MAX_PLAYERS = 12;

let lastCleanupAt = 0;
let lastPurgeAt = 0;

/** Profilfelder, die für den Lobby-Zustand gebraucht werden (ohne Bild!). */
const playerColumns = {
  id: players.id,
  userId: players.userId,
  name: players.name,
  color: players.color,
  fadeIntensity: players.fadeIntensity,
  frame: players.frame,
  isHost: players.isHost,
  createdAt: players.createdAt,
  lastSeen: players.lastSeen,
  imageUpdatedAt: players.imageUpdatedAt,
};

type PlayerSummary = {
  id: string;
  userId: string | null;
  name: string;
  color: string;
  fadeIntensity: number;
  frame: string;
  isHost: boolean;
  createdAt: Date;
  lastSeen: Date;
  imageUpdatedAt: Date | null;
};

/**
 * Zusatzbedingung für Schreibzugriffe, wenn Login aktiv ist: Nur der Besitzer
 * (Neon-Auth-Nutzer) darf die Zeile verändern. Ohne `userId` (Login aus, z. B.
 * lokale Entwicklung) bleibt das Verhalten wie vorher.
 */
function ownerFilter(userId?: string | null) {
  return userId ? eq(players.userId, userId) : undefined;
}

/** Profilbild-URL (klein, cachebar) – Bilddaten selbst liegen unter derselben Route. */
export function avatarUrl(playerId: string, version: Date | number): string {
  const v = version instanceof Date ? version.getTime() : version;
  return `/api/lobby/avatar?pid=${encodeURIComponent(playerId)}&v=${v}`;
}

export function sanitizeProfile(input: unknown): PlayerProfile {
  const patch = sanitizeProfilePatch(input);
  return {
    name: patch.name ?? "Player",
    color: patch.color ?? DEFAULT_COLOR,
    fadeIntensity: patch.fadeIntensity ?? 50,
    frame: patch.frame ?? "none",
    image: patch.image ?? null,
  };
}

/**
 * Wie `sanitizeProfile`, aber ohne Standardwerte: Es werden nur Felder
 * zurückgegeben, die tatsächlich mitgeschickt wurden. So kann ein Reconnect
 * (`resume`) das Profil nicht überschreiben.
 */
export function sanitizeProfilePatch(input: unknown): Partial<PlayerProfile> {
  const raw = (typeof input === "object" && input !== null ? input : {}) as Record<
    string,
    unknown
  >;
  const patch: Partial<PlayerProfile> = {};

  if (typeof raw.name === "string" && raw.name.trim()) {
    patch.name = raw.name.trim().slice(0, 12);
  }
  if (typeof raw.color === "string" && /^#[0-9a-fA-F]{6}$/.test(raw.color)) {
    patch.color = raw.color;
  }
  if (typeof raw.fadeIntensity === "number" && Number.isFinite(raw.fadeIntensity)) {
    patch.fadeIntensity = Math.max(0, Math.min(100, Math.round(raw.fadeIntensity)));
  }
  if (typeof raw.frame === "string") {
    patch.frame = raw.frame.slice(0, 24);
  }
  if (Object.prototype.hasOwnProperty.call(raw, "image")) {
    const parsed = parseImageInput(raw.image);
    if (parsed.ok) patch.image = parsed.image;
  }
  return patch;
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

export function normalizeCode(input: unknown): string {
  return String(input ?? "")
    .toUpperCase()
    .replace(/[^A-Z]/g, "")
    .slice(0, 6);
}

function generateCode(): string {
  let code = "";
  for (let i = 0; i < 6; i += 1) {
    code += CODE_ALPHABET[Math.floor(Math.random() * CODE_ALPHABET.length)];
  }
  return code;
}

function toLobbyPlayer(row: PlayerSummary): LobbyPlayer {
  return {
    id: row.id,
    name: row.name,
    color: row.color,
    fadeIntensity: row.fadeIntensity,
    frame: row.frame,
    isHost: row.isHost,
    image: row.imageUpdatedAt ? avatarUrl(row.id, row.imageUpdatedAt) : null,
  };
}

/**
 * Neuester Game-Master-Text der Lobby (Neon Function `gamemaster` schreibt ihn).
 * Kleiner Text → er darf problemlos im Sekunden-Polling mitfahren, damit ihn
 * alle Spieler gleichzeitig sehen.
 */
async function latestNarration(code: string): Promise<LobbyNarration | null> {
  const db = await getDb();
  const [line] = await db
    .select({
      kind: gameMasterLines.kind,
      text: gameMasterLines.text,
      model: gameMasterLines.model,
      createdAt: gameMasterLines.createdAt,
    })
    .from(gameMasterLines)
    .where(eq(gameMasterLines.lobbyCode, code))
    .orderBy(desc(gameMasterLines.createdAt))
    .limit(1);
  if (!line) return null;
  return {
    kind: line.kind,
    text: line.text,
    model: line.model,
    createdAt: line.createdAt.toISOString(),
  };
}

async function toState(
  code: string,
  rows: PlayerSummary[],
  roleCounts: Record<string, number>,
  gameStarted: boolean,
): Promise<LobbyState> {
  return {
    code,
    players: rows.map(toLobbyPlayer),
    roleCounts,
    gameStarted,
    narration: await latestNarration(code),
  };
}

async function listPlayers(code: string): Promise<PlayerSummary[]> {
  const db = await getDb();
  return db
    .select(playerColumns)
    .from(players)
    .where(eq(players.lobbyCode, code))
    .orderBy(asc(players.createdAt));
}

/** Entfernt verwaiste Lobbys, die älter als ein Tag sind (Spieler via Cascade). */
async function purgeOldLobbies(): Promise<void> {
  if (Date.now() - lastPurgeAt < PURGE_INTERVAL_MS) return;
  lastPurgeAt = Date.now();
  const db = await getDb();
  await db
    .delete(lobbies)
    .where(lt(lobbies.createdAt, new Date(Date.now() - LOBBY_MAX_AGE_MS)));
}

/** Entfernt Spieler, die sich lange nicht gemeldet haben (getrennte Tabs). */
async function cleanupStalePlayers(code: string): Promise<void> {
  if (Date.now() - lastCleanupAt < CLEANUP_INTERVAL_MS) return;
  lastCleanupAt = Date.now();
  const db = await getDb();
  await db
    .delete(players)
    .where(
      and(
        eq(players.lobbyCode, code),
        lt(players.lastSeen, new Date(Date.now() - STALE_MS)),
      ),
    );
}

async function touchPlayer(
  code: string,
  playerId: string,
  userId?: string | null,
): Promise<void> {
  const db = await getDb();
  await db
    .update(players)
    .set({ lastSeen: new Date() })
    .where(
      and(eq(players.id, playerId), eq(players.lobbyCode, code), ownerFilter(userId)),
    );
}

export type CreateOptions = {
  /** Wunschcode – für die Wiederherstellung einer Lobby nach einem Neustart. */
  code?: string;
  /** Bevorzugte Spieler-ID, damit ein Reconnect dieselbe Identität behält. */
  playerId?: string;
  /** Neon-Auth-Nutzer der Session (wird an die Spielerzeile gebunden). */
  userId?: string | null;
};

export type CreateOutcome =
  | { ok: true; selfId: string; lobby: LobbyState; reused: boolean }
  | { ok: false; reason: "full" };

/**
 * Lobby anlegen. Mit `options.code` wird – falls der Code noch frei ist –
 * genau dieser Code verwendet (Wiederherstellung nach einem Neustart der
 * Instanz); existiert er bereits, tritt der Spieler einfach dieser Lobby bei.
 */
export async function createLobby(
  mode: string,
  profileInput: unknown,
  options: CreateOptions = {},
): Promise<CreateOutcome> {
  const db = await getDb();

  // Nebenbei alte/verwaiste Lobbys aufräumen.
  await purgeOldLobbies();

  const preferred = normalizeCode(options.code ?? "");
  const wantedId =
    typeof options.playerId === "string" && UUID_RE.test(options.playerId)
      ? options.playerId
      : null;
  const roleCounts = defaultRoleCounts();

  let code = preferred.length === 6 ? preferred : generateCode();
  let created = false;
  for (let attempt = 0; attempt < 10; attempt += 1) {
    const inserted = await db
      .insert(lobbies)
      .values({ code, mode: mode || "WERWOLF", roleCounts })
      .onConflictDoNothing()
      .returning({ code: lobbies.code });
    if (inserted.length > 0) {
      created = true;
      break;
    }
    // Wunschcode belegt → bestehende Lobby übernehmen (kein Fehler).
    if (attempt === 0 && preferred.length === 6) break;
    code = generateCode();
  }

  const [lobby] = await db.select().from(lobbies).where(eq(lobbies.code, code));
  if (!lobby) throw new Error("Lobby konnte nicht angelegt werden");

  if (wantedId) {
    const [existing] = await db
      .select({ id: players.id, userId: players.userId })
      .from(players)
      .where(and(eq(players.id, wantedId), eq(players.lobbyCode, code)));
    if (existing) {
      // Fremde Spielfigur (anderes Konto) → keine Wiederherstellung.
      if (existing.userId && options.userId && existing.userId !== options.userId) {
        return { ok: false, reason: "full" };
      }
      if (options.userId && existing.userId !== options.userId) {
        // Zeile aus der Zeit ohne Login → dem Konto zuschreiben.
        await db
          .update(players)
          .set({ userId: options.userId })
          .where(and(eq(players.id, wantedId), eq(players.lobbyCode, code)));
      }
      await applyProfilePatch(code, wantedId, sanitizeProfilePatch(profileInput));
      const rows = await listPlayers(code);
      return {
        ok: true,
        selfId: wantedId,
        lobby: await toState(code, rows, lobby.roleCounts, lobby.gameStarted),
        reused: true,
      };
    }
  }

  const existingPlayers = await listPlayers(code);
  if (existingPlayers.length >= MAX_PLAYERS) {
    return { ok: false, reason: "full" };
  }

  const profile = sanitizeProfile(profileInput);
  const base = {
    lobbyCode: code,
    userId: options.userId ?? null,
    ...profile,
    imageUpdatedAt: profile.image ? new Date() : null,
    isHost: !existingPlayers.some((row) => row.isHost),
  };

  let self: PlayerSummary | undefined;
  if (wantedId) {
    [self] = await db
      .insert(players)
      .values({ id: wantedId, ...base })
      .onConflictDoNothing()
      .returning(playerColumns);
  }
  if (!self) {
    [self] = await db.insert(players).values(base).returning(playerColumns);
  }

  const rows = await listPlayers(code);
  return {
    ok: true,
    selfId: self.id,
    lobby: await toState(code, rows, lobby.roleCounts, lobby.gameStarted),
    reused: !created,
  };
}

export type JoinOutcome =
  | { ok: true; selfId: string; lobby: LobbyState; resumed: boolean }
  | { ok: false; reason: "not_found" | "full" };

/**
 * Beitreten – oder mit `playerId` wieder **beitreten (resume)**, nachdem der
 * Tab im Hintergrund war oder der Server kurz weg war. Die Spieler-ID bleibt
 * dabei gleich, die Rolle als Host geht nicht verloren.
 */
export async function joinLobby(
  codeInput: string,
  profileInput: unknown,
  options: { playerId?: string; userId?: string | null } = {},
): Promise<JoinOutcome> {
  const code = normalizeCode(codeInput);
  if (code.length !== 6) return { ok: false, reason: "not_found" };

  const db = await getDb();
  const [lobby] = await db.select().from(lobbies).where(eq(lobbies.code, code));
  if (!lobby) return { ok: false, reason: "not_found" };

  const patch = sanitizeProfilePatch(profileInput);
  const resumeId = options.playerId;

  if (resumeId) {
    const [existing] = await db
      .select({ id: players.id, userId: players.userId })
      .from(players)
      .where(and(eq(players.id, resumeId), eq(players.lobbyCode, code)));
    if (existing) {
      // Zeile gehört einem anderen Konto → nicht wiederherstellen.
      if (existing.userId && options.userId && existing.userId !== options.userId) {
        return { ok: false, reason: "not_found" };
      }
      if (options.userId && existing.userId !== options.userId) {
        // Zeile aus der Zeit ohne Login → jetzt dem Konto zuschreiben.
        await db
          .update(players)
          .set({ userId: options.userId })
          .where(and(eq(players.id, resumeId), eq(players.lobbyCode, code)));
      }
      await applyProfilePatch(code, resumeId, patch);
      const rows = await listPlayers(code);
      const state = await toState(code, rows, lobby.roleCounts, lobby.gameStarted);
      return { ok: true, selfId: resumeId, lobby: state, resumed: true };
    }

    // Der Tab hat sich beim Verlassen abgemeldet (z. B. Neuladen) – hier kommt
    // er sofort wieder. Wir legen dieselbe ID neu an, damit die Sitzung des
    // Browsers gültig bleibt; die Host-Rolle gibt es zurück, wenn sie frei ist.
    if (UUID_RE.test(resumeId)) {
      const current = await listPlayers(code);
      if (current.length < MAX_PLAYERS) {
        const profile = sanitizeProfile(profileInput);
        const [recreated] = await db
          .insert(players)
          .values({
            id: resumeId,
            lobbyCode: code,
            userId: options.userId ?? null,
            ...profile,
            imageUpdatedAt: profile.image ? new Date() : null,
            isHost: !current.some((row) => row.isHost),
          })
          .onConflictDoNothing()
          .returning(playerColumns);
        if (recreated) {
          const rows = await listPlayers(code);
          return {
            ok: true,
            selfId: recreated.id,
            lobby: await toState(code, rows, lobby.roleCounts, lobby.gameStarted),
            resumed: true,
          };
        }
      }
    }
  }

  const existingPlayers = await listPlayers(code);
  if (existingPlayers.length >= MAX_PLAYERS) {
    return { ok: false, reason: "full" };
  }

  const profile = sanitizeProfile(profileInput);
  const [self] = await db
    .insert(players)
    .values({
      lobbyCode: code,
      userId: options.userId ?? null,
      ...profile,
      imageUpdatedAt: profile.image ? new Date() : null,
      isHost: false,
    })
    .returning(playerColumns);

  const rows = await listPlayers(code);
  return {
    ok: true,
    selfId: self.id,
    lobby: await toState(code, rows, lobby.roleCounts, lobby.gameStarted),
    resumed: false,
  };
}

/** Wendet nur die mitgeschickten Felder an (Bild nur, wenn es sich ändert). */
async function applyProfilePatch(
  code: string,
  playerId: string,
  patch: Partial<PlayerProfile>,
  userId?: string | null,
): Promise<void> {
  const db = await getDb();
  const values: Record<string, unknown> = { lastSeen: new Date() };
  if (patch.name !== undefined) values.name = patch.name;
  if (patch.color !== undefined) values.color = patch.color;
  if (patch.fadeIntensity !== undefined) values.fadeIntensity = patch.fadeIntensity;
  if (patch.frame !== undefined) values.frame = patch.frame;
  if (patch.image !== undefined) {
    values.image = patch.image;
    values.imageUpdatedAt = patch.image ? new Date() : null;
  }
  await db
    .update(players)
    .set(values)
    .where(
      and(eq(players.id, playerId), eq(players.lobbyCode, code), ownerFilter(userId)),
    );
}

export type StateOutcome =
  | { status: "ok"; state: LobbyState }
  | { status: "not_found" }
  /** Lobby existiert, dieser Spieler ist (noch) nicht drin → Client darf erneut beitreten. */
  | { status: "not_member" };

/**
 * Liefert den Zustand und hält den Spieler am Leben. Räumt getrennte Spieler
 * auf, ohne die Lobby sofort zu löschen (Reconnect-Schutz) und überträgt die
 * Host-Rolle, wenn der Host weg ist.
 */
export async function getLobbyState(
  codeInput: string,
  playerId?: string,
  userId?: string | null,
): Promise<StateOutcome> {
  const code = normalizeCode(codeInput);
  if (code.length !== 6) return { status: "not_found" };

  const db = await getDb();
  const [lobby] = await db.select().from(lobbies).where(eq(lobbies.code, code));
  if (!lobby) return { status: "not_found" };

  await cleanupStalePlayers(code);
  let rows = await listPlayers(code);

  if (rows.length === 0) {
    const age = Date.now() - lobby.createdAt.getTime();
    if (age > EMPTY_LOBBY_GRACE_MS) {
      await db.delete(lobbies).where(eq(lobbies.code, code));
      return { status: "not_found" };
    }
    // Leer (alle getrennt), aber noch innerhalb der Gnadenfrist: Der Spieler
    // darf per Resume zurückkommen, die Lobby bleibt bestehen.
    return playerId
      ? { status: "not_member" }
      : {
          status: "ok",
          state: await toState(code, [], lobby.roleCounts, lobby.gameStarted),
        };
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
    if (!self) return { status: "not_member" };
    // Mit Login: nur die eigene Spielfigur darf abgefragt werden.
    if (userId && self.userId !== userId) return { status: "not_member" };
    if (Date.now() - self.lastSeen.getTime() > TOUCH_INTERVAL_MS) {
      await touchPlayer(code, playerId);
    }
  }

  return {
    status: "ok",
    state: await toState(code, rows, lobby.roleCounts, lobby.gameStarted),
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
  userId?: string | null,
): Promise<boolean> {
  const code = normalizeCode(codeInput);
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
        ownerFilter(userId),
      ),
    );
  if (!host) return false;

  await db
    .update(lobbies)
    .set({ gameStarted: started })
    .where(eq(lobbies.code, code));
  await touchPlayer(code, playerId, userId);
  return true;
}

/** Profil aktualisieren (Name, Farbe, Verlauf, Rahmen – Bild separat). */
export async function updateProfile(
  code: string,
  playerId: string,
  profileInput: unknown,
  userId?: string | null,
): Promise<boolean> {
  const patch = sanitizeProfilePatch(profileInput);
  if (patch.image !== undefined) {
    // Bilder laufen absichtlich über /api/lobby/avatar (eigener Endpunkt,
    // eigene Größenprüfung) – hier ignorieren, damit das Sekunden-Polling
    // nicht durch große Payloads ausgebremst wird.
    delete patch.image;
  }
  const db = await getDb();
  const values: Record<string, unknown> = { ...patch, lastSeen: new Date() };
  const updated = await db
    .update(players)
    .set(values)
    .where(
      and(eq(players.id, playerId), eq(players.lobbyCode, code), ownerFilter(userId)),
    )
    .returning({ id: players.id });
  return updated.length > 0;
}

export type AvatarOutcome =
  | { ok: true; url: string | null }
  | { ok: false; reason: "not_member" | "unsupported" | "too_large" | "storage" };

const MIME_EXTENSION: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
  "image/gif": "gif",
};

/**
 * Profilbild setzen oder entfernen.
 *
 * Mit Neon Object Storage (AWS_* gesetzt) wandern die Bilddaten in den Bucket
 * `assets` unter `avatars/<player-id>/<uuid>.<ext>`; in Postgres steht dann nur
 * der Schlüssel (`image_key`). Ohne Bucket (lokale Entwicklung) bleibt es beim
 * bisherigen Weg: Data-URL in der Spalte `image`.
 */
export async function updateAvatar(
  codeInput: string,
  playerId: string,
  imageInput: unknown,
  userId?: string | null,
): Promise<AvatarOutcome> {
  const code = normalizeCode(codeInput);
  if (code.length !== 6) return { ok: false, reason: "not_member" };

  const parsed = parseImageInput(imageInput);
  if (!parsed.ok) return { ok: false, reason: parsed.reason };

  const db = await getDb();
  const [current] = await db
    .select({
      image: players.image,
      imageKey: players.imageKey,
      imageUpdatedAt: players.imageUpdatedAt,
    })
    .from(players)
    .where(
      and(eq(players.id, playerId), eq(players.lobbyCode, code), ownerFilter(userId)),
    );
  if (!current) return { ok: false, reason: "not_member" };

  const version = new Date();

  // Bild entfernen.
  if (!parsed.image) {
    if (current.imageKey) void deleteObject(current.imageKey);
    await db
      .update(players)
      .set({ image: null, imageKey: null, imageUpdatedAt: null, lastSeen: version })
      .where(
        and(eq(players.id, playerId), eq(players.lobbyCode, code), ownerFilter(userId)),
      );
    return { ok: true, url: null };
  }

  if (!storageEnabled) {
    if (current.image === parsed.image) {
      // Unverändert: nur Lebenszeichen aktualisieren, keine 200 KB schreiben.
      await touchPlayer(code, playerId, userId);
      return {
        ok: true,
        url: current.imageUpdatedAt ? avatarUrl(playerId, current.imageUpdatedAt) : null,
      };
    }
    await db
      .update(players)
      .set({ image: parsed.image, imageKey: null, imageUpdatedAt: version, lastSeen: version })
      .where(
        and(eq(players.id, playerId), eq(players.lobbyCode, code), ownerFilter(userId)),
      );
    return { ok: true, url: avatarUrl(playerId, version) };
  }

  const decoded = decodeImage(parsed.image);
  if (!decoded) return { ok: false, reason: "unsupported" };

  // Jede Version bekommt einen eigenen Key (CDN/Browser-Cache bleibt gültig).
  const key = `avatars/${playerId}/${version.getTime()}-${Math.random()
    .toString(36)
    .slice(2, 8)}.${MIME_EXTENSION[decoded.mime] ?? "bin"}`;
  try {
    await putObject(key, decoded.bytes, decoded.mime);
  } catch (error) {
    console.error("[storage] Profilbild konnte nicht hochgeladen werden", error);
    return { ok: false, reason: "storage" };
  }

  await db
    .update(players)
    .set({
      image: null,
      imageKey: key,
      imageUpdatedAt: version,
      lastSeen: version,
    })
    .where(
      and(eq(players.id, playerId), eq(players.lobbyCode, code), ownerFilter(userId)),
    );

  if (current.imageKey && current.imageKey !== key) void deleteObject(current.imageKey);

  return { ok: true, url: avatarUrl(playerId, version) };
}

/**
 * Profilbild eines Spielers für `GET /api/lobby/avatar`: entweder der
 * Bucket-Schlüssel (Neon Object Storage) oder die Data-URL (Fallback).
 */
export async function getAvatar(
  playerId: string,
): Promise<{ image: string | null; imageKey: string | null } | null> {
  if (!playerId) return null;
  const db = await getDb();
  const [row] = await db
    .select({ image: players.image, imageKey: players.imageKey })
    .from(players)
    .where(eq(players.id, playerId));
  if (!row || (!row.image && !row.imageKey)) return null;
  return { image: row.image, imageKey: row.imageKey };
}

export async function updateRoleCounts(
  codeInput: string,
  playerId: string,
  roleCountsInput: unknown,
  userId?: string | null,
): Promise<boolean> {
  const code = normalizeCode(codeInput);
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
        ownerFilter(userId),
      ),
    );
  if (!host) return false;

  await db
    .update(lobbies)
    .set({ roleCounts: sanitizeRoleCounts(roleCountsInput) })
    .where(eq(lobbies.code, code));
  await touchPlayer(code, playerId, userId);
  return true;
}

export async function removePlayer(
  codeInput: string,
  playerId: string,
  userId?: string | null,
): Promise<void> {
  const code = normalizeCode(codeInput);
  if (code.length !== 6 || !playerId) return;

  const db = await getDb();

  // Bild im Bucket mit aufräumen (best effort).
  if (storageEnabled) {
    const [row] = await db
      .select({ imageKey: players.imageKey })
      .from(players)
      .where(
        and(eq(players.id, playerId), eq(players.lobbyCode, code), ownerFilter(userId)),
      );
    if (row?.imageKey) void deleteObject(row.imageKey);
  }

  await db
    .delete(players)
    .where(
      and(eq(players.id, playerId), eq(players.lobbyCode, code), ownerFilter(userId)),
    );

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
