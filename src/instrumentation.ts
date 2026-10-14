/**
 * Läuft einmal beim Start des Servers (Next.js Instrumentation-Hook).
 *
 * Drei Aufgaben, alle bewusst nicht blockierend:
 *
 * 1. **Absturzschutz** (`installCrashGuards`): Eine unbehandelte
 *    Promise-Ablehnung beendet sonst den ganzen Node-Prozess. Auf Render
 *    bedeutete das bisher: Instanz weg, Neustart, und in der Zwischenzeit
 *    „502 – Service unavailable“ für alle Besucher.
 * 2. **Health-Monitor** (`startHealthMonitor`): prüft die Datenbank regelmäßig
 *    im Hintergrund (Standard: 1× pro Minute, einstellbar über
 *    `HEALTH_CHECK_INTERVAL_MS`), damit `/api/health` sofort aus dem Cache
 *    antworten kann (Render bricht die Prüfung nach 5 s ab – siehe
 *    src/lib/health.ts).
 * 3. **Datenbank-Vorlauf**: Das Anlegen/Öffnen der eingebetteten
 *    PostgreSQL-Datenbank (PGlite) dauert beim allerersten Zugriff ein paar
 *    Sekunden, eine externe Datenbank (Neon) braucht für den ersten
 *    Verbindungsaufbau kurz. Ohne Vorlauf müsste der erste
 *    „Lobby erstellen“-Klick darauf warten.
 *
 * Wichtig: Nichts davon darf den Serverstart blockieren. Antwortet die
 * Datenbank nicht innerhalb des Zeitlimits, startet der Server trotzdem – die
 * API-Routen bauen die Verbindung dann bei Bedarf selbst auf (inkl.
 * Wiederholung, siehe `getDb` in src/db/index.ts).
 */
export async function register(): Promise<void> {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;

  try {
    const { installCrashGuards, startHealthMonitor } = await import("@/lib/health");
    // 1) Nicht mehr wegen eines einzelnen Fehlers komplett abbrechen.
    installCrashGuards();
    // 2) Datenbankzustand regelmäßig im Hintergrund prüfen.
    startHealthMonitor();
  } catch (error) {
    console.error("[start] Gesundheitsprüfung konnte nicht starten", error);
  }

  // Bewusst NICHT abwarten (`void`): Next.js lässt Anfragen erst durch, wenn
  // dieser Hook fertig ist. Ein blockierender Vorlauf würde also genau die
  // ersten Health-Checks verzögern, die Render sofort nach dem Start schickt
  // (und die nach 5 s abbrechen). Der Vorlauf läuft daher im Hintergrund.
  void warmUpDatabase();
}

/** Öffnet die Datenbank im Hintergrund, damit der erste Klick nicht wartet. */
async function warmUpDatabase(): Promise<void> {
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
        "[start] Datenbank-Vorlauf dauert länger als 15 s – die Verbindung wird bei der ersten Anfrage aufgebaut.",
      );
    }
  } catch (error) {
    // Nicht abbrechen: Die API-Routen bauen die Verbindung bei Bedarf selbst
    // auf (und heilen sich dabei selbst).
    console.error("[start] Datenbank-Vorlauf fehlgeschlagen", error);
  }
}
