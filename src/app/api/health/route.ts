import { json } from "@/lib/api";
import { installCrashGuards, readHealth, startHealthCheck } from "@/lib/health";

export const dynamic = "force-dynamic";

/**
 * Health-Check (Render: `healthCheckPath: /api/health`).
 *
 * Antwortet **immer sofort** aus dem letzten bekannten Zustand und immer mit
 * HTTP 200, solange der Server selbst lebt – die Datenbank wird im Hintergrund
 * geprüft (siehe src/lib/health.ts). Hintergrund: Render bricht die Prüfung
 * nach 5 s ab; ein auf die Datenbank wartender Health-Check hat die Instanz
 * zuvor bei jeder langsamen Datenbank in eine Neustart-Schleife geschickt und
 * die Seite damit dauerhaft mit 502 aus dem Netz genommen (nachgemessen: über
 * 30 s Antwortzeit bei nicht erreichbarer Datenbank, während die Startseite in
 * 17 ms antwortet).
 *
 * Der eigentliche Zustand steht weiterhin im Body:
 * - `ok: true`  – Datenbank antwortet (`check.checkedAt` = Zeitpunkt der Prüfung)
 * - `ok: false` – Datenbank (noch) nicht erreichbar; der Fehlertext steht in
 *   `status.lastError`. Die Seite bleibt dabei aufrufbar, nur Lobbys gehen
 *   kurzzeitig nicht.
 * - `starting: true` – die allererste Prüfung läuft noch.
 *
 * Welche Datenbank aktiv ist, zeigt `provider` (`"neon"` = Neon-Datenbank aus
 * `DATABASE_URL`, `"postgres"` = sonstige externe Datenbank, z. B. automatisch
 * von Render provisioniert, `"pglite"` = eingebettet).
 */
export async function GET(): Promise<Response> {
  try {
    // Der Monitor startet beim Serverstart (src/instrumentation.ts). Falls der
    // Hook dort nicht lief (z. B. older Build/Dev), wird er hier nachgeholt.
    installCrashGuards();
    startHealthCheck();
    return json(readHealth());
  } catch (error) {
    // Selbst ein unerwarteter Fehler darf hier nie zu etwas anderem als 200
    // führen – sonst startet Render die Instanz neu.
    console.error("[api] health route failed", error);
    return json(readHealth());
  }
}
