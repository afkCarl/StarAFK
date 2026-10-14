/**
 * Läuft einmal beim Start des Servers (Next.js Instrumentation-Hook).
 *
 * Hier wird die Datenbank absichtlich schon im Hintergrund geöffnet: das
 * Anlegen/Öffnen der eingebetteten PostgreSQL-Datenbank (PGlite) dauert beim
 * allerersten Zugriff ein paar Sekunden. Ohne diesen Vorlauf müsste der erste
 * „Lobby erstellen"-Klick darauf warten (auf Render-Free-Instanzen spürbar).
 */
export async function register(): Promise<void> {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  try {
    const { getDb, dbStatus } = await import("@/db");
    await getDb();
    console.log(
      `[start] Datenbank bereit (${dbStatus().mode}/${dbStatus().storage}).`,
    );
  } catch (error) {
    // Nicht abbrechen: Die API-Routen bauen die Verbindung bei Bedarf selbst
    // auf (und heilen sich dabei selbst).
    console.error("[start] Datenbank-Vorlauf fehlgeschlagen", error);
  }
}
