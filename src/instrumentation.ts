/**
 * Läuft einmal beim Start des Servers (Next.js Instrumentation-Hook).
 *
 * Hier wird die Datenbank absichtlich schon im Hintergrund geöffnet: das
 * Anlegen/Öffnen der eingebetteten PostgreSQL-Datenbank (PGlite) dauert beim
 * allerersten Zugriff ein paar Sekunden und auch eine externe Datenbank
 * (Neon) braucht für den ersten Verbindungsaufbau kurz. Ohne diesen Vorlauf
 * müsste der erste „Lobby erstellen“-Klick darauf warten (auf
 * Render-Free-Instanzen spürbar).
 *
 * Wichtig: Der Vorlauf darf den Serverstart nie blockieren. Antwortet die
 * Datenbank nicht innerhalb des Zeitlimits, startet der Server trotzdem –
 * die API-Routen bauen die Verbindung dann bei Bedarf selbst auf (inkl.
 * Wiederholung, siehe `getDb` in `src/db/index.ts`).
 */
export async function register(): Promise<void> {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  try {
    const { getDb, dbStatus } = await import("@/db");
    const warmup = getDb().then(() => true);
    const timeout = new Promise<false>((resolve) =>
      setTimeout(() => resolve(false), 15_000),
    );
    if (await Promise.race([warmup, timeout])) {
      console.log(
        `[start] Datenbank bereit (${dbStatus().provider}/${dbStatus().storage}).`,
      );
    } else {
      console.warn(
        "[start] Datenbank-Vorlauf dauert länger als 15 s – Server startet trotzdem, die Verbindung wird bei der ersten Anfrage aufgebaut.",
      );
    }
  } catch (error) {
    // Nicht abbrechen: Die API-Routen bauen die Verbindung bei Bedarf selbst
    // auf (und heilen sich dabei selbst).
    console.error("[start] Datenbank-Vorlauf fehlgeschlagen", error);
  }
}
