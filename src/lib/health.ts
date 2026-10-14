/**
 * Gesundheitsprüfung im Hintergrund (ohne Datenbank-Warterei).
 *
 * Warum das nötig ist: Render prüft `healthCheckPath` alle paar Sekunden und
 * **bricht die Prüfung nach 5 Sekunden ab**. Würde `/api/health` dabei selbst
 * auf die Datenbank warten, passiert genau das, was die Seite zuletzt lahmgelegt
 * hat: Antwortet die Datenbank langsam (oder ist gerade nicht erreichbar, z. B.
 * eine aufwachende Neon-Instanz), dauert die Antwort durch die eingebauten
 * Zeitlimits und den automatischen Verbindungs-Neuaufbau über 30 Sekunden.
 * Render wertet das als „Instanz kaputt“, startet sie neu – und die nächste
 * Prüfung läuft wieder ins Zeitlimit. Ergebnis: dauerhaft
 * „502 – This service is currently unavailable“, obwohl die Seite selbst in
 * wenigen Millisekunden antworten würde (gemessen: Startseite 17 ms).
 *
 * Deshalb gilt hier: Die Route antwortet **sofort** aus dem letzten bekannten
 * Zustand (immer HTTP 200, solange der Server selbst lebt) und die eigentliche
 * Datenbankprüfung läuft daneben im Hintergrund. Dadurch bleibt die Seite
 * erreichbar, während die Datenbank hochfährt, und Render startet die Instanz
 * nicht mehr grundlos neu.
 */

import { sql } from "drizzle-orm";

import {
  dbStatus,
  getDb,
  noteDbFailure,
  noteDbSuccess,
  type DbMode,
  type DbProvider,
  type DbStatus,
} from "@/db";
import { authEnabled } from "@/lib/auth/server";
import { aiGatewayConfigured, gameMasterEnabled } from "@/lib/game-master";
import { BUCKET, storageEnabled } from "@/lib/storage";

/**
 * Standardabstand der Hintergrundprüfung. Render ruft `/api/health` alle paar
 * Sekunden auf – würde jeder Aufruf die Datenbank prüfen, käme eine Abfrage pro
 * paar Sekunden zusammen. Ein Ergebnis gilt deshalb so lange als frisch, bis
 * dieses Zeitfenster abgelaufen ist (dann erst wird neu geprüft).
 *
 * Über `HEALTH_CHECK_INTERVAL_MS` (Millisekunden, mindestens 1000)
 * einstellbar – wer z. B. eine Neon-Datenbank mit Scale-to-Zero sparsam
 * einschlafen lassen will, setzt ihn höher (etwa `600000` = 10 Minuten).
 */
export const HEALTH_CHECK_DEFAULT_MS = 60_000;

function checkIntervalMs(): number {
  const configured = Number(process.env.HEALTH_CHECK_INTERVAL_MS);
  return Number.isFinite(configured) && configured >= 1_000
    ? configured
    : HEALTH_CHECK_DEFAULT_MS;
}

export interface HealthServices {
  postgres: DbMode;
  provider: DbProvider;
  auth: boolean;
  objectStorage: string | false;
  aiGateway: boolean;
  functions: boolean;
}

export interface HealthCheckInfo {
  /** Läuft gerade eine Datenbankprüfung? */
  running: boolean;
  /** Zeitpunkt der letzten abgeschlossenen Prüfung (ISO) – `null` = noch keine. */
  checkedAt: string | null;
  /** Alter des letzten Ergebnisses in ms – `null` = noch keine Prüfung. */
  ageMs: number | null;
  /** Dauer der letzten abgeschlossenen Prüfung in ms – `null` = noch keine. */
  latencyMs: number | null;
}

export interface HealthSnapshot {
  /** Letztes Prüfergebnis (oder `true`, solange noch nichts geprüft wurde). */
  ok: boolean;
  /** `true`, solange die erste Datenbankprüfung noch nicht fertig ist. */
  starting: boolean;
  db: DbMode;
  provider: DbProvider;
  status: DbStatus;
  services: HealthServices;
  check: HealthCheckInfo;
  uptimeSec: number;
}

interface HealthState {
  ok?: boolean;
  checkedAtMs?: number;
  latencyMs?: number;
  running?: Promise<void>;
  monitor?: ReturnType<typeof setInterval>;
  guardsInstalled?: boolean;
}

