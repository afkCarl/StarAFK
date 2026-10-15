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
 * 4. **RAM-Schutz** (`logDatabasePlan`): PGlite läuft als WASM-PostgreSQL IM
 *    Node-Prozess und kostet gemessen ~456 MB zusätzlich – zusammen mit dem
 *    Server 596 MB, also mehr als die 512 MB einer Render-Free-Instanz.
 *    Deshalb wird PGlite in Produktion/kleinen Containern gar nicht erst
 *    geladen (siehe `pglitePolicy` in src/db/index.ts); diese Funktion macht
 *    die Entscheidung sofort in den Logs sichtbar.
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
  void logDatabasePlan();
  void warmUpDatabase();
}

/**
 * Einmalige Startmeldung: Welche Datenbank soll genutzt werden – und falls
 * keine verfügbar ist, WARUM (steht dann ganz oben in den Render-Logs und
 * zusätzlich in `/api/health` unter `status.notice`).
 */
async function logDatabasePlan(): Promise<void> {
  try {
    const { embeddedEngine, getDbMode, getDbProvider, pglitePolicy } = await import("@/db");
    if (getDbMode() === "postgres") {
      console.log(`[start] Datenbank: extern (${getDbProvider()}).`);
      return;
    }
    const policy = pglitePolicy();
    if (policy.allowed) {
      console.log(
        `[start] Datenbank: eingebettetes ${embeddedEngine()} (ohne DATABASE_URL).`,
      );
      return;
    }
    console.error(
      `[start] KEINE Datenbank nutzbar: ${policy.reason}.\n[start] ${policy.hint}`,
    );
  } catch {
    // Kein Grund für den Serverstart abzubrechen – die API-Routen und
    // `/api/health` melden den Zustand selbst.
  }
}

/** Öffnet die Datenbank im Hintergrund, damit der erste Klick nicht wartet. */
async function warmUpDatabase(): Promise<void> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    const { getDb, dbStatus } = await import("@/db");
    const warmup = getDb().then(() => true);
    const timeout = new Promise<false>((resolve) => {
      timer = setTimeout(() => resolve(false), 15_000);
      // Der Timer soll den Prozess weder am Beenden hindern noch nach dem
      // erfolgreichen Vorlauf weiter im Event-Loop hängen bleiben.
      timer.unref?.();
    });
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
    //
    // Ein Konfigurationsfehler (`permanent`, z. B. der PGlite-RAM-Schutz) wurde
    // von `logDatabasePlan` direkt davor bereits vollständig gemeldet – hier
    // kommt dann nur eine Kurzzeile ohne Stacktrace, damit die Render-Logs
    // beim Start lesbar bleiben.
    if ((error as { permanent?: unknown } | null)?.permanent) {
      console.warn(
        "[start] Datenbank-Vorlauf übersprungen (Konfiguration – siehe Meldung oben).",
      );
      return;
    }
    console.error("[start] Datenbank-Vorlauf fehlgeschlagen", error);
  } finally {
    // Aufgeräumt: ohne `clearTimeout` bliebe der 15-s-Timer bis zum Ablauf
    // referenziert, obwohl das Rennen längst entschieden ist.
    if (timer) clearTimeout(timer);
  }
}