function state(): HealthState {
  const g = globalThis as typeof globalThis & { __starafkHealth?: HealthState };
  g.__starafkHealth ??= {};
  return g.__starafkHealth;
}

/** Welche Neon-Dienste sind verdrahtet? (Nur Anzeige – ohne Secrets.) */
function services(): HealthServices {
  return {
    postgres: dbStatus().mode,
    provider: dbStatus().provider,
    auth: authEnabled,
    objectStorage: storageEnabled ? `bucket:${BUCKET}` : false,
    aiGateway: aiGatewayConfigured,
    functions: gameMasterEnabled,
  };
}

/**
 * Aktueller Zustand – **ohne** auf die Datenbank zu warten. Liefert den letzten
 * bekannten Stand plus die live verfügbaren Werte (Modus, Anbieter, Dienste).
 */
export function readHealth(): HealthSnapshot {
  const g = state();
  const checkedAt = g.checkedAtMs;
  return {
    // Ohne abgeschlossene Prüfung gilt der Server selbst als gesund: Render
    // braucht dann HTTP 200 und startet die Instanz nicht neu.
    ok: g.ok ?? true,
    starting: checkedAt === undefined,
    db: dbStatus().mode,
    provider: dbStatus().provider,
    status: dbStatus(),
    services: services(),
    check: {
      running: Boolean(g.running),
      checkedAt: checkedAt ? new Date(checkedAt).toISOString() : null,
      ageMs: checkedAt === undefined ? null : Date.now() - checkedAt,
      latencyMs: g.latencyMs ?? null,
    },
    uptimeSec: Math.round(process.uptime()),
  };
}

/** Die eigentliche Prüfung: eine einzige Datenbankabfrage (`select 1`). */
async function runCheck(): Promise<void> {
  const g = state();
  const started = Date.now();
  try {
    const db = await getDb();
    await db.execute(sql`select 1`);
    noteDbSuccess();
    g.ok = true;
  } catch (error) {
    // Fehler zählen + ggf. Verbindung neu aufbauen (siehe src/db/index.ts).
    noteDbFailure(error);
    console.error("[health] Datenbankprüfung im Hintergrund fehlgeschlagen", error);
    g.ok = false;
  } finally {
    g.latencyMs = Date.now() - started;
    g.checkedAtMs = Date.now();
  }
}

/**
 * Startet bei Bedarf eine Prüfung im Hintergrund. **Nie awaiten** – der
 * aufrufende Route-Handler soll sofort antworten können.
 */
export function startHealthCheck(force = false): void {
  const g = state();
  if (g.running) return; // eine Prüfung läuft noch – keine zweite anstoßen
  const fresh =
    g.checkedAtMs !== undefined &&
    Date.now() - g.checkedAtMs < checkIntervalMs();
  if (!force && fresh) return;
  g.running = runCheck().finally(() => {
    g.running = undefined;
  });
}

/** Periodische Hintergrundprüfung (hält den Zustand aktuell). */
export function startHealthMonitor(): void {
  const g = state();
  if (g.monitor) return;
  startHealthCheck(true);
  const timer = setInterval(() => startHealthCheck(true), checkIntervalMs());
  // Verhindert, dass der Timer den Node-Prozess am Beenden hindert.
  timer.unref?.();
  g.monitor = timer;
}

/**
 * Absturzschutz für den laufenden Betrieb.
 *
 * Node beendet den Prozess standardmäßig bei einer unbehandelten
 * Promise-Ablehnung bzw. einem unbehandelten Fehler. Auf Render heißt das:
 * Instanz weg, Neustart, und währenddessen 502 für alle Besucher. Stattdessen
 * wird hier nur geloggt (der Fehler steht damit in den Render-Logs) und der
 * Server bleibt für alle weiteren Anfragen am Leben.
 */
export function installCrashGuards(): void {
  const g = state();
  if (g.guardsInstalled) return;
  g.guardsInstalled = true;

  process.on("unhandledRejection", (reason: unknown) => {
    console.error(
      "[start] Nicht behandelte Promise-Ablehnung – Server läuft weiter:",
      reason,
    );
  });

  process.on("uncaughtException", (error: unknown) => {
    console.error(
      "[start] Nicht behandelter Fehler – Server läuft weiter:",
      error,
    );
  });
}
