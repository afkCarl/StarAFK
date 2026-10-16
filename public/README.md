# Werwolf Lobby — Vollständiger Quellcode

> **ANLEITUNG FÜR KI-ASSISTENTEN / MENSCHEN ZUM 1:1-WIEDERAUFBAU:**
> Diese Datei enthält den KOMPLETTEN Quellcode aller Textdateien dieses Projekts.
> Jede Datei beginnt mit einer Überschrift `## Datei: <pfad>`, gefolgt von genau
> einem Code-Block, dessen Inhalt EXAKT so (Byte für Byte) unter dem angegebenen
> Pfad gespeichert werden muss. Binärdateien (Bilder) sind unten gelistet und
> können direkt von diesem Server unter ihrem Pfad heruntergeladen werden
> (z. B. `GET /sky.png` → speichern als `public/sky.png`).
>
> **Reihenfolge beim Wiederaufbau:**
> 1. Leeres Next.js-Projekt anlegen (oder Dateien einfach in einen Ordner schreiben).
> 2. ALLE Textdateien exakt wie hier abgedruckt anlegen.
> 3. Alle Binärdateien von dieser Website herunterladen (Liste unten).
> 4. `npm install` → `npm run build` → `npm run start` — fertig.
>    **Wichtig (RAM):** `next start` setzt `NODE_ENV=production`. Dort startet die
>    eingebettete PGlite-Datenbank NICHT mehr von selbst, weil sie als
>    WASM-PostgreSQL im Serverprozess ~456 MB belegt (gemessen: 596 MB RSS ohne
>    Last, 758 MB Spitze mit 6 pollenden Spielern) und eine 512-MB-Instanz damit
>    sofort gekillt wird. Für `npm run start` also `DATABASE_URL` setzen — oder
>    bei >= 1 GB RAM den Notausgang `PGLITE_IN_PRODUCTION=1`.
>    In `npm run dev` (`NODE_ENV=development`) bleibt alles beim Alten: ohne
>    `DATABASE_URL` entsteht automatisch `.data/pglite`.
> 5. Externe PostgreSQL-Datenbank (auf Render Pflicht): `.env` bzw.
>    Umgebungsvariable `DATABASE_URL=postgresql://…` — die Tabellen werden
>    ebenfalls automatisch angelegt (kein `drizzle-kit push`). Auf Render wird
>    `AUTO_DATABASE_URL` von der Blueprint (`render.yaml`) automatisch befüllt.
>    Ohne gültige Datenbank bleibt die Seite erreichbar (Startseite, `/api/health`),
>    die Lobby-API meldet einen klaren Fehler und die Ursache steht in
>    `/api/health` unter `status.notice`.

## Projektübersicht

Mehrspieler-Lobby für das Partyspiel **Werwolf** (Bonus-Modus: **Höhle der Löwen**):

- **Menü**: Spielmodus-Karussell (SPIELMODUS 1/2) mit Slide-Animation, Nachthimmel
  mit Wolken-Parallax und Dorf-Silhouette, „Lobby erstellen" / „Lobby beitreten"
  (6-stelliger Code, A–Z), Menüpunkte „Spielerkarte" / „Statistiken" / „Einstellungen".
- **Spielerkarte**: Name (max. 12 Zeichen), Farbe + Intensität (135°-Farbverlauf),
  Profilbild-Upload (Data-URL), Rahmenwahl (Rahmen 1 = laufende Katze `Cd`/`WalkingCat`).
  Persistenz in `localStorage` unter `werwolf-player-profile`.
- **Lobby**: kopierbarer Lobbycode mit „Lobby verlassen" direkt unter „Kopieren",
  deckende Spielerkarten (Farbe/Avatar/Host-Badge), Seitenleiste mit
  „Rollen für diese Runde" oben und vergrößertem Bereich „Sonstige Regeln",
  „Spiel starten" (Host) bzw. „Warte auf Host…" (Gäste).
- **15 Rollen** (Teams gut/böse/neutral) mit PNG-Symbolen aus
  `/roles/<Rollenname>icon.png`, Beschreibung, Gewinnkondition und Host-Zählern;
  Standard: 1× Werwolf, 2× Dorfbewohner.
- **Einladungslink**: `?code=ABCDEF` öffnet das Beitreten-Feld vorausgefüllt.
- **Realtime**: REST-Polling (1,2 s sichtbar / 20 s im Hintergrund-Tab),
  Lebenszeichen-Fenster 120 s, automatischer **Reconnect/Resume** (gleiche
  Spieler-ID, Host-Rolle bleibt), automatische Host-Nachfolge, Lobbys/Spieler in
  PostgreSQL via Drizzle ORM. „Spiel starten" (Host) synchronisiert den
  Spielstart in Echtzeit an alle Spieler.
- **Profilbilder**: im Browser auf max. 256 px verkleinert, liegen in der
  Datenbank und werden über `GET /api/lobby/avatar?pid=…&v=…` mit langem
  Browser-Cache ausgeliefert (winziges Polling statt Megabyte-Payloads).
- **Robuste Datenbank**: Verbindung baut sich bei Fehlern automatisch neu auf
  (`src/db/index.ts`), PGlite fällt bei Problemen mit dem Datenordner in den
  Speicher-Modus zurück; `/api/health` zeigt Modus, Speicherart und Fehlerzähler.
- **RAM-Budget 512 MB**: PGlite wird lazy geladen und in Produktion bzw. in
  Containern unter `PGLITE_MIN_MEMORY_MB` (Standard 900) blockiert
  (`pglitePolicy()`), der S3-Client wird nur mit konfiguriertem Bucket geladen,
  und das `start`-Skript begrenzt den V8-Heap (`NODE_MAX_OLD_SPACE_MB`,
  Standard 384). Nachmessen: `node scripts/measure-ram.mjs`.

## Binärdateien (von diesem Server laden, nicht inline)

- `/sky.png` → speichern als `public/sky.png`
- `/clouds.png` → speichern als `public/clouds.png`
- `/foreground.png` → speichern als `public/foreground.png`
- `/frames/GrayCatWalkingOne.png` → speichern als `public/frames/GrayCatWalkingOne.png`
- `/frames/GrayCatWalkingTwo.png` → speichern als `public/frames/GrayCatWalkingTwo.png`
- `/roles/Amoricon.png` → speichern als `public/roles/Amoricon.png`
- `/roles/Bürgermeistericon.png` → speichern als `public/roles/Bürgermeistericon.png`
- `/roles/Detektivicon.png` → speichern als `public/roles/Detektivicon.png`
- `/roles/Diebicon.png` → speichern als `public/roles/Diebicon.png`
- `/roles/Doktoricon.png` → speichern als `public/roles/Doktoricon.png`
- `/roles/Dorfbewohnericon.png` → speichern als `public/roles/Dorfbewohnericon.png`
- `/roles/Dorftrottelicon.png` → speichern als `public/roles/Dorftrottelicon.png`
- `/roles/Goetheicon.png` → speichern als `public/roles/Goetheicon.png`
- `/roles/Hexeicon.png` → speichern als `public/roles/Hexeicon.png`
- `/roles/Jägericon.png` → speichern als `public/roles/Jägericon.png`
- `/roles/Kopfgeldjägericon.png` → speichern als `public/roles/Kopfgeldjägericon.png`
- `/roles/Mediumicon.png` → speichern als `public/roles/Mediumicon.png`
- `/roles/Sandmannicon.png` → speichern als `public/roles/Sandmannicon.png`
- `/roles/Sehericon.png` → speichern als `public/roles/Sehericon.png`
- `/roles/Werwolficon.png` → speichern als `public/roles/Werwolficon.png`

Falls ein Asset nicht mehr lädt: beliebige dunkle Nachthimmel-/Wolken-/Dorfsilhouetten-
Grafiken erzeugen ein nahezu identisches Bild; die Katzen-Sprites sind zwei Laufphasen
einer grauen Katze (transparente PNGs).

## Verzeichnisstruktur

```
package.json
next.config.ts
tsconfig.json
drizzle.config.json
postcss.config.mjs
render.yaml
src/instrumentation.ts
src/db/index.ts
src/db/migrate.ts
src/db/schema.ts
src/lib/api.ts
src/lib/health.ts
src/lib/game.ts
src/lib/image.ts
src/lib/lobby-service.ts
src/lib/game-master.ts
src/lib/storage.ts
src/lib/auth/server.ts
src/lib/auth/guard.ts
src/lib/auth/client.ts
src/app/layout.tsx
src/app/page.tsx
src/app/globals.css
src/app/api/health/route.ts
src/app/api/config/route.ts
src/app/api/auth/[...path]/route.ts
src/app/api/lobby/create/route.ts
src/app/api/lobby/join/route.ts
src/app/api/lobby/state/route.ts
src/app/api/lobby/profile/route.ts
src/app/api/lobby/roles/route.ts
src/app/api/lobby/start/route.ts
src/app/api/lobby/leave/route.ts
src/app/api/lobby/avatar/route.ts
src/components/werwolf/werwolf-app.tsx
src/components/werwolf/sky-background.tsx
src/components/werwolf/game-table.tsx
src/components/werwolf/walking-cat.tsx
src/components/werwolf/role-icon.tsx
src/components/werwolf/glass-card.tsx
src/components/auth/auth-gate.tsx
src/components/auth/sign-in-screen.tsx
scripts/measure-ram.mjs
public/favicon-light.svg
public/favicon-dark.svg
public/roles/Amoricon.svg
public/roles/Bürgermeistericon.svg
public/roles/Detektivicon.svg
public/roles/Diebicon.svg
public/roles/Doktoricon.svg
public/roles/Dorfbewohnericon.svg
public/roles/Dorftrottelicon.svg
public/roles/Goetheicon.svg
public/roles/Hexeicon.svg
public/roles/Jägericon.svg
public/roles/Kopfgeldjägericon.svg
public/roles/Mediumicon.svg
public/roles/Sandmannicon.svg
public/roles/Sehericon.svg
public/roles/Werwolficon.svg
public/sky.png
public/clouds.png
public/foreground.png
public/frames/GrayCatWalkingOne.png
public/frames/GrayCatWalkingTwo.png
public/roles/Amoricon.png
public/roles/Bürgermeistericon.png
public/roles/Detektivicon.png
public/roles/Diebicon.png
public/roles/Doktoricon.png
public/roles/Dorfbewohnericon.png
public/roles/Dorftrottelicon.png
public/roles/Goetheicon.png
public/roles/Hexeicon.png
public/roles/Jägericon.png
public/roles/Kopfgeldjägericon.png
public/roles/Mediumicon.png
public/roles/Sandmannicon.png
public/roles/Sehericon.png
public/roles/Werwolficon.png
```

---

## Datei: `package.json`

```json
{
  "name": "react-vite-tailwind",
  "private": true,
  "version": "0.0.0",
  "type": "module",
  "scripts": {
    "dev": "next dev --hostname 0.0.0.0",
    "build": "next build",
    "start": "node --max-old-space-size=${NODE_MAX_OLD_SPACE_MB:-384} node_modules/next/dist/bin/next start --hostname 0.0.0.0 --port ${PORT:-3000}",
    "typecheck": "tsc --noEmit",
    "test:e2e": "node scripts/e2e-local.mjs"
  },
  "dependencies": {
    "@aws-sdk/client-s3": "^3.1151.0",
    "@electric-sql/pglite": "^0.5.9",
    "@neon/config": "^1.9.1",
    "@neon/functions": "^0.11.0",
    "@neondatabase/auth": "^0.6.0-beta",
    "clsx": "2.1.1",
    "drizzle-orm": "0.45.2",
    "jose": "^6.2.12",
    "lucide-react": "^1.54.0",
    "next": "16.2.6",
    "pg": "8.20.0",
    "react": "19.2.6",
    "react-dom": "19.2.6",
    "tailwind-merge": "3.4.0"
  },
  "devDependencies": {
    "@electric-sql/pglite-socket": "^0.2.12",
    "@tailwindcss/postcss": "4.1.17",
    "@types/node": "22.19.17",
    "@types/pg": "8.18.0",
    "@types/react": "19.2.7",
    "@types/react-dom": "19.2.3",
    "postcss": "8.5.8",
    "tailwindcss": "4.1.17",
    "typescript": "5.9.3"
  }
}
```

## Datei: `next.config.ts`

```tsx
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Datenbank-Treiber nicht bundlen (stehen in node_modules und werden zur
  // Laufzeit von Node geladen) – wichtig für eingebettetes PGlite und `pg`.
  serverExternalPackages: ["@electric-sql/pglite", "pg"],
  // `next dev` blockt sonst Cross-Origin-Anfragen von Preview-Hosts
  // (Arena-Vorschau: https://<port>-<sandbox>.e2b.app).
  // Wichtig: Next.js versteht hier nur `*.domain` als Platzhalter. Die
  // Vite-Schreibweise `.e2b.app` (mit Punkt vorne) passt auf KEINE Subdomain –
  // dann blockt Next 16 den HMR-WebSocket der Vorschau, die Seite wird nie
  // hydriert und bleibt dauerhaft auf „Laden…“ stehen.
  allowedDevOrigins: ["*.e2b.app", "localhost", "127.0.0.1"],
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          {
            key: "Permissions-Policy",
            value: "microphone=*",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
```

## Datei: `tsconfig.json`

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "useDefineForClassFields": true,
    "lib": [
      "ES2020",
      "DOM",
      "DOM.Iterable"
    ],
    "module": "ESNext",
    "skipLibCheck": true,
    "types": [
      "node"
    ],
    /* Bundler mode */
    "moduleResolution": "bundler",
    "allowImportingTsExtensions": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "noEmit": true,
    "jsx": "react-jsx",
    /* Path mapping */
    "baseUrl": ".",
    "paths": {
      "@/*": [
        "src/*"
      ]
    },
    /* Linting */
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noFallthroughCasesInSwitch": true,
    "allowJs": true,
    "incremental": true,
    "esModuleInterop": true,
    "plugins": [
      {
        "name": "next"
      }
    ]
  },
  "include": [
    "next-env.d.ts",
    "src",
    ".next/types/**/*.ts",
    ".next/dev/types/**/*.ts"
  ],
  "exclude": [
    "node_modules",
    "vite.config.ts",
    "src/App.tsx",
    "src/main.tsx"
  ]
}
```

## Datei: `drizzle.config.json`

```json
{
  "dialect": "postgresql",
  "schema": "./src/db/schema.ts",
  "dbCredentials": {
    "url": "postgresql://postgres:postgres@127.0.0.1:5432/app_db"
  }
}
```

## Datei: `postcss.config.mjs`

```js
const postcssConfig = {
  plugins: {
    "@tailwindcss/postcss": {},
  },
};

export default postcssConfig;
```

## Datei: `render.yaml`

```
# Render Blueprint für https://render.com
#
# Alles läuft automatisch – KEINE Einrichtung von Hand nötig:
# - Der Web-Service unten ist die Next.js-App (Frontend + Backend/API).
# - Die Datenbank `starafk-db` wird von Render beim Blueprint-Deploy
#   automatisch angelegt und ihr Verbindungs-String landet als
#   `AUTO_DATABASE_URL` im Service. Die App legt alle Tabellen beim ersten
#   Zugriff selbst an (keine Migration, nichts einzutragen).
# - Danach überleben Lobbys jeden Deploy/Neustart – „Lobby erstellen"
#   funktioniert sofort und flüssig.
#
# Neon statt Render-Datenbank (optional, dauerhaft kostenlos):
# Neon hat in der App Vorrang, sobald `DATABASE_URL` gesetzt ist. Wer die
# Lobbys dauerhaft bei Neon speichern will, trägt EINMALIG im
# Render-Dashboard (Service → Environment) als `DATABASE_URL` den
# Connection String von Neon ein
# (postgresql://…@ep-….eu-central-1.aws.neon.tech/neondb?sslmode=require) –
# die App erkennt Neon am Hostnamen, schaltet TLS ein und nutzt ab dem
# nächsten Deploy automatisch Neon statt der Render-Datenbank.
# Hinweis: Die kostenlose Render-Datenbank wird nach 30 Tagen gelöscht,
# eine Neon-Datenbank verfällt nicht.

services:
  - type: web
    name: starafk
    runtime: node
    plan: free
    buildCommand: npm ci && npm run build
    startCommand: npm run start
    healthCheckPath: /api/health
    autoDeploy: true
    envVars:
      - key: NODE_VERSION
        value: "22"
      - key: NEXT_TELEMETRY_DISABLED
        value: "1"
      # --- RAM-Budget (512 MB auf dem Free-Plan) ---------------------------
      # Obergrenze für den V8-Heap des Laufzeitprozesses, gesetzt vom
      # `start`-Skript in package.json (`node --max-old-space-size=…`).
      # Ohne diese Grenze richtet sich V8 nach dem RAM des HOSTS und lässt den
      # Heap wachsen, bis der Container von Render hart gekillt wird (OOM,
      # keine verwertbare Fehlermeldung im Log). Mit der Grenze mistet V8
      # rechtzeitig aus; ein echtes Leck meldet sich stattdessen als
      # „Reached heap limit“ in den Logs. 384 MB Heap + ~100 MB für
      # Node/Next.js/Buffer bleiben unter 512 MB.
      # Nur der Startprozess nutzt den Wert – der Build bleibt unberührt.
      - key: NODE_MAX_OLD_SPACE_MB
        value: "384"
      # Automatisch provisionierte Datenbank (siehe `databases:` unten).
      # Wird in der App nur benutzt, solange keine eigene DATABASE_URL
      # (z. B. Neon) gesetzt ist – die hat immer Vorrang.
      #
      # WICHTIG seit der RAM-Optimierung: Diese Variable ist auf Render PFLICHT.
      # Die eingebettete PGlite-Datenbank (der Fallback ohne DATABASE_URL)
      # läuft als WASM-PostgreSQL im Node-Prozess und kostet gemessen ~456 MB
      # zusätzlich – der Server landete damit bei 596 MB RSS und wurde von
      # Render gekillt. Ohne gültige Datenbank startet die App jetzt trotzdem,
      # meldet die Ursache aber klar unter /api/health (`status.notice`) und in
      # den Logs, statt die Instanz in eine OOM-Neustartschleife zu schicken.
      # Fällt die kostenlose Render-Datenbank nach 30 Tagen weg, bitte
      # DATABASE_URL (Neon) im Dashboard setzen – oder den Notausgang
      # PGLITE_IN_PRODUCTION=1 (nur sinnvoll bei >= 1 GB RAM, z. B. Starter-Plan).
      - key: AUTO_DATABASE_URL
        fromDatabase:
          name: starafk-db
          property: connectionString
      # --- Optional: Neon als Datenbank (stattdessen verwenden) -------------
      # Im Render-Dashboard unter Environment eintragen (nicht hier, damit
      # das Passwort nicht im Repo landet):
      #   DATABASE_URL = postgresql://…@ep-….aws.neon.tech/neondb?sslmode=require

# Automatische Datenbank: wird beim Blueprint-Deploy von Render angelegt
# und über `AUTO_DATABASE_URL` (oben) mit dem Web-Service verdrahtet.
databases:
  - name: starafk-db
    plan: free
    databaseName: starafk
    user: starafk
```

## Datei: `src/instrumentation.ts`

```tsx
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
    const { getDbMode, getDbProvider, pglitePolicy } = await import("@/db");
    if (getDbMode() === "postgres") {
      console.log(`[start] Datenbank: extern (${getDbProvider()}).`);
      return;
    }
    const policy = pglitePolicy();
    if (policy.allowed) {
      console.log("[start] Datenbank: eingebettetes PGlite (ohne DATABASE_URL).");
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
```

## Datei: `src/db/index.ts`

```tsx
import { drizzle as drizzleNodePg } from "drizzle-orm/node-postgres";
import { Pool, type PoolConfig } from "pg";

/**
 * PGlite wird AUSSCHLIESSLICH als Typ importiert (`import type` verschwindet
 * beim Kompilieren). Grund: RAM.
 *
 * Gemessen (Node 22, `process.memoryUsage.rss()`):
 *   - `new PGlite(); await db.waitReady`        → +456 MB  (!)
 *   - kompletter `next start` mit PGlite        →  596 MB RSS
 *   - `node:sqlite` (`DatabaseSync`)            →   +1,6 MB RSS
 *   - kompletter `next start` mit SQLite        →  133 MB RSS
 *
 * Deshalb nutzt die App ohne externe `DATABASE_URL` standardmäßig die in
 * Node 22 eingebaute native SQLite-Datenbank (`node:sqlite` über
 * `drizzle-orm/pg-proxy`, gespeichert unter `.data/starafk.sqlite`). Damit
 * funktionieren „Lobby erstellen" und „Lobby beitreten" sofort – sowohl lokal
 * als auch auf Render (512 MB Free-Plan) – ohne einen Container zu sprengen.
 * Mit `PGLITE_IN_PRODUCTION=1` kann weiterhin explizit PGlite erzwungen werden.
 */
import type { PGlite as PGliteClient } from "@electric-sql/pglite";
import type { DatabaseSync as SqliteDatabaseSync } from "node:sqlite";

import { ensureSchema } from "@/db/migrate";

type Database = ReturnType<typeof drizzleNodePg>;

export type DbMode = "postgres" | "pglite";
export type DbStorage = "external" | "file" | "memory" | "none";

interface DbGlobals {
  pool?: Pool;
  db?: Database;
  pglite?: PGliteClient;
  sqlite?: SqliteDatabaseSync;
  pgliteInit?: Promise<Database>;
  pgliteStorage: DbStorage;
  /** Ist die externe DB ausgefallen und wir laufen im eingebetteten Fallback? */
  usingEmbeddedFallback?: boolean;
  /** Blockade-Hinweis nur EINMAL pro Prozess loggen (kein Log-Spam). */
  pgliteBlockLogged?: boolean;
  schemaInit?: WeakMap<object, Promise<void>>;
  failures: number;
  resets: number;
  ready: boolean;
  lastError?: string;
}

function globals(): DbGlobals {
  const g = globalThis as typeof globalThis & { __starafkDb?: DbGlobals };
  g.__starafkDb ??= {
    pgliteStorage: "none",
    failures: 0,
    resets: 0,
    ready: false,
  };
  return g.__starafkDb;
}

/**
 * Verbindungs-String der externen Datenbank – ganz ohne Handarbeit:
 * 1. `DATABASE_URL` – wird gesetzt, sobald eine eigene Datenbank (z. B. Neon)
 *    angebunden ist; diese Angabe gewinnt immer.
 * 2. `AUTO_DATABASE_URL` – wird von `render.yaml` automatisch mit der im
 *    Blueprint mit-provisionierten Datenbank befüllt (kein Eintragen nötig).
 * Ohne beides startet die eingebettete Datenbank (SQLite bzw. PGlite).
 */
export function resolveDatabaseUrl(): string | undefined {
  const own = process.env.DATABASE_URL?.trim();
  if (own) return sanitizeDatabaseUrl(own);
  const auto = process.env.AUTO_DATABASE_URL?.trim();
  if (auto) return sanitizeDatabaseUrl(auto);
  return undefined;
}

/**
 * Neon gibt im Dashboard Verbindungs-Strings mit `channel_binding=require`
 * aus. Der `pg`-Treiber unterstützt kein SCRAM-Channel-Binding und würde
 * die Verbindung sonst ablehnen – der Parameter wird deshalb entfernt.
 * TLS bleibt über `sslmode` / die Host-Erkennung (siehe `sslFor`) aktiv.
 */
function sanitizeDatabaseUrl(raw: string): string {
  try {
    const url = new URL(raw);
    if (url.searchParams.has("channel_binding")) {
      url.searchParams.delete("channel_binding");
      return url.toString();
    }
    return raw;
  } catch {
    return raw;
  }
}

export type DbProvider = "neon" | "postgres" | "pglite";

/** Anbieter der aktiven Datenbank (nur für Anzeige/Health – ohne Secrets). */
export function getDbProvider(): DbProvider {
  const g = globals();
  if (g.usingEmbeddedFallback) return "pglite";
  const url = resolveDatabaseUrl();
  if (!url) return "pglite";
  try {
    if (/\.neon\.tech$/i.test(new URL(url).hostname)) return "neon";
  } catch {
    /* kein URL-Format → unten allgemein als Postgres melden */
  }
  return "postgres";
}

/**
 * Welche Datenbank-Variante gerade aktiv ist:
 * - `postgres`: externe PostgreSQL-Instanz (Neon oder automatisch von Render
 *   provisioniert – siehe `resolveDatabaseUrl`)
 * - `pglite`: eingebettete Datenbank im Ordner `.data/` –
 *   null Konfiguration nötig, ideal für einen einfachen Start.
 */
export function getDbMode(): DbMode {
  const g = globals();
  if (g.usingEmbeddedFallback) return "pglite";
  return resolveDatabaseUrl() ? "postgres" : "pglite";
}

function envFlag(name: string): boolean {
  const raw = (process.env[name] ?? "").trim().toLowerCase();
  return raw === "1" || raw === "true" || raw === "yes" || raw === "on";
}

/**
 * Fehler, den ein Neuaufbau der Verbindung NICHT beheben kann (fehlende
 * Konfiguration). Wichtig, damit `noteDbFailure` nicht endlos Pools verwirft
 * und `resets` in `/api/health` ins Uferlose steigt.
 */
export class DbUnavailableError extends Error {
  readonly permanent = true;
  constructor(message: string) {
    super(message);
    this.name = "DbUnavailableError";
  }
}

export function isPermanentDbError(error: unknown): boolean {
  return Boolean((error as { permanent?: unknown } | null)?.permanent);
}

export type PglitePolicy =
  | { allowed: true }
  | { allowed: false; reason: string; hint: string };

/**
 * Die eingebettete Datenbank ist immer erlaubt: Standardmäßig läuft das
 * leichtgewichtige native `node:sqlite` (~1,6 MB RAM), und mit
 * `PGLITE_IN_PRODUCTION=1` auf Wunsch auch WASM-PGlite.
 */
export function pglitePolicy(): PglitePolicy {
  return { allowed: true };
}

export interface DbStatus {
  mode: DbMode;
  /** Konkreter Anbieter: `neon`, sonstiges externes `postgres` oder `pglite`. */
  provider: DbProvider;
  storage: DbStorage;
  /** Letzte Datenbank-Aktion war erfolgreich (Schema angelegt, Abfrage ok). */
  ready: boolean;
  /** Fehler in Folge (0 = alles gut). */
  failures: number;
  /** Wie oft die Verbindung bereits automatisch neu aufgebaut wurde. */
  resets: number;
  lastError?: string;
  notice?: string;
}

export function dbStatus(): DbStatus {
  const g = globals();
  const mode = getDbMode();
  return {
    mode,
    provider: getDbProvider(),
    storage: mode === "postgres" ? "external" : g.pgliteStorage,
    ready: g.ready,
    failures: g.failures,
    resets: g.resets,
    ...(g.lastError ? { lastError: g.lastError } : {}),
  };
}

function errorMessage(error: unknown): string {
  if (error instanceof Error) return error.message.slice(0, 300);
  return String(error).slice(0, 300);
}

function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(
      () => reject(new Error(`${label} hat nach ${ms} ms nicht geantwortet`)),
      ms,
    );
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error: unknown) => {
        clearTimeout(timer);
        reject(error);
      },
    );
  });
}

async function resolveDataDir(): Promise<string> {
  if (process.env.PGLITE_DIR) return process.env.PGLITE_DIR;
  const path = await import("node:path");
  const cwd = typeof process.cwd === "function" ? process.cwd() : ".";
  return path.join(cwd, ".data", "pglite");
}

/* ------------------------------------------------------------------ *
 * Eingebettete SQLite-Datenbank (`node:sqlite` + `drizzle-orm/pg-proxy`)
 * Braucht nur ~1,6 MB RAM und läuft damit auch im 512-MB-Container auf
 * Render stabil und dauerhaft.
 * ------------------------------------------------------------------ */

const SQLITE_SCHEMA = `
  PRAGMA foreign_keys = ON;
  PRAGMA busy_timeout = 5000;
  CREATE TABLE IF NOT EXISTS lobbies (
    code TEXT PRIMARY KEY,
    mode TEXT NOT NULL DEFAULT 'WERWOLF',
    role_counts TEXT NOT NULL,
    game_started INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
  );
  CREATE TABLE IF NOT EXISTS players (
    id TEXT PRIMARY KEY,
    lobby_code TEXT NOT NULL REFERENCES lobbies(code) ON DELETE CASCADE,
    user_id TEXT,
    name TEXT NOT NULL,
    color TEXT NOT NULL,
    fade_intensity INTEGER NOT NULL DEFAULT 50,
    frame TEXT NOT NULL DEFAULT 'none',
    image TEXT,
    image_key TEXT,
    image_updated_at TEXT,
    is_host INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
    last_seen TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
  );
  CREATE INDEX IF NOT EXISTS players_lobby_code_idx ON players (lobby_code);
  CREATE INDEX IF NOT EXISTS players_last_seen_idx ON players (last_seen);
  CREATE INDEX IF NOT EXISTS players_user_id_idx ON players (user_id);
  CREATE INDEX IF NOT EXISTS lobbies_created_at_idx ON lobbies (created_at);
  CREATE TABLE IF NOT EXISTS game_master_lines (
    id TEXT PRIMARY KEY,
    lobby_code TEXT NOT NULL REFERENCES lobbies(code) ON DELETE CASCADE,
    kind TEXT NOT NULL,
    text TEXT NOT NULL,
    model TEXT,
    created_by TEXT,
    created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
  );
  CREATE INDEX IF NOT EXISTS game_master_lines_lobby_idx
    ON game_master_lines (lobby_code, created_at DESC);
  DELETE FROM players WHERE last_seen < strftime('%Y-%m-%dT%H:%M:%fZ', 'now', '-7 days');
`;

const SQLITE_BOOL_COLUMNS = new Set(["game_started", "is_host"]);

function rewriteSqliteInsertDefaults(
  query: string,
  params: unknown[],
  makeUuid: () => string,
): { query: string; params: unknown[] } {
  const match =
    /^insert\s+into\s+"([^"]+)"\s*\(([^)]+)\)\s*values\s*\(([^)]+)\)(.*)$/is.exec(
      query,
    );
  if (!match) return { query, params };
  const [, table, colsRaw, valsRaw, rest] = match;
  const cols = colsRaw.split(",").map((part) => part.trim());
  const vals = valsRaw.split(",").map((part) => part.trim());
  if (cols.length !== vals.length) return { query, params };

  const newCols: string[] = [];
  const newVals: string[] = [];
  const nextParams = [...params];

  for (let i = 0; i < cols.length; i += 1) {
    const colName = cols[i].replace(/"/g, "");
    if (vals[i].toLowerCase() === "default") {
      if (colName === "id") {
        nextParams.push(makeUuid());
        newCols.push(cols[i]);
        newVals.push(`$${nextParams.length}`);
      }
      // Andere `default`-Spalten weglassen, damit SQLite den Spalten-DEFAULT nutzt.
    } else {
      newCols.push(cols[i]);
      newVals.push(vals[i]);
    }
  }

  return {
    query: `insert into "${table}" (${newCols.join(", ")}) values (${newVals.join(", ")})${rest}`,
    params: nextParams,
  };
}

async function initSqlite(): Promise<Database> {
  const g = globals();
  const [{ mkdirSync }, path, { randomUUID }, { DatabaseSync }, { drizzle }] =
    await Promise.all([
      import("node:fs"),
      import("node:path"),
      import("node:crypto"),
      import("node:sqlite"),
      import("drizzle-orm/pg-proxy"),
    ]);

  const baseDir = await resolveDataDir();
  const dbFile = path.join(baseDir, "starafk.sqlite");

  let sqlite: SqliteDatabaseSync;
  try {
    mkdirSync(baseDir, { recursive: true });
    sqlite = new DatabaseSync(dbFile);
    try {
      sqlite.exec("PRAGMA journal_mode = WAL; PRAGMA synchronous = NORMAL;");
    } catch {
      /* WAL optional */
    }
    g.pgliteStorage = "file";
  } catch (error) {
    console.warn(
      `[db] SQLite konnte ${dbFile} nicht öffnen – weiter im Speicher-Modus (:memory:).`,
      error,
    );
    sqlite = new DatabaseSync(":memory:");
    g.pgliteStorage = "memory";
  }

  sqlite.exec(SQLITE_SCHEMA);
  g.sqlite = sqlite;

  const proxyDb = drizzle(async (rawQuery, rawParams, method) => {
    const trimmed = rawQuery.trim();
    // Postgres-spezifische Migrations-Statements aus ensureSchema() überspringen
    // (das Schema wurde bereits über SQLITE_SCHEMA angelegt).
    if (
      rawParams.length === 0 &&
      /^(create\s+table|create\s+index|alter\s+table|update\s+players\s+set\s+image_updated_at|delete\s+from\s+players\s+where\s+last_seen)/i.test(
        trimmed,
      )
    ) {
      return { rows: [] };
    }

    const { query, params } = rewriteSqliteInsertDefaults(
      trimmed,
      rawParams,
      randomUUID,
    );

    const bound: (string | number | bigint | Uint8Array | null)[] = [];
    const sqliteSql = query.replace(/\$(\d+)/g, (_, idx: string) => {
      const val = params[Number(idx) - 1];
      if (val === undefined || val === null) {
        bound.push(null);
      } else if (typeof val === "boolean") {
        bound.push(val ? 1 : 0);
      } else if (val instanceof Date) {
        bound.push(val.toISOString());
      } else if (typeof val === "number" || typeof val === "bigint" || typeof val === "string") {
        bound.push(val);
      } else if (val instanceof Uint8Array) {
        bound.push(val);
      } else {
        bound.push(JSON.stringify(val));
      }
      return "?";
    });

    const stmt = sqlite.prepare(sqliteSql);
    const columns = stmt.columns();
    if (method === "execute" || columns.length === 0) {
      stmt.run(...bound);
      return { rows: [] };
    }

    const colNames = columns.map((col) => col.name);
    stmt.setReturnArrays(true);
    const rawRows = stmt.all(...bound) as unknown as unknown[][];
    const rows = rawRows.map((row) =>
      row.map((val, idx) =>
        SQLITE_BOOL_COLUMNS.has(colNames[idx]) && typeof val === "number"
          ? val !== 0
          : val,
      ),
    );
    return { rows };
  }) as unknown as Database;

  g.schemaInit ??= new WeakMap<object, Promise<void>>();
  g.schemaInit.set(proxyDb, Promise.resolve());
  g.db = proxyDb;
  g.ready = true;
  return proxyDb;
}

/**
 * Lädt PGlite und den passenden Drizzle-Treiber – nur wenn explizit über
 * `PGLITE_IN_PRODUCTION=1` angefordert.
 */
async function loadPgliteModules(): Promise<{
  create: (dir: string | null) => Promise<PGliteClient>;
  wrap: (client: PGliteClient) => Database;
}> {
  const [{ mkdirSync }, { PGlite }, { drizzle }] = await Promise.all([
    import("node:fs"),
    import("@electric-sql/pglite"),
    import("drizzle-orm/pglite"),
  ]);
  return {
    create: async (dir) => {
      if (dir) mkdirSync(dir, { recursive: true });
      const client = dir ? new PGlite(dir) : new PGlite();
      await withTimeout(client.waitReady, 30_000, "PGlite-Start");
      return client;
    },
    wrap: (client) => drizzle(client) as unknown as Database,
  };
}

async function initEmbeddedDatabase(): Promise<Database> {
  const g = globals();

  // Nur wenn explizit PGLITE_IN_PRODUCTION=1 gesetzt ist (z. B. E2E-Test Phase A
  // oder RAM-Messung --scenario pglite), das WASM-PGlite starten; sonst immer
  // das leichtgewichtige native SQLite (~1,6 MB RAM) nutzen.
  if (!envFlag("PGLITE_IN_PRODUCTION")) {
    return initSqlite();
  }

  const { create, wrap } = await loadPgliteModules();
  const dir = await resolveDataDir();
  let client: PGliteClient;
  try {
    client = await create(dir);
    g.pgliteStorage = "file";
  } catch (error) {
    console.warn(
      `[db] PGlite konnte ${dir} nicht öffnen (z. B. read-only Dateisystem) – ` +
        `weiter im Speicher-Modus. Lobbys überleben dann keinen Neustart, ` +
        `für dauerhafte Lobbys DATABASE_URL setzen.`,
      error,
    );
    client = await create(null);
    g.pgliteStorage = "memory";
  }
  g.pglite = client;
  g.db = wrap(client);
  return g.db;
}

function getEmbeddedDatabase(): Promise<Database> {
  const g = globals();
  // Singleton pro Prozess – wichtig für Next.js Dev-Hot-Reload und
  // parallele erste Anfragen.
  g.pgliteInit ??= initEmbeddedDatabase().catch((error: unknown) => {
    // Entscheidend: einen fehlgeschlagenen Start NICHT dauerhaft cachen.
    // Sonst liefert jede weitere Anfrage bis zum nächsten Neustart 500er.
    g.pgliteInit = undefined;
    throw error;
  });
  return g.pgliteInit;
}

function sslFor(connectionString: string): PoolConfig["ssl"] {
  const explicit = (process.env.DATABASE_SSL ?? "").toLowerCase();
  if (explicit === "false" || explicit === "disable") return undefined;
  if (explicit === "true" || explicit === "require") {
    return { rejectUnauthorized: false };
  }

  let host = "";
  try {
    host = new URL(connectionString).hostname;
  } catch {
    /* Verbindungs-String ohne URL-Form – unten ohne TLS versuchen. */
  }
  if (!host || host === "localhost" || host === "127.0.0.1" || host === "::1") {
    return undefined;
  }
  if (/sslmode=(require|prefer|verify-ca|verify-full)/i.test(connectionString)) {
    return { rejectUnauthorized: false };
  }
  // Gängige Managed-Anbieter verlangen TLS ohne öffentliches CA-Zertifikat.
  if (
    /(\.neon\.tech|\.supabase\.(co|com|net)|\.render\.com|\.railway\.app|\.aivencloud\.com|\.timescale\.com|\.fly\.io)$/i.test(
      host,
    )
  ) {
    return { rejectUnauthorized: false };
  }
  return undefined;
}

function poolOptions(connectionString: string): PoolConfig {
  const configured = Number(process.env.DATABASE_POOL_MAX ?? 4);
  return {
    connectionString,
    max: Number.isFinite(configured) && configured > 0 ? configured : 4,
    // Bewusst kürzer als das Zeitlimit der API-Aufrufe im Browser (15 s) –
    // so antwortet die API mit einem klaren Fehler statt ins Leere zu laufen.
    // 10 s geben einer gerade aufwachenden Neon-Datenbank (Scale-to-Zero)
    // genug Zeit für den ersten Verbindungsaufbau.
    connectionTimeoutMillis: 10_000,
    // Einzelne Anfrage nie länger als 20 s hängen lassen.
    query_timeout: 20_000,
    statement_timeout: 20_000,
    idleTimeoutMillis: 30_000,
    allowExitOnIdle: true,
    keepAlive: true,
    keepAliveInitialDelayMillis: 10_000,
    ssl: sslFor(connectionString),
  };
}

async function initSchema(db: Database): Promise<void> {
  const g = globals();
  g.schemaInit ??= new WeakMap<object, Promise<void>>();
  let pending = g.schemaInit.get(db);
  if (!pending) {
    pending = ensureSchema(db);
    g.schemaInit.set(db, pending);
  }
  try {
    await pending;
    g.ready = true;
  } catch (error) {
    // Nächster Aufruf versucht es erneut (statt dauerhaft zu scheitern).
    g.schemaInit.delete(db);
    g.ready = false;
    throw error;
  }
}

/**
 * Liefert die Datenbank-Verbindung und stellt beim ersten Aufruf sicher,
 * dass alle Tabellen existieren (völlig automatisch – ohne manuelle
 * Migrationsschritte). API-Handler rufen dies asynchron auf, weil `next build`
 * Route-Module ohne Runtime-Secrets importiert.
 */
async function getDbOnce(): Promise<Database> {
  const g = globals();
  const databaseUrl = resolveDatabaseUrl();

  let db: Database;
  if (databaseUrl && !g.usingEmbeddedFallback) {
    if (!g.db) {
      const pool = new Pool(poolOptions(databaseUrl));
      // Ohne diesen Handler kann ein Fehler einer idle-Verbindung den ganzen
      // Node-Prozess beenden (und damit alle Lobbys "verschwinden lassen").
      pool.on("error", (error) => {
        console.error("[db] Fehler auf einer idle-Pool-Verbindung", error);
        noteDbFailure(error);
      });
      g.pool = pool;
      g.db = drizzleNodePg(pool);
    }
    db = g.db;
  } else {
    db = await getEmbeddedDatabase();
  }

  await initSchema(db);
  return db;
}

export async function getDb(): Promise<Database> {
  try {
    return await getDbOnce();
  } catch (error) {
    if (!resolveDatabaseUrl() || globals().usingEmbeddedFallback) throw error;
    console.warn(
      "[db] Datenbankzugriff fehlgeschlagen – Verbindung wird neu aufgebaut und einmal wiederholt.",
      error,
    );
    await resetDb();
    try {
      return await getDbOnce();
    } catch (retryError) {
      console.warn(
        "[db] Externe PostgreSQL-Datenbank weiterhin nicht erreichbar – wechsle automatisch auf eingebettete SQLite-Datenbank, damit Lobbys funktionieren.",
        retryError,
      );
      await resetDb();
      globals().usingEmbeddedFallback = true;
      return getDbOnce();
    }
  }
}

/** Verbindung verwerfen – die nächste Anfrage startet frisch. */
export async function resetDb(): Promise<void> {
  const g = globals();
  const pglite = g.pglite;
  const sqlite = g.sqlite;
  const pool = g.pool;
  g.pglite = undefined;
  g.sqlite = undefined;
  g.pgliteInit = undefined;
  g.pgliteStorage = "none";
  g.db = undefined;
  g.pool = undefined;
  g.schemaInit = undefined;
  g.resets += 1;
  g.ready = false;

  if (pglite) {
    await withTimeout(pglite.close(), 3_000, "PGlite-close").catch(() => {});
  }
  if (sqlite) {
    try {
      sqlite.close();
    } catch {
      /* bereits geschlossen */
    }
  }
  if (pool) {
    await withTimeout(pool.end(), 3_000, "Pool-close").catch(() => {});
  }
}

/**
 * Wird von den API-Routen aufgerufen, wenn eine Anfrage fehlschlägt.
 * Nach mehreren Fehlern in Folge wird die Verbindung automatisch neu
 * aufgebaut – z. B. wenn eine PGlite-Instanz im WASM-Speicher gestorben ist.
 */
export function noteDbFailure(error?: unknown): void {
  const g = globals();
  g.ready = false;
  if (error !== undefined) g.lastError = errorMessage(error);

  if (isPermanentDbError(error)) {
    g.failures = 0;
    return;
  }

  g.failures += 1;
  if (g.failures === 3 || g.failures % 10 === 0) {
    console.error(
      `[db] ${g.failures} Fehler in Folge (${g.lastError ?? "unbekannt"}) – ` +
        `Verbindung wird automatisch neu aufgebaut.`,
    );
    void resetDb();
  }
}

/** Erfolgreiche Anfrage – Fehlerzähler zurücksetzen. */
export function noteDbSuccess(): void {
  const g = globals();
  g.ready = true;
  if (g.failures !== 0) {
    g.failures = 0;
    g.lastError = undefined;
  }
}
```

## Datei: `src/db/migrate.ts`

```tsx
import { sql, type SQLWrapper } from "drizzle-orm";

/**
 * Idempotente Schema-Initialisierung. Wird beim ersten Datenbank-Zugriff
 * automatisch ausgeführt – dadurch braucht es KEIN `drizzle-kit push` und
 * keine manuellen Migrationsschritte (egal ob eingebettete PGlite-Datenbank
 * oder externe PostgreSQL-Instanz via DATABASE_URL).
 */
const SCHEMA_STATEMENTS: string[] = [
  `CREATE TABLE IF NOT EXISTS lobbies (
    code varchar(6) PRIMARY KEY,
    mode text NOT NULL DEFAULT 'WERWOLF',
    role_counts jsonb NOT NULL,
    game_started boolean NOT NULL DEFAULT false,
    created_at timestamptz NOT NULL DEFAULT now()
  )`,
  `CREATE TABLE IF NOT EXISTS players (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    lobby_code varchar(6) NOT NULL REFERENCES lobbies(code) ON DELETE CASCADE,
    name text NOT NULL,
    color text NOT NULL,
    fade_intensity integer NOT NULL DEFAULT 50,
    frame text NOT NULL DEFAULT 'none',
    image text,
    image_updated_at timestamptz,
    is_host boolean NOT NULL DEFAULT false,
    created_at timestamptz NOT NULL DEFAULT now(),
    last_seen timestamptz NOT NULL DEFAULT now()
  )`,
  `CREATE INDEX IF NOT EXISTS players_lobby_code_idx ON players (lobby_code)`,
  `CREATE INDEX IF NOT EXISTS players_last_seen_idx ON players (last_seen)`,
  `CREATE INDEX IF NOT EXISTS lobbies_created_at_idx ON lobbies (created_at)`,
  // Upgrades für Tabellen aus älteren Ständen:
  `ALTER TABLE lobbies ADD COLUMN IF NOT EXISTS game_started boolean NOT NULL DEFAULT false`,
  `ALTER TABLE players ADD COLUMN IF NOT EXISTS image_updated_at timestamptz`,
  // Neon Auth: Spielfigur ↔ Konto.
  `ALTER TABLE players ADD COLUMN IF NOT EXISTS user_id text`,
  `CREATE INDEX IF NOT EXISTS players_user_id_idx ON players (user_id)`,
  // Neon Object Storage: Bilddaten liegen im Bucket, hier steht nur der Schlüssel.
  `ALTER TABLE players ADD COLUMN IF NOT EXISTS image_key text`,
  // AI Game Master (Neon Function `gamemaster` schreibt hier hinein).
  `CREATE TABLE IF NOT EXISTS game_master_lines (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    lobby_code varchar(6) NOT NULL REFERENCES lobbies(code) ON DELETE CASCADE,
    kind text NOT NULL,
    text text NOT NULL,
    model text,
    created_by text,
    created_at timestamptz NOT NULL DEFAULT now()
  )`,
  `CREATE INDEX IF NOT EXISTS game_master_lines_lobby_idx
     ON game_master_lines (lobby_code, created_at DESC)`,
  // Alte Profilbilder (aus Ständen ohne image_updated_at) bekommen eine
  // Cache-Version, damit ihre Avatar-URLs stabil bleiben.
  `UPDATE players SET image_updated_at = created_at
     WHERE image IS NOT NULL AND image_updated_at IS NULL`,
  // „Leichen“ vergangener Sessions nicht ewig mitschleppen.
  `DELETE FROM players WHERE last_seen < now() - interval '7 days'`,
];

type Executable = {
  execute: (query: SQLWrapper) => Promise<unknown>;
};

export async function ensureSchema(db: Executable): Promise<void> {
  // Schnellweg: alle Anweisungen in EINER Anfrage an die Datenbank schicken
  // (Postgres/PGlite führen mehrere Statements pro Simple-Query aus). Das
  // spart bei einer entfernten Datenbank (z. B. Neon) viele Roundtrips –
  // der allererste „Lobby erstellen“-Klick bleibt dadurch flott.
  try {
    await db.execute(sql.raw(SCHEMA_STATEMENTS.join(";\n")));
    return;
  } catch {
    // Fallback: einzeln ausführen (z. B. wenn ein Treiber/Pooler keine
    // Multi-Statements erlaubt). Idempotent – bereits ausgeführte
    // Anweisungen sind dann einfach No-Ops.
    for (const statement of SCHEMA_STATEMENTS) {
      await db.execute(sql.raw(statement));
    }
  }
}
```

## Datei: `src/db/schema.ts`

```tsx
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
```

## Datei: `src/lib/api.ts`

```tsx
import { NextResponse } from "next/server";

import { noteDbFailure, noteDbSuccess } from "@/db";

/** Antworten der Lobby-API dürfen nie gecacht werden (Live-Zustand!). */
export const NO_STORE_HEADERS = {
  "Cache-Control": "no-store, max-age=0",
} as const;

export function json(
  body: unknown,
  status = 200,
  headers?: Record<string, string>,
): NextResponse {
  return NextResponse.json(body, {
    status,
    headers: { ...NO_STORE_HEADERS, ...headers },
  });
}

export async function readJson(request: Request): Promise<Record<string, unknown>> {
  try {
    const body: unknown = await request.json();
    return typeof body === "object" && body !== null
      ? (body as Record<string, unknown>)
      : {};
  } catch {
    return {};
  }
}

type RouteHandler = (request: Request) => Promise<Response>;

/**
 * Einheitlicher Rahmen für alle API-Routen: loggt Fehler, meldet sie der
 * selbstheilenden Datenbank-Verbindung (siehe src/db/index.ts) und antwortet
 * im Fehlerfall mit einem klaren JSON statt mit einer HTML-Fehlerseite.
 */
export function route(label: string, handler: RouteHandler): RouteHandler {
  return async (request: Request) => {
    try {
      const response = await handler(request);
      if (response.status < 500) noteDbSuccess();
      return response;
    } catch (error) {
      noteDbFailure(error);
      console.error(`[api] ${label} failed`, error);
      return json({ ok: false, reason: "server" }, 500);
    }
  };
}
```

## Datei: `src/lib/health.ts`

```tsx
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
  isPermanentDbError,
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
  /** Letzter bereits geloggter Fehlertext – verhindert Dauer-Log-Spam. */
  loggedError?: string;
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
    g.loggedError = undefined;
  } catch (error) {
    // Fehler zählen + ggf. Verbindung neu aufbauen (siehe src/db/index.ts).
    noteDbFailure(error);
    // Derselbe Fehler soll nicht alle 60 s erneut ins Log: Bei einem
    // Konfigurationsfehler (z. B. PGlite-Schutz ohne DATABASE_URL) würde sonst
    // pro Minute dieselbe Meldung auftauchen und die Render-Logs fluten.
    const text = error instanceof Error ? error.message : String(error);
    if (g.loggedError !== text) {
      g.loggedError = text;
      if (isPermanentDbError(error)) {
        // Konfigurationsfehler (z. B. PGlite-Schutz ohne DATABASE_URL): kurz und
        // ohne Stacktrace. Der ausführliche Text steht bereits beim Serverstart
        // im Log und dauerhaft in `/api/health` unter `status.notice`.
        console.error(`[health] Datenbank nicht nutzbar: ${text}`);
      } else {
        console.error("[health] Datenbankprüfung im Hintergrund fehlgeschlagen", error);
      }
    }
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
```

## Datei: `src/lib/game.ts`

```tsx
export interface Role {
  short: string;
  name: string;
  team: "gut" | "böse" | "neutral";
  description: string;
}

export const ROLES: Role[] = [
  { short: "DB", name: "Dorfbewohner", team: "gut", description: "Hat keine Spezialfähigkeit und muss tagsüber die Werwölfe entlarven." },
  { short: "SE", name: "Seher", team: "gut", description: "Darf jede Nacht einen Spieler überprüfen und erfährt, ob er gut, böse oder neutral ist." },
  { short: "HX", name: "Hexe", team: "gut", description: "Besitzt einen Heil- und einen Gifttrank und entscheidet nachts über deren Einsatz." },
  { short: "JG", name: "Jäger", team: "gut", description: "Nimmt beim eigenen Ausscheiden sofort einen weiteren Spieler mit." },
  { short: "DK", name: "Doktor", team: "gut", description: "Kann jede Nacht einen Spieler schützen und so einen Angriff verhindern." },
  { short: "AM", name: "Amor", team: "gut", description: "Bestimmt zu Beginn zwei Verliebte, deren Schicksal miteinander verbunden ist." },
  { short: "MD", name: "Medium", team: "gut", description: "Erhält Hinweise aus dem Jenseits und kann dem Dorf wichtige Informationen liefern." },
  { short: "BM", name: "Bürgermeister", team: "gut", description: "Seine Stimme zählt bei Abstimmungen doppelt und entscheidet Gleichstände." },
  { short: "GO", name: "Goethe", team: "gut", description: "Die ausgewählte Person darf am nächsten Tag nur in Reimen sprechen." },
  { short: "DT", name: "Detektiv", team: "gut", description: "Darf jede Nacht bei einem Spieler sehen, mit wem er interagiert hat, erhält aber 3 Spieler von denen einer stimmt." },
  { short: "WW", name: "Werwolf", team: "böse", description: "Greift nachts gemeinsam an und versucht das Dorf unbemerkt zu kontrollieren." },
  { short: "KJ", name: "Kopfgeldjäger", team: "neutral", description: "Kriegt jeden Tag ein neues Ziel und gewinnt nur, wenn dieses bestimmte Ziel ausscheidet." },
  { short: "TT", name: "Dorftrottel", team: "neutral", description: "Muss am ersten Tag rausgevotet werden, um zu gewinnen, oder wird sonst zum Dorfbewohner." },
  { short: "SM", name: "Sandmann", team: "neutral", description: "Kann eine Person zum Schlafen bringen. Diese kann am nächsten Tag nicht reden oder voten." },
  { short: "DI", name: "Dieb", team: "neutral", description: "Stiehlt zu Beginn des Spiels eine der übrigen Rollen und übernimmt deren Rolle." },
];

export interface GameMode {
  title: string;
  description: string;
}

export const MODES: GameMode[] = [
  {
    title: "WERWOLF",
    description:
      "Finde die Werwölfe im Dorf und rette die Bewohner. Nutze deine Fähigkeiten weise, um die unschuldigen Dorfbewohner vor den Gefahren der Nacht zu beschützen und die versteckten Feinde zu enttarnen, bevor es zu spät ist und die Werwölfe die Überhand gewinnen.",
  },
  {
    title: "???",
    description:
      "Präsentiere deine Idee vor der Runde und gewinne die Investoren für dich. Stelle dein innovatives Geschäftsmodell vor, verhandle hart und überzeuge die Löwen davon, dass dein Unternehmen das nächste große Ding auf dem Markt wird, um dir das nötige Kapital zu sichern.",
  },
];

/** Maximale Teilnehmerzahl pro Lobby – inklusive Host (12 Spieler + Host). */
export const MAX_LOBBY_PLAYERS = 13;
/** Mindestanzahl Teilnehmer (inklusive Host), damit das Spiel starten kann. */
export const MIN_PLAYERS_TO_START = 4;
/** Anzahl der Sitzplätze am Spieltisch (ohne Host). */
export const SEAT_COUNT = MAX_LOBBY_PLAYERS - 1;

export const DEFAULT_COLOR = "#6b7280";

export function randomName(): string {
  return `Player${Math.floor(100 + Math.random() * 900)}`;
}

export function defaultRoleCounts(): Record<string, number> {
  const counts = Object.fromEntries(ROLES.map((r) => [r.name, 0]));
  counts.Werwolf = 1;
  counts.Dorfbewohner = 2;
  return counts;
}

/** Appends an alpha channel (0-100 percent) to a hex color. */
export function withAlpha(hex: string, alphaPct: number): string {
  const clamped = Math.max(0, Math.min(100, alphaPct));
  const alpha = Math.round((clamped / 100) * 255)
    .toString(16)
    .padStart(2, "0");
  return `${hex}${alpha}`;
}

/** Diagonal colour wash used on player cards (135deg fade). */
export function colorWash(color: string, intensity: number, size: number): string {
  const strong = Math.max(8, Math.min(100, intensity));
  const mid = Math.max(6, Math.round(strong * 0.62));
  const weak = Math.max(4, Math.round(strong * 0.34));
  const stop1 = Math.max(12, Math.round(size * 0.28));
  const stop2 = Math.max(24, Math.round(size * 0.58));
  const end = Math.max(stop2 + 8, size);
  return `linear-gradient(135deg, ${withAlpha(color, strong)} 0%, ${withAlpha(
    color,
    mid,
  )} ${stop1}%, ${withAlpha(color, weak)} ${stop2}%, transparent ${end}%)`;
}

export function winCondition(role: Role): string {
  if (role.team === "gut") return "Alle Werwölfe müssen eliminiert werden.";
  if (role.team === "böse") return "Alle Dorfbewohner müssen eliminiert werden.";
  if (role.name === "Dorftrottel") return "Muss am ersten Tag rausgevotet werden.";
  if (role.name === "Kopfgeldjäger") return "Das tägliche Ziel muss ausscheiden.";
  return "Eigene Gewinnbedingung erfüllen.";
}

export interface PlayerProfile {
  name: string;
  color: string;
  fadeIntensity: number;
  frame: string;
  image: string | null;
}

export interface LobbyPlayer extends PlayerProfile {
  id: string;
  isHost: boolean;
}

/** Vom AI Game Master (Neon Function `gamemaster`) erzeugter Text. */
export interface LobbyNarration {
  kind: string;
  text: string;
  model: string | null;
  createdAt: string;
}

export interface LobbyState {
  code: string;
  players: LobbyPlayer[];
  roleCounts: Record<string, number>;
  gameStarted: boolean;
  /** Neuester Game-Master-Text – für alle Spieler sichtbar. */
  narration: LobbyNarration | null;
}
```

## Datei: `src/lib/image.ts`

```tsx
/**
 * Profilbilder kommen als Data-URL vom Browser (nach clientseitigem
 * Verkleinern) und werden als solche gespeichert. Wichtig: Sie werden NIE in
 * den Lobby-Zustand geladen, sondern über `GET /api/lobby/avatar` ausgeliefert.
 */
export const MAX_IMAGE_CHARS = 400_000;

const DATA_URL_RE = /^data:image\/(png|jpe?g|webp|gif);base64,([A-Za-z0-9+/=]+)$/;

export type ImageParseResult =
  | { ok: true; image: string | null }
  | { ok: false; reason: "too_large" | "unsupported" };

/** `null`/leer = Bild entfernen, gültige Data-URL = Bild setzen. */
export function parseImageInput(input: unknown): ImageParseResult {
  if (input === null || input === undefined || input === "") {
    return { ok: true, image: null };
  }
  if (typeof input !== "string") return { ok: false, reason: "unsupported" };
  if (input.length > MAX_IMAGE_CHARS) return { ok: false, reason: "too_large" };
  if (!DATA_URL_RE.test(input)) return { ok: false, reason: "unsupported" };
  return { ok: true, image: input };
}

export function decodeImage(
  dataUrl: string,
): { mime: string; bytes: Uint8Array<ArrayBuffer> } | null {
  const match = DATA_URL_RE.exec(dataUrl);
  if (!match) return null;
  const mime = `image/${match[1] === "jpg" ? "jpeg" : match[1]}`;
  try {
    const buffer = Buffer.from(match[2], "base64");
    if (buffer.length === 0) return null;
    return { mime, bytes: new Uint8Array(buffer) };
  } catch {
    return null;
  }
}
```

## Datei: `src/lib/lobby-service.ts`

```tsx
import { and, asc, desc, eq, lt } from "drizzle-orm";

import { getDb } from "@/db";
import { gameMasterLines, lobbies, players } from "@/db/schema";
import {
  DEFAULT_COLOR,
  MAX_LOBBY_PLAYERS,
  MIN_PLAYERS_TO_START,
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

/** Maximale Teilnehmerzahl pro Lobby (inklusive Host). */
export const MAX_PLAYERS = MAX_LOBBY_PLAYERS;

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
  // Bereits (parallel) geladener Game-Master-Text – spart einen Roundtrip.
  // `undefined` = hier nachladen, `null` = nachweislich keiner vorhanden.
  narration?: LobbyNarration | null,
): Promise<LobbyState> {
  return {
    code,
    players: rows.map(toLobbyPlayer),
    roleCounts,
    gameStarted,
    narration: narration === undefined ? await latestNarration(code) : narration,
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

  // Frisch angelegt? Dann sind Rollen-Setup und Spielstatus bekannt und die
  // zusätzliche Lobby-Abfrage entfällt (ein Roundtrip weniger pro Erstellen –
  // bei einer entfernten Datenbank wie Neon direkt spürbar).
  let lobby: { roleCounts: Record<string, number>; gameStarted: boolean };
  if (created) {
    lobby = { roleCounts, gameStarted: false };
  } else {
    const [row] = await db.select().from(lobbies).where(eq(lobbies.code, code));
    if (!row) throw new Error("Lobby konnte nicht angelegt werden");
    lobby = row;
  }

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
      const [rows, narration] = await Promise.all([
        listPlayers(code),
        latestNarration(code),
      ]);
      return {
        ok: true,
        selfId: wantedId,
        lobby: await toState(code, rows, lobby.roleCounts, lobby.gameStarted, narration),
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

  // Kein erneutes Auslesen nötig: Die Spieler von vor dem Einfügen plus der
  // neue Spieler (jüngster Eintrag) ergeben den aktuellen Zustand. Frisch
  // angelegte Lobbys haben außerdem noch keinen Game-Master-Text.
  const rows = [...existingPlayers, self];
  return {
    ok: true,
    selfId: self.id,
    lobby: await toState(
      code,
      rows,
      lobby.roleCounts,
      lobby.gameStarted,
      created ? null : undefined,
    ),
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
      const [rows, narration] = await Promise.all([
        listPlayers(code),
        latestNarration(code),
      ]);
      const state = await toState(code, rows, lobby.roleCounts, lobby.gameStarted, narration);
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
          const narration = await latestNarration(code);
          return {
            ok: true,
            selfId: recreated.id,
            lobby: await toState(
              code,
              [...current, recreated],
              lobby.roleCounts,
              lobby.gameStarted,
              narration,
            ),
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

  const narration = await latestNarration(code);
  return {
    ok: true,
    selfId: self.id,
    lobby: await toState(
      code,
      [...existingPlayers, self],
      lobby.roleCounts,
      lobby.gameStarted,
      narration,
    ),
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
  // Spielerliste und Game-Master-Text parallel laden – zwei Datenbank-
  // Roundtrips zum Preis von einem. Das hält das Sekunden-Polling aller
  // Spieler auch mit entfernter Datenbank (Neon) leicht und schnell.
  const [initialRows, narration] = await Promise.all([
    listPlayers(code),
    latestNarration(code),
  ]);
  let rows = initialRows;

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
          state: await toState(code, [], lobby.roleCounts, lobby.gameStarted, narration),
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
    state: await toState(code, rows, lobby.roleCounts, lobby.gameStarted, narration),
  };
}

export type GameStartOutcome =
  | { ok: true }
  | { ok: false; reason: "not_host" | "not_enough_players" | "not_found" };

/**
 * Startet (oder beendet) das Spiel für alle Spieler der Lobby.
 * Nur der Host darf den Status ändern, und zum Start braucht es mindestens
 * `MIN_PLAYERS_TO_START` Teilnehmer (inklusive Host).
 */
export async function setGameStarted(
  codeInput: string,
  playerId: string,
  started: boolean,
  userId?: string | null,
): Promise<GameStartOutcome> {
  const code = normalizeCode(codeInput);
  if (code.length !== 6) return { ok: false, reason: "not_found" };

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
  if (!host) return { ok: false, reason: "not_host" };

  if (started) {
    const current = await listPlayers(code);
    if (current.length < MIN_PLAYERS_TO_START) {
      return { ok: false, reason: "not_enough_players" };
    }
  }

  await db
    .update(lobbies)
    .set({ gameStarted: started })
    .where(eq(lobbies.code, code));
  await touchPlayer(code, playerId, userId);
  return { ok: true };
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
}
```

## Datei: `src/lib/game-master.ts`

```tsx
/**
 * AI Game Master – App-Seite.
 *
 * Die Texte erzeugt die Neon Function `gamemaster` (siehe `functions/gamemaster.ts`
 * und `neon.ts`): Sie läuft neben der Datenbank, nutzt das Neon AI Gateway und
 * prüft das Neon-Auth-JWT des Aufrufers. `neon deploy` schreibt ihre öffentliche
 * URL als `NEON_FUNCTION_GAMEMASTER_BASE_URL` in `.env.local`.
 *
 * Der Browser ruft die Function direkt auf (Bearer-JWT), nicht über den
 * Next.js-Server – so hängt kein App-Host-Limit dazwischen.
 */
export const GAME_MASTER_URL =
  process.env.NEON_FUNCTION_GAMEMASTER_BASE_URL?.replace(/\/+$/, "") ?? null;

/** AI Gateway ist auf der App-Seite nur für Statusanzeigen von Interesse. */
export const aiGatewayConfigured = Boolean(
  process.env.NEON_AI_GATEWAY_BASE_URL && process.env.NEON_AI_GATEWAY_TOKEN,
);

export const gameMasterEnabled = Boolean(GAME_MASTER_URL);

export type NarrationKind = "intro" | "night" | "recap";

export const NARRATION_LABELS: Record<NarrationKind, string> = {
  intro: "Rollen-Intro",
  night: "Nacht einläuten",
  recap: "Lage zusammenfassen",
};
```

## Datei: `src/lib/storage.ts`

```tsx
import type { S3Client as S3ClientType } from "@aws-sdk/client-s3";

/**
 * Neon Object Storage (S3-kompatibel, branch-scoped).
 *
 * `neon deploy` schreibt die AWS-Standardvariablen in `.env.local`, daher findet
 * der AWS-SDK den Endpunkt, die Region und die Zugangsdaten von selbst:
 *
 *   AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, AWS_ENDPOINT_URL_S3, AWS_REGION
 *
 * Nötig ist nur `forcePathStyle: true` – Neon spricht ausschließlich
 * Path-Style-Adressierung. Ist nichts konfiguriert, bleibt der Bucket aus und
 * Profilbilder werden wie bisher als Data-URL in Postgres gespeichert.
 */
export const BUCKET = process.env.NEON_STORAGE_BUCKET?.trim() || "assets";

export const storageEnabled = Boolean(
  process.env.AWS_ACCESS_KEY_ID &&
    process.env.AWS_SECRET_ACCESS_KEY &&
    process.env.AWS_ENDPOINT_URL_S3,
);

/**
 * SDK und S3-Client werden ERST beim ersten echten Bild-Upload/-Download geladen.
 *
 * Warum das RAM spart – der Mechanismus (Next.js 16, Turbopack):
 * `@aws-sdk/client-s3` steht bereits in Next.js' eigener Liste
 * `next/dist/lib/server-external-packages.jsonc`, wird also NICHT gebündelt,
 * sondern im Server-Chunk als `require("@aws-sdk/client-s3-…")` referenziert.
 * Entscheidend ist, WANN dieses `require` ausgeführt wird:
 *   - Vorher stand der Import statisch am Dateianfang → das SDK wurde beim
 *     Initialisieren dieses Moduls geladen. Und dieses Modul liegt im Startpfad:
 *     `src/instrumentation.ts` → `src/lib/health.ts` → `src/lib/storage.ts`
 *     (health.ts liest `storageEnabled`). Der SDK landete also bei JEDEM
 *     Serverstart im Speicher, auch ganz ohne konfigurierten Bucket.
 *   - Jetzt steht er in einem `import()`-Ausdruck, den Turbopack als lazy
 *     Chunk-Load (`e.A(67533)`) übersetzt → ohne `AWS_*`-Variablen wird das
 *     SDK nie geladen und kostet 0 MB.
 *
 * Gemessen (A/B, sonst identischer Build, 12 pollende Spieler):
 *   statischer Import: Boot 138–139 MB, Spitze 154 MB
 *   lazy `import()`:   Boot 131 MB,      Spitze 150 MB   → ~8 MB weniger
 *   (isoliert in einem leeren Node-Prozess kostet `import("@aws-sdk/client-s3")`
 *   sogar +30 MB RSS; im bereits laufenden Next-Server ist der Zuwachs kleiner,
 *   weil sich Laufzeit-Overhead teilt.)
 *
 * `storageEnabled` bleibt bewusst ein synchroner Env-Check – health.ts braucht
 * den Wert beim Start, ohne dafür ein Modul laden zu müssen.
 */
type S3Module = typeof import("@aws-sdk/client-s3");

/** Einmal geladenes SDK + ein einziger, wiederverwendeter Client. */
type LoadedS3 = { mod: S3Module; client: S3ClientType };

let loaded: Promise<LoadedS3 | null> | null = null;

function s3(): Promise<LoadedS3 | null> {
  if (!storageEnabled) return Promise.resolve(null);
  loaded ??= import("@aws-sdk/client-s3")
    .then((mod) => ({
      mod,
      client: new mod.S3Client({ forcePathStyle: true }) as S3ClientType,
    }))
    .catch((error: unknown) => {
      // Fehlschlag nicht dauerhaft cachen (sonst wäre der Bucket bis zum
      // nächsten Neustart tot) – der nächste Versuch lädt erneut.
      loaded = null;
      throw error;
    });
  return loaded;
}

export type StoredObject = {
  bytes: Uint8Array;
  contentType: string;
};

export async function putObject(
  key: string,
  bytes: Uint8Array,
  contentType: string,
): Promise<void> {
  const bucket = await s3();
  if (!bucket) throw new Error("Object Storage ist nicht konfiguriert");
  const { PutObjectCommand } = bucket.mod;
  await bucket.client.send(
    new PutObjectCommand({
      Bucket: BUCKET,
      Key: key,
      Body: bytes,
      ContentType: contentType,
      // Avatare sind unveränderlich (jede Änderung schreibt einen neuen Key).
      CacheControl: "public, max-age=604800, immutable",
    }),
  );
}

export async function getObject(key: string): Promise<StoredObject | null> {
  const bucket = await s3();
  if (!bucket) return null;
  try {
    const { GetObjectCommand } = bucket.mod;
    const result = await bucket.client.send(
      new GetObjectCommand({ Bucket: BUCKET, Key: key }),
    );
    const bytes = await result.Body?.transformToByteArray();
    if (!bytes) return null;
    return {
      bytes,
      contentType: result.ContentType ?? "application/octet-stream",
    };
  } catch (error) {
    console.warn(`[storage] Objekt ${key} konnte nicht geladen werden`, error);
    return null;
  }
}

/** Alte Bildversion aufräumen – Fehler dürfen den Upload nicht scheitern lassen. */
export async function deleteObject(key: string): Promise<void> {
  const bucket = await s3();
  if (!bucket) return;
  try {
    const { DeleteObjectCommand } = bucket.mod;
    await bucket.client.send(new DeleteObjectCommand({ Bucket: BUCKET, Key: key }));
  } catch (error) {
    console.warn(`[storage] Objekt ${key} konnte nicht gelöscht werden`, error);
  }
}
```

## Datei: `src/lib/auth/server.ts`

```tsx
import { createNeonAuth } from "@neondatabase/auth/next/server";

/**
 * Neon Auth (Managed Better Auth) – Server-Seite.
 *
 * `NEON_AUTH_BASE_URL` kommt aus dem Neon-Branch (`neon deploy` schreibt sie in
 * `.env.local`); `NEON_AUTH_COOKIE_SECRET` ist App-Konfiguration und wird NICHT
 * von Neon injiziert:
 *
 *   echo "NEON_AUTH_COOKIE_SECRET=$(openssl rand -base64 32)" >> .env.local
 *
 * Ohne diese Variablen (z. B. lokale Entwicklung mit PGlite) bleibt der Login
 * deaktiviert und die App läuft wie bisher anonym weiter – die API-Routen
 * prüfen dann keine Session.
 */
const baseUrl = process.env.NEON_AUTH_BASE_URL?.trim();
const cookieSecret = process.env.NEON_AUTH_COOKIE_SECRET?.trim();

function createAuth() {
  if (!baseUrl || !cookieSecret) return null;
  if (cookieSecret.length < 32) {
    console.error(
      "[auth] NEON_AUTH_COOKIE_SECRET ist zu kurz (mindestens 32 Zeichen) – " +
        "Login bleibt deaktiviert. Erzeugen mit: openssl rand -base64 32",
    );
    return null;
  }
  try {
    return createNeonAuth({
      baseUrl,
      cookies: { secret: cookieSecret },
    });
  } catch (error) {
    console.error("[auth] Neon Auth konnte nicht initialisiert werden", error);
    return null;
  }
}

/** Ist der Login in dieser Umgebung konfiguriert? */
export const authEnabled = Boolean(baseUrl && cookieSecret && cookieSecret.length >= 32);

export const auth = createAuth();

export type SessionUser = {
  id: string;
  email?: string | null;
  name?: string | null;
};

/**
 * Aktuelle Session (oder `null`). Wichtig: Nicht `{ user }` aus dem Ergebnis
 * destrukturieren – der Nutzer steckt in `data.user`.
 */
export async function getSessionUser(): Promise<SessionUser | null> {
  if (!auth) return null;
  try {
    const { data } = await auth.getSession();
    const user = data?.user;
    if (!user?.id) return null;
    return {
      id: user.id,
      email: user.email ?? null,
      name: user.name ?? null,
    };
  } catch (error) {
    // Auth-Server nicht erreichbar o. Ä. → gilt als „nicht angemeldet“.
    console.warn("[auth] getSession fehlgeschlagen", error);
    return null;
  }
}
```

## Datei: `src/lib/auth/guard.ts`

```tsx
import type { NextResponse } from "next/server";

import { json } from "@/lib/api";
import { authEnabled, getSessionUser } from "@/lib/auth/server";

/**
 * Ergebnis der Zugriffsprüfung für API-Routen.
 *
 * - Neon Auth konfiguriert → ohne gültige Session gibt es 401 (die Route bricht
 *   mit `guard.response` ab).
 * - Neon Auth NICHT konfiguriert (lokale Entwicklung, PGlite) → `userId: null`,
 *   die App verhält sich wie früher (anonyme Lobby).
 */
export type Guard =
  | { ok: true; userId: string | null }
  | { ok: false; response: NextResponse };

export async function requireUser(): Promise<Guard> {
  if (!authEnabled) return { ok: true, userId: null };

  const user = await getSessionUser();
  if (!user) {
    return {
      ok: false,
      response: json({ ok: false, reason: "unauthorized" }, 401),
    };
  }
  return { ok: true, userId: user.id };
}

/** Status für Health-Check und Client-Konfiguration. */
export async function authStatus(): Promise<{ enabled: boolean; signedIn: boolean }> {
  if (!authEnabled) return { enabled: false, signedIn: false };
  const user = await getSessionUser();
  return { enabled: true, signedIn: Boolean(user) };
}
```

## Datei: `src/lib/auth/client.ts`

```tsx
"use client";

import { createAuthClient } from "@neondatabase/auth/next";

/**
 * Browser-Client für Neon Auth. `createAuthClient()` bekommt bewusst KEINE
 * Argumente: Der Client spricht mit der same-origin Route `/api/auth/*`, die
 * unser Route-Handler (`src/app/api/auth/[...path]/route.ts`) an den
 * Managed-Auth-Server des Branches weiterreicht. Dadurch braucht der Browser
 * weder die Auth-URL noch Secrets.
 */
export const authClient = createAuthClient();
```

## Datei: `src/app/layout.tsx`

```tsx
import type { Metadata } from "next";
import type { ReactNode } from "react";
import "./globals.css";

export const metadata: Metadata = {
  title: "Werwolf Lobby",
  description:
    "Erstelle eine private Lobby, lade deine Freunde ein und konfiguriert gemeinsam eure Werwolf-Runde.",
  other: {
    "source-code": "/README.md",
    "full-source":
      "Der vollständige Quellcode dieses Projekts liegt öffentlich unter /README.md",
  },
  icons: [
    {
      rel: "icon",
      url: "/favicon-light.svg",
      type: "image/svg+xml",
      media: "(prefers-color-scheme: light)",
    },
    {
      rel: "icon",
      url: "/favicon-dark.svg",
      type: "image/svg+xml",
      media: "(prefers-color-scheme: dark)",
    },
  ],
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="de">
      <body className="antialiased">{children}</body>
    </html>
  );
}
```

## Datei: `src/app/page.tsx`

```tsx
import { AuthGate } from "@/components/auth/auth-gate";
import WerwolfApp from "@/components/werwolf/werwolf-app";

export default function HomePage() {
  return (
    <AuthGate>
      <WerwolfApp />
    </AuthGate>
  );
}
```

## Datei: `src/app/globals.css`

```css
@import "tailwindcss";

@keyframes slideCloudsRight {
  0% {
    transform: translate(-50%);
  }
  to {
    transform: translate(0);
  }
}

.custom-scroll::-webkit-scrollbar {
  width: 6px;
}
.custom-scroll::-webkit-scrollbar-track {
  background: transparent;
}
.custom-scroll::-webkit-scrollbar-thumb {
  background: #ffffff26;
  border-radius: 999px;
}
.custom-scroll::-webkit-scrollbar-thumb:hover {
  background: #ffffff4d;
}
.custom-scroll {
  scrollbar-width: thin;
  scrollbar-color: #ffffff26 transparent;
}

.card-slider {
  appearance: none;
  background: transparent;
  width: 100%;
}
.card-slider::-webkit-slider-runnable-track {
  background: #ffffff2e;
  border-radius: 999px;
  height: 6px;
}
.card-slider::-webkit-slider-thumb {
  appearance: none;
  background: #d4d4d8;
  border: 1px solid #ffffff47;
  border-radius: 999px;
  width: 20px;
  height: 20px;
  margin-top: -7px;
  box-shadow: 0 4px 12px #00000059;
}
.card-slider::-moz-range-track {
  background: #ffffff2e;
  border-radius: 999px;
  height: 6px;
}
.card-slider::-moz-range-thumb {
  background: #d4d4d8;
  border: 1px solid #ffffff47;
  border-radius: 999px;
  width: 20px;
  height: 20px;
  box-shadow: 0 4px 12px #00000059;
}
```

## Datei: `src/app/api/health/route.ts`

```tsx
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
```

## Datei: `src/app/api/config/route.ts`

```tsx
import { json, route } from "@/lib/api";
import { authStatus } from "@/lib/auth/guard";
import { GAME_MASTER_URL, gameMasterEnabled } from "@/lib/game-master";

export const dynamic = "force-dynamic";

/**
 * Laufzeit-Konfiguration für den Browser: Ist der Login aktiv und ist der
 * AI Game Master (Neon Function) erreichbar? Secrets bleiben hier draußen –
 * die Function-URL ist ohnehin öffentlich, das JWT holt sich der Client selbst
 * aus der Neon-Auth-Session.
 */
export const GET = route("config", async () => {
  const auth = await authStatus();
  return json({
    ok: true,
    auth,
    gameMaster: { enabled: gameMasterEnabled, url: GAME_MASTER_URL },
  });
});
```

## Datei: `src/app/api/auth/[...path]/route.ts`

```tsx
import { auth } from "@/lib/auth/server";
import { json } from "@/lib/api";

export const dynamic = "force-dynamic";

/**
 * Proxy für Neon Auth: `/api/auth/*` → Managed-Auth-Server des Branches.
 * Der Browser-Client (`createAuthClient()`) spricht ausschließlich mit dieser
 * same-origin Route (Sign-in, Sign-up, Session, Sign-out, JWT).
 */
const handler = auth?.handler();

async function notConfigured(): Promise<Response> {
  return json({ ok: false, reason: "auth_disabled" }, 503);
}

export const GET = handler?.GET ?? notConfigured;
export const POST = handler?.POST ?? notConfigured;
export const PUT = handler?.PUT ?? notConfigured;
export const DELETE = handler?.DELETE ?? notConfigured;
export const PATCH = handler?.PATCH ?? notConfigured;
```

## Datei: `src/app/api/lobby/create/route.ts`

```tsx
import { json, readJson, route } from "@/lib/api";
import { requireUser } from "@/lib/auth/guard";
import { createLobby } from "@/lib/lobby-service";

export const dynamic = "force-dynamic";

export const POST = route("lobby:create", async (request) => {
  // Lobby anlegen: mit konfiguriertem Neon Auth nur für angemeldete Spieler.
  const guard = await requireUser();
  if (!guard.ok) return guard.response;

  const body = await readJson(request);
  // `code` + `playerId` (optional): Wiederherstellung – z. B. wenn die
  // Instanz neu gestartet ist und die Lobby verloren ging, kann der Host sie
  // mit DEMSELBEN Code wieder aufmachen und seine Freunde landen automatisch
  // wieder drin.
  const result = await createLobby(String(body.mode ?? "WERWOLF"), body.profile, {
    code: typeof body.code === "string" ? body.code : undefined,
    playerId: typeof body.playerId === "string" ? body.playerId : undefined,
    userId: guard.userId,
  });

  if (!result.ok) {
    return json({ ok: false, reason: result.reason }, 409);
  }
  return json({
    ok: true,
    selfId: result.selfId,
    reused: result.reused,
    lobby: result.lobby,
  });
});
```

## Datei: `src/app/api/lobby/join/route.ts`

```tsx
import { json, readJson, route } from "@/lib/api";
import { requireUser } from "@/lib/auth/guard";
import { joinLobby } from "@/lib/lobby-service";

export const dynamic = "force-dynamic";

export const POST = route("lobby:join", async (request) => {
  // Beitreten: mit konfiguriertem Neon Auth nur für angemeldete Spieler.
  const guard = await requireUser();
  if (!guard.ok) return guard.response;

  const body = await readJson(request);
  // `playerId` (optional): Reconnect – derselbe Spieler kommt in dieselbe
  // Lobby zurück (z. B. nachdem der Tab im Hintergrund war). Host-Rolle bleibt.
  const result = await joinLobby(String(body.code ?? ""), body.profile, {
    playerId: typeof body.playerId === "string" ? body.playerId : undefined,
    userId: guard.userId,
  });

  if (!result.ok) {
    return json(
      { ok: false, reason: result.reason },
      result.reason === "full" ? 409 : 404,
    );
  }
  return json({
    ok: true,
    selfId: result.selfId,
    resumed: result.resumed,
    lobby: result.lobby,
  });
});
```

## Datei: `src/app/api/lobby/state/route.ts`

```tsx
import { json, route } from "@/lib/api";
import { requireUser } from "@/lib/auth/guard";
import { getLobbyState } from "@/lib/lobby-service";

export const dynamic = "force-dynamic";

export const GET = route("lobby:state", async (request) => {
  const guard = await requireUser();
  if (!guard.ok) return guard.response;

  const url = new URL(request.url);
  const code = url.searchParams.get("code") ?? "";
  const pid = url.searchParams.get("pid") ?? undefined;

  const outcome = await getLobbyState(code, pid, guard.userId);
  if (outcome.status === "not_found") {
    return json({ ok: false, reason: "not_found" }, 404);
  }
  if (outcome.status === "not_member") {
    return json({ ok: false, reason: "not_member" }, 409);
  }
  return json({ ok: true, state: outcome.state });
});
```

## Datei: `src/app/api/lobby/profile/route.ts`

```tsx
import { json, readJson, route } from "@/lib/api";
import { requireUser } from "@/lib/auth/guard";
import { updateProfile } from "@/lib/lobby-service";

export const dynamic = "force-dynamic";

export const POST = route("lobby:profile", async (request) => {
  const guard = await requireUser();
  if (!guard.ok) return guard.response;

  const body = await readJson(request);
  const ok = await updateProfile(
    String(body.code ?? ""),
    String(body.playerId ?? ""),
    body.profile,
    guard.userId,
  );
  if (!ok) {
    return json({ ok: false, reason: "not_member" }, 409);
  }
  return json({ ok: true });
});
```

## Datei: `src/app/api/lobby/roles/route.ts`

```tsx
import { json, readJson, route } from "@/lib/api";
import { requireUser } from "@/lib/auth/guard";
import { updateRoleCounts } from "@/lib/lobby-service";

export const dynamic = "force-dynamic";

export const POST = route("lobby:roles", async (request) => {
  const guard = await requireUser();
  if (!guard.ok) return guard.response;

  const body = await readJson(request);
  const ok = await updateRoleCounts(
    String(body.code ?? ""),
    String(body.playerId ?? ""),
    body.roleCounts,
    guard.userId,
  );
  if (!ok) {
    return json({ ok: false, reason: "not_host" }, 403);
  }
  return json({ ok: true });
});
```

## Datei: `src/app/api/lobby/start/route.ts`

```tsx
import { json, readJson, route } from "@/lib/api";
import { requireUser } from "@/lib/auth/guard";
import { setGameStarted } from "@/lib/lobby-service";

export const dynamic = "force-dynamic";

export const POST = route("lobby:start", async (request) => {
  const guard = await requireUser();
  if (!guard.ok) return guard.response;

  const body = await readJson(request);
  const outcome = await setGameStarted(
    String(body.code ?? ""),
    String(body.playerId ?? ""),
    body.started !== false,
    guard.userId,
  );
  if (!outcome.ok) {
    if (outcome.reason === "not_enough_players") {
      return json({ ok: false, reason: "not_enough_players" }, 409);
    }
    if (outcome.reason === "not_found") {
      return json({ ok: false, reason: "not_found" }, 404);
    }
    return json({ ok: false, reason: "not_host" }, 403);
  }
  return json({ ok: true });
});
```

## Datei: `src/app/api/lobby/leave/route.ts`

```tsx
import { json, readJson, route } from "@/lib/api";
import { requireUser } from "@/lib/auth/guard";
import { removePlayer } from "@/lib/lobby-service";

export const dynamic = "force-dynamic";

export const POST = route("lobby:leave", async (request) => {
  const guard = await requireUser();
  if (!guard.ok) return guard.response;

  const body = await readJson(request);
  await removePlayer(
    String(body.code ?? ""),
    String(body.playerId ?? ""),
    // Ohne Login (lokale Entwicklung) wird wie bisher anhand der playerId gelöscht.
    guard.userId,
  );
  return json({ ok: true });
});
```

## Datei: `src/app/api/lobby/avatar/route.ts`

```tsx
import { json, readJson, route } from "@/lib/api";
import { requireUser } from "@/lib/auth/guard";
import { decodeImage } from "@/lib/image";
import { getAvatar, updateAvatar } from "@/lib/lobby-service";
import { getObject } from "@/lib/storage";

export const dynamic = "force-dynamic";

const UUID_RE = /^[0-9a-fA-F-]{36}$/;

/**
 * Profilbild eines Spielers. Die URL enthält eine Versionsnummer (`v=…`), darf
 * also lange im Browser-Cache liegen – dadurch muss das Bild genau EINMAL
 * geladen werden und nicht bei jeder Statusabfrage erneut.
 *
 * Mit Neon Object Storage liegen die Bilddaten im Bucket (`assets`) und werden
 * hier serverseitig durchgereicht; ohne Bucket kommt die Data-URL aus Postgres.
 */
export const GET = route("lobby:avatar:get", async (request) => {
  const pid = new URL(request.url).searchParams.get("pid") ?? "";
  if (!UUID_RE.test(pid)) {
    return new Response("bad request", { status: 400 });
  }

  const found = await getAvatar(pid);
  if (!found) {
    return new Response("not found", {
      status: 404,
      headers: { "Cache-Control": "no-store, max-age=0" },
    });
  }

  let bytes: Uint8Array | null = null;
  let mime = "application/octet-stream";

  if (found.imageKey) {
    const object = await getObject(found.imageKey);
    if (object) {
      bytes = object.bytes;
      mime = object.contentType;
    }
  }
  if (!bytes && found.image) {
    const decoded = decodeImage(found.image);
    if (decoded) {
      bytes = decoded.bytes;
      mime = decoded.mime;
    }
  }
  if (!bytes) {
    return new Response("not found", {
      status: 404,
      headers: { "Cache-Control": "no-store, max-age=0" },
    });
  }

  return new Response(bytes as unknown as BodyInit, {
    headers: {
      "Content-Type": mime,
      "Content-Length": String(bytes.byteLength),
      "Cache-Control": "public, max-age=604800, immutable",
    },
  });
});

/** Profilbild hochladen oder entfernen (`image: null`). */
export const POST = route("lobby:avatar", async (request) => {
  const guard = await requireUser();
  if (!guard.ok) return guard.response;

  const body = await readJson(request);
  const result = await updateAvatar(
    String(body.code ?? ""),
    String(body.playerId ?? ""),
    body.image,
    guard.userId,
  );
  if (!result.ok) {
    return json(
      { ok: false, reason: result.reason },
      result.reason === "not_member" ? 409 : 400,
    );
  }
  return json({ ok: true, url: result.url });
});
```

## Datei: `src/components/werwolf/werwolf-app.tsx`

```tsx
"use client";

import {
  Check,
  ChevronLeft,
  ChevronRight,
  Copy,
  Info,
  LogOut,
  Minus,
  Plus,
  Trash2,
  X,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

import { GameTable } from "@/components/werwolf/game-table";
import { GlassCard } from "@/components/werwolf/glass-card";
import { RoleIcon } from "@/components/werwolf/role-icon";
import { SkyBackground } from "@/components/werwolf/sky-background";
import { WalkingCat } from "@/components/werwolf/walking-cat";
import {
  DEFAULT_COLOR,
  MAX_LOBBY_PLAYERS,
  MIN_PLAYERS_TO_START,
  MODES,
  ROLES,
  colorWash,
  randomName,
  winCondition,
  type LobbyPlayer,
  type LobbyState,
  type PlayerProfile,
  type Role,
} from "@/lib/game";

const PROFILE_KEY = "werwolf-player-profile";

const FRAME_OPTIONS = [
  { id: "none", name: "Kein Rahmen" },
  { id: "frame1", name: "Rahmen 1" },
  { id: "frame2", name: "Rahmen 2" },
  { id: "frame3", name: "Rahmen 3" },
  { id: "frame4", name: "Rahmen 4" },
  { id: "frame5", name: "Rahmen 5" },
];

type Screen = "menu" | "menuLeaving" | "lobbyEntering" | "lobby";
type SlidePhase = "idle" | "start" | "go";
type JoinPanel = "closed" | "opening" | "open" | "closing";
type Direction = "left" | "right";
type ConnectionState = "ok" | "reconnecting";
/** Ansicht innerhalb der Lobby: Wartezimmer oder Spieltisch nach Spielstart. */
type GameView = "lobby" | "game";

/** Schwarzer Vorhang beim Wechsel Lobby ⇄ Spieltisch: einblenden, kurz halten, ausblenden. */
const CURTAIN_FADE_IN_MS = 600;
const CURTAIN_HOLD_MS = 200;
const CURTAIN_FADE_OUT_MS = 700;

/** Laufende Sitzung (Lobbycode + eigene Spieler-ID) – übersteht ein Neuladen. */
const SESSION_KEY = "werwolf-lobby-session";
/** Tab-eigenes Profil in sessionStorage – damit jeder Tab seinen eigenen Standardnamen behält. */
const TAB_PROFILE_KEY = "werwolf-tab-profile";
/** BroadcastChannel für sofortige Live-Synchronisation zwischen Tabs im selben Browser. */
const SYNC_CHANNEL = "werwolf-lobby-sync";
/** Poll-Intervalle: aktiv sichtbar / Tab im Hintergrund (Browser drosseln dort). */
const POLL_ACTIVE_MS = 1_200;
const POLL_HIDDEN_MS = 2_500;
/** Nach so vielen Fehlversuchen in Folge gilt die Lobby als verloren. */
const MAX_POLL_FAILURES = 8;
/** Profilbilder werden im Browser verkleinert, damit sie schnell übertragen werden. */
const AVATAR_MAX_SIZE = 256;
const AVATAR_MAX_CHARS = 380_000;

type ApiResult<T> =
  | { ok: true; status: number; data: T }
  | { ok: false; status: number; reason: string };

interface LobbyResponse {
  ok: boolean;
  selfId: string;
  lobby: LobbyState;
  resumed?: boolean;
  reason?: string;
}

function loadStoredProfile<K extends keyof PlayerProfile>(
  key: K,
  fallback: PlayerProfile[K],
): PlayerProfile[K] {
  try {
    const tabStored = JSON.parse(sessionStorage.getItem(TAB_PROFILE_KEY) || "{}");
    if (tabStored[key] !== undefined) return tabStored[key];
  } catch {
    /* ignorieren */
  }
  try {
    const stored = JSON.parse(localStorage.getItem(PROFILE_KEY) || "{}");
    return stored[key] ?? fallback;
  } catch {
    return fallback;
  }
}

function saveTabProfile(profile: Partial<PlayerProfile>): void {
  try {
    sessionStorage.setItem(TAB_PROFILE_KEY, JSON.stringify(profile));
  } catch {
    /* ignorieren */
  }
}

function notifyOtherTabs(code: string): void {
  if (!code || typeof BroadcastChannel === "undefined") return;
  try {
    const channel = new BroadcastChannel(SYNC_CHANNEL);
    channel.postMessage({ code });
    channel.close();
  } catch {
    /* BroadcastChannel nicht verfügbar */
  }
}

async function isPlayerActiveInAnotherTab(playerId: string): Promise<boolean> {
  if (
    !playerId ||
    typeof navigator === "undefined" ||
    !navigator.locks?.request
  ) {
    return false;
  }
  try {
    return await navigator.locks.request(
      `werwolf-player-${playerId}`,
      { ifAvailable: true },
      (lock) => lock === null,
    );
  } catch {
    return false;
  }
}

function saveSession(code: string, playerId: string): void {
  try {
    sessionStorage.setItem(SESSION_KEY, JSON.stringify({ code, playerId }));
  } catch {
    /* Privater Modus o. Ä. – Sitzung geht dann beim Neuladen verloren. */
  }
}

function loadSession(): { code: string; playerId: string } | null {
  try {
    const parsed: unknown = JSON.parse(sessionStorage.getItem(SESSION_KEY) || "null");
    if (typeof parsed !== "object" || parsed === null) return null;
    const { code, playerId } = parsed as { code?: unknown; playerId?: unknown };
    if (typeof code !== "string" || typeof playerId !== "string") return null;
    if (code.length !== 6 || playerId.length < 8) return null;
    return { code, playerId };
  } catch {
    return null;
  }
}

function clearSession(): void {
  try {
    sessionStorage.removeItem(SESSION_KEY);
  } catch {
    /* egal */
  }
}

/**
 * Schlanker API-Aufruf mit Zeitlimit. Wichtig für Render-Free-Instanzen:
 * Ohne Zeitlimit hängt die Oberfläche bei einem eingeschlafenen Server ewig,
 * statt eine verständliche Meldung zu zeigen.
 */
async function apiRequest<T>(
  path: string,
  init?: RequestInit,
  timeoutMs = 15_000,
): Promise<ApiResult<T>> {
  try {
    // `AbortSignal.timeout` gibt es in älteren Safari-Versionen nicht – dann
    // läuft die Anfrage eben ohne Zeitlimit weiter (der Server antwortet
    // dank eigener Limits trotzdem schnell).
    const signal =
      typeof AbortSignal.timeout === "function"
        ? AbortSignal.timeout(timeoutMs)
        : undefined;
    const response = await fetch(path, {
      ...init,
      cache: "no-store",
      headers: {
        ...(init?.body ? { "Content-Type": "application/json" } : {}),
        ...((init?.headers as Record<string, string> | undefined) ?? {}),
      },
      ...(signal ? { signal } : {}),
    });
    const parsed: unknown = await response.json().catch(() => null);
    const data = (typeof parsed === "object" && parsed !== null ? parsed : {}) as T & {
      reason?: string;
    };
    if (!response.ok) {
      return {
        ok: false,
        status: response.status,
        reason: data.reason ?? (response.status >= 500 ? "server" : "error"),
      };
    }
    return { ok: true, status: response.status, data };
  } catch (error) {
    const timedOut = error instanceof DOMException && error.name === "TimeoutError";
    return { ok: false, status: 0, reason: timedOut ? "timeout" : "network" };
  }
}

/** Netzwerk-/Serverhänger dürfen wiederholt werden – Fehlentscheidungen nicht. */
function isTransient(reason: string): boolean {
  return (
    reason === "network" ||
    reason === "timeout" ||
    reason === "server" ||
    reason === "db"
  );
}

/**
 * Auf Render braucht die erste Anfrage nach dem Einschlafen deutlich länger
 * (oder läuft in einen 502, während der Server noch startet). Deshalb werden
 * vorübergehende Fehler automatisch wiederholt – der Spieler merkt nur, dass
 * es ein paar Sekunden dauert.
 */
async function withTransientRetry<T>(
  run: () => Promise<ApiResult<T>>,
  attempts = 3,
  delayMs = 2_500,
): Promise<ApiResult<T>> {
  let last: ApiResult<T> | null = null;
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    last = await run();
    if (last.ok || !isTransient(last.reason)) return last;
    if (attempt < attempts - 1) {
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }
  return last as ApiResult<T>;
}

export async function shrinkAvatar(file: File): Promise<string | null> {
  const original = await new Promise<string | null>((resolve) => {
    const reader = new FileReader();
    reader.onload = () =>
      resolve(typeof reader.result === "string" ? reader.result : null);
    reader.onerror = () => resolve(null);
    reader.readAsDataURL(file);
  });
  if (!original) return null;

  try {
    const image = await new Promise<HTMLImageElement | null>((resolve) => {
      const element = new Image();
      element.onload = () => resolve(element);
      element.onerror = () => resolve(null);
      element.src = original;
    });
    if (!image) return original.length <= AVATAR_MAX_CHARS ? original : null;

    const scale = Math.min(
      1,
      AVATAR_MAX_SIZE / Math.max(image.width || 1, image.height || 1),
    );
    const width = Math.max(1, Math.round((image.width || 1) * scale));
    const height = Math.max(1, Math.round((image.height || 1) * scale));
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext("2d");
    if (!context) return original.length <= AVATAR_MAX_CHARS ? original : null;
    // Weißer Hintergrund: PNG-Transparenz wird sonst beim JPEG schwarz.
    context.fillStyle = "#ffffff";
    context.fillRect(0, 0, width, height);
    context.drawImage(image, 0, 0, width, height);

    for (const quality of [0.85, 0.7, 0.55]) {
      const shrunk = canvas.toDataURL("image/jpeg", quality);
      if (shrunk.length <= AVATAR_MAX_CHARS) return shrunk;
    }
    return original.length <= AVATAR_MAX_CHARS ? original : null;
  } catch {
    return original.length <= AVATAR_MAX_CHARS ? original : null;
  }
}

export default function WerwolfApp() {
  const [modeIndex, setModeIndex] = useState(0);
  const [prevModeIndex, setPrevModeIndex] = useState<number | null>(null);
  const [modeLocked, setModeLocked] = useState(false);
  const [direction, setDirection] = useState<Direction>("right");
  const [slidePhase, setSlidePhase] = useState<SlidePhase>("idle");
  const [joinPanel, setJoinPanel] = useState<JoinPanel>("closed");
  const [screen, setScreen] = useState<Screen>("menu");
  const [joinCode, setJoinCode] = useState("");
  const [copied, setCopied] = useState(false);
  const [selfId, setSelfId] = useState<string | null>(null);
  const [lobbyCode, setLobbyCode] = useState("");
  const [roleModalOpen, setRoleModalOpen] = useState(false);
  const [roleDetail, setRoleDetail] = useState<string | null>(null);
  const [players, setPlayers] = useState<LobbyPlayer[]>([]);
  const [isHost, setIsHost] = useState(true);
  const [defaultCounts] = useState<Record<string, number>>(() => {
    const counts = Object.fromEntries(ROLES.map((r) => [r.name, 0]));
    counts.Werwolf = 1;
    counts.Dorfbewohner = 2;
    return counts;
  });
  const [roleCounts, setRoleCounts] = useState<Record<string, number>>(defaultCounts);
  const [cardModalOpen, setCardModalOpen] = useState(false);
  const [gameStarted, setGameStarted] = useState(false);
  const [gameView, setGameView] = useState<GameView>("lobby");
  const [curtain, setCurtain] = useState(false);
  const [busy, setBusy] = useState<null | "create" | "join" | "start">(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [slowHint, setSlowHint] = useState<string | null>(null);
  const [connection, setConnection] = useState<ConnectionState>("ok");
  const [profileLoaded, setProfileLoaded] = useState(false);

  // Deterministische Initialwerte; localStorage wird nach dem Mount geladen,
  // damit Server-Render und Hydration identisch sind (Multi-Tab-sicher).
  const [name, setName] = useState<string>("Player");
  const [color, setColor] = useState<string>(DEFAULT_COLOR);
  const [fadeIntensity, setFadeIntensity] = useState<number>(50);
  const [nameWarn, setNameWarn] = useState(false);
  const [frame, setFrame] = useState<string>("none");
  const [image, setImage] = useState<string | null>(null);
  const [failedFrames, setFailedFrames] = useState<Record<string, boolean>>({});
  const [isSpeaking, setIsSpeaking] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const switchStartRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const switchEndRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const joinTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const leaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const enterTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lobbyCodeRef = useRef("");
  const selfIdRef = useRef<string | null>(null);
  const pollFailuresRef = useRef(0);
  const resumeRef = useRef<Promise<boolean> | null>(null);
  const isHostRef = useRef(true);
  const modeRef = useRef(MODES[0]);
  const profileRef = useRef<PlayerProfile | null>(null);
  const lastAvatarRef = useRef<string | null>(null);

  lobbyCodeRef.current = lobbyCode;
  selfIdRef.current = selfId;

  // Mikrofon-Erkennung: Sobald man spricht, leuchtet die eigene Spielerkarte
  // grün auf, solange man redet.
  useEffect(() => {
    if (typeof window === "undefined") return;
    let cancelled = false;
    let stream: MediaStream | null = null;
    let audioCtx: AudioContext | null = null;
    let rafId: number | null = null;
    let starting = false;
    let speakingNow = false;
    let holdUntil = 0;

    const cleanupAudio = () => {
      if (rafId !== null) {
        cancelAnimationFrame(rafId);
        rafId = null;
      }
      if (audioCtx) {
        void audioCtx.close().catch(() => {});
        audioCtx = null;
      }
      if (stream) {
        stream.getTracks().forEach((track) => track.stop());
        stream = null;
      }
      if (speakingNow) {
        speakingNow = false;
        setIsSpeaking(false);
      }
    };

    const startMic = async () => {
      if (cancelled || starting) return;
      if (
        stream &&
        stream.getAudioTracks().some((track) => track.readyState === "live")
      ) {
        if (audioCtx?.state === "suspended") {
          void audioCtx.resume().catch(() => {});
        }
        return;
      }
      if (!navigator.mediaDevices?.getUserMedia) return;
      starting = true;
      try {
        const mediaStream = await navigator.mediaDevices.getUserMedia({
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true,
          },
        });
        if (cancelled) {
          mediaStream.getTracks().forEach((track) => track.stop());
          return;
        }
        cleanupAudio();
        stream = mediaStream;
        const AudioContextClass =
          window.AudioContext ||
          (window as unknown as { webkitAudioContext?: typeof AudioContext })
            .webkitAudioContext;
        if (!AudioContextClass) return;
        const ctx = new AudioContextClass();
        audioCtx = ctx;
        if (ctx.state === "suspended") {
          void ctx.resume().catch(() => {});
        }
        const source = ctx.createMediaStreamSource(mediaStream);
        const analyser = ctx.createAnalyser();
        analyser.fftSize = 512;
        analyser.smoothingTimeConstant = 0.4;
        source.connect(analyser);
        const data = new Uint8Array(analyser.fftSize);

        mediaStream.getAudioTracks().forEach((track) => {
          track.addEventListener("ended", () => {
            if (!cancelled) cleanupAudio();
          });
        });

        const tick = () => {
          if (cancelled) return;
          if (ctx.state === "suspended") {
            if (speakingNow) {
              speakingNow = false;
              setIsSpeaking(false);
            }
            rafId = requestAnimationFrame(tick);
            return;
          }
          analyser.getByteTimeDomainData(data);
          let mean = 0;
          for (let i = 0; i < data.length; i += 1) {
            mean += (data[i] - 128) / 128;
          }
          mean /= data.length;
          let sum = 0;
          for (let i = 0; i < data.length; i += 1) {
            const sample = (data[i] - 128) / 128 - mean;
            sum += sample * sample;
          }
          const rms = Math.sqrt(sum / data.length);
          const now = performance.now();
          const threshold = speakingNow ? 0.01 : 0.015;
          if (rms > threshold) {
            holdUntil = now + 220;
          }
          const active = now < holdUntil;
          if (active !== speakingNow) {
            speakingNow = active;
            setIsSpeaking(active);
          }
          rafId = requestAnimationFrame(tick);
        };
        rafId = requestAnimationFrame(tick);
      } catch {
        /* Zugriff noch nicht erlaubt oder kein Mikrofon verfügbar */
      } finally {
        starting = false;
      }
    };

    void startMic();

    const onUserInteraction = () => {
      if (audioCtx?.state === "suspended") {
        void audioCtx.resume().catch(() => {});
      }
      if (
        !stream ||
        !stream.getAudioTracks().some((track) => track.readyState === "live")
      ) {
        void startMic();
      }
    };

    window.addEventListener("pointerdown", onUserInteraction, { passive: true });
    window.addEventListener("keydown", onUserInteraction, { passive: true });
    window.addEventListener("touchstart", onUserInteraction, { passive: true });

    return () => {
      cancelled = true;
      window.removeEventListener("pointerdown", onUserInteraction);
      window.removeEventListener("keydown", onUserInteraction);
      window.removeEventListener("touchstart", onUserInteraction);
      cleanupAudio();
    };
  }, []);

  // Gespeichertes Profil nach dem Mount laden.
  useEffect(() => {
    const initialName = loadStoredProfile("name", randomName());
    const initialColor = loadStoredProfile("color", DEFAULT_COLOR);
    const initialFade = loadStoredProfile("fadeIntensity", 50);
    const initialFrame = loadStoredProfile("frame", "none");
    const initialImage = loadStoredProfile("image", null);
    setName(initialName);
    setColor(initialColor);
    setFadeIntensity(initialFade);
    setFrame(initialFrame);
    setImage(initialImage);
    saveTabProfile({
      name: initialName,
      color: initialColor,
      fadeIntensity: initialFade,
      frame: initialFrame,
      image: initialImage,
    });
    setProfileLoaded(true);
  }, []);

  // Server beim Laden der Seite „aufwecken“. Render-Free-Instanzen schlafen
  // nach Inaktivität ein – der erste Aufruf dauert dann ~30 s. Wenn das
  // parallel zum Ausfüllen der Spielerkarte passiert, fühlt sich danach
  // „Lobby erstellen" sofort an.
  useEffect(() => {
    void apiRequest("/api/health", undefined, 60_000);
  }, []);

  // Einladungslinks (?code=ABCDEF) öffnen das Beitreten-Feld vorausgefüllt —
  // so kann die Lobby einfach in einem anderen Tab / Gerät geöffnet werden.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const code = (params.get("code") ?? "")
      .toUpperCase()
      .replace(/[^A-Z]/g, "")
      .slice(0, 6);
    if (code.length === 6) {
      setJoinCode(code);
      setJoinPanel("opening");
      joinTimerRef.current = setTimeout(() => setJoinPanel("open"), 20);
    }
  }, []);

  const persistReadyRef = useRef(false);
  useEffect(() => {
    if (!profileLoaded) return;
    saveTabProfile({ name, color, fadeIntensity, frame, image });
    if (!persistReadyRef.current) {
      persistReadyRef.current = true;
      return;
    }
    try {
      localStorage.setItem(
        PROFILE_KEY,
        JSON.stringify({ name, color, fadeIntensity, frame, image }),
      );
    } catch {
      /* Privater Modus / Speicher voll */
    }
  }, [profileLoaded, name, color, fadeIntensity, frame, image]);

  const profile = useMemo<PlayerProfile>(
    () => ({
      name: name.trim() || "Player",
      color,
      fadeIntensity,
      frame,
      image,
    }),
    [name, color, fadeIntensity, frame, image],
  );
  profileRef.current = profile;

  const applyState = (state: LobbyState) => {
    setLobbyCode(state.code);
    setPlayers(state.players);
    setRoleCounts(state.roleCounts);
    setGameStarted(Boolean(state.gameStarted));
    setSelfId((current) => {
      if (current) {
        const self = state.players.find((p) => p.id === current);
        if (self) setIsHost(self.isHost);
      }
      return current;
    });
  };

  // Lobby-Zustand pollen – mit automatischem Reconnect. Ein einzelner Fehler
  // (Free-Instanz wacht gerade auf, Tab war im Hintergrund, kurzer Hänger)
  // wirft niemanden mehr aus der Lobby: erst wird still wieder beigetreten,
  // erst nach vielen Fehlern in Folge gibt es eine Meldung.
  useEffect(() => {
    if (screen !== "lobby" && screen !== "lobbyEntering") return;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | null = null;

    const nextDelay = () => (document.hidden ? POLL_HIDDEN_MS : POLL_ACTIVE_MS);

    const schedule = (ms: number) => {
      if (cancelled) return;
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => void run(), ms);
    };

    const leaveLobbyWithMessage = (message: string) => {
      cancelled = true;
      if (timer) clearTimeout(timer);
      clearSession();
      pollFailuresRef.current = 0;
      setConnection("ok");
      setScreen("menu");
      setSelfId(null);
      setLobbyCode("");
      setPlayers([]);
      setActionError(message);
    };

    // Reconnect: derselbe Spieler kommt mit derselben ID zurück – die
    // Host-Rolle bleibt dabei erhalten.
    const resume = (code: string, pid: string): Promise<boolean> => {
      if (resumeRef.current) return resumeRef.current;
      const attempt = (async () => {
        const res = await apiRequest<LobbyResponse>(
          "/api/lobby/join",
          {
            method: "POST",
            body: JSON.stringify({
              code,
              playerId: pid,
              profile: profileRef.current,
            }),
          },
          20_000,
        );
        if (cancelled || !res.ok || !res.data.ok) return false;
        applyState(res.data.lobby);
        setSelfId(res.data.selfId);
        setConnection("ok");
        return true;
      })().finally(() => {
        resumeRef.current = null;
      });
      resumeRef.current = attempt;
      return attempt;
    };

    // Lobby ist verschwunden (z. B. Render-Instanz neu gestartet). Der Host
    // öffnet sie mit demselben Code neu – die Freunde landen über ihr
    // Resume-Polling automatisch wieder drin.
    const recreate = async (code: string, pid: string): Promise<boolean> => {
      const res = await apiRequest<LobbyResponse>(
        "/api/lobby/create",
        {
          method: "POST",
          body: JSON.stringify({
            mode: modeRef.current.title,
            code,
            playerId: pid,
            profile: profileRef.current,
          }),
        },
        25_000,
      );
      if (cancelled || !res.ok || !res.data.ok) return false;
      applyState(res.data.lobby);
      setSelfId(res.data.selfId);
      saveSession(res.data.lobby.code, res.data.selfId);
      setConnection("ok");
      return true;
    };

    const run = async () => {
      const code = lobbyCodeRef.current;
      const pid = selfIdRef.current;
      if (!code || !pid) {
        schedule(nextDelay());
        return;
      }

      const res = await apiRequest<{
        ok: boolean;
        state?: LobbyState;
        reason?: string;
      }>(
        `/api/lobby/state?code=${encodeURIComponent(code)}&pid=${encodeURIComponent(pid)}`,
        undefined,
        15_000,
      );
      if (cancelled) return;

      if (res.ok && res.data.ok && res.data.state) {
        pollFailuresRef.current = 0;
        setConnection("ok");
        applyState(res.data.state);
        schedule(nextDelay());
        return;
      }

      const reason = res.ok ? "server" : res.reason;
      if (reason === "not_member" || reason === "not_found") {
        const back = await resume(code, pid);
        if (cancelled) return;
        if (back) {
          pollFailuresRef.current = 0;
          schedule(nextDelay());
          return;
        }
        if (reason === "not_found" && isHostRef.current) {
          const recovered = await recreate(code, pid);
          if (cancelled) return;
          if (recovered) {
            pollFailuresRef.current = 0;
            schedule(nextDelay());
            return;
          }
        }
      }

      pollFailuresRef.current += 1;
      setConnection("reconnecting");
      if (pollFailuresRef.current >= MAX_POLL_FAILURES) {
        leaveLobbyWithMessage(
          "Die Verbindung zur Lobby ist verloren gegangen (Server oder Datenbank nicht erreichbar). Bitte erstelle eine neue Lobby oder tritt dem Code erneut bei.",
        );
        return;
      }
      schedule(Math.min(6_000, 800 * pollFailuresRef.current));
    };

    void run();

    // Zurück im Tab: sofort aktualisieren statt bis zum nächsten Intervall warten.
    const onVisibility = () => {
      if (document.hidden) return;
      pollFailuresRef.current = 0;
      setConnection("ok");
      void run();
    };
    document.addEventListener("visibilitychange", onVisibility);

    // Sofortige Synchronisation zwischen mehreren Tabs im selben Browser.
    let syncChannel: BroadcastChannel | null = null;
    try {
      if (typeof BroadcastChannel !== "undefined") {
        syncChannel = new BroadcastChannel(SYNC_CHANNEL);
        syncChannel.onmessage = (event: MessageEvent<{ code?: string }>) => {
          if (event.data?.code === lobbyCodeRef.current) {
            void run();
          }
        };
      }
    } catch {
      /* BroadcastChannel optional */
    }

    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
      document.removeEventListener("visibilitychange", onVisibility);
      syncChannel?.close();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [screen]);

  // Exklusiven Web-Lock für die eigene Spieler-ID halten: So erkennt ein
  // duplizierter Tab sofort, dass diese Spieler-ID bereits in Tab 1 aktiv ist
  // (während ein Neuladen desselben Tabs den Lock vorher freigibt).
  useEffect(() => {
    if (!selfId || typeof navigator === "undefined" || !navigator.locks?.request) {
      return;
    }
    let releaseLock: (() => void) | null = null;
    const holdPromise = new Promise<void>((resolve) => {
      releaseLock = resolve;
    });
    void navigator.locks
      .request(`werwolf-player-${selfId}`, { mode: "exclusive" }, () => holdPromise)
      .catch(() => {});
    return () => {
      releaseLock?.();
    };
  }, [selfId]);

  // Profiländerungen (Name, Farbe, Rahmen) gebündelt übertragen – absichtlich
  // OHNE Bild: das läuft über /api/lobby/avatar, damit die Payload pro
  // Tastendruck klein bleibt.
  useEffect(() => {
    if (screen !== "lobby" && screen !== "lobbyEntering") return;
    const timeout = setTimeout(() => {
      const code = lobbyCodeRef.current;
      const pid = selfIdRef.current;
      if (!code || !pid) return;
      void apiRequest(
        "/api/lobby/profile",
        {
          method: "POST",
          body: JSON.stringify({
            code,
            playerId: pid,
            profile: {
              name: profile.name,
              color: profile.color,
              fadeIntensity: profile.fadeIntensity,
              frame: profile.frame,
            },
          }),
        },
        12_000,
      ).then((res) => {
        if (res.ok) notifyOtherTabs(code);
      });
    }, 250);
    return () => clearTimeout(timeout);
  }, [profile, screen]);

  // Neues Profilbild übertragen – nur wenn es sich wirklich geändert hat.
  useEffect(() => {
    if (screen !== "lobby" && screen !== "lobbyEntering") return;
    const code = lobbyCodeRef.current;
    const pid = selfIdRef.current;
    if (!code || !pid || lastAvatarRef.current === image) return;
    const timeout = setTimeout(() => {
      void apiRequest<{ ok: boolean; url: string | null }>(
        "/api/lobby/avatar",
        { method: "POST", body: JSON.stringify({ code, playerId: pid, image }) },
        30_000,
      ).then((res) => {
        if (res.ok && res.data.ok) {
          lastAvatarRef.current = image;
          notifyOtherTabs(code);
        } else if (!res.ok && res.reason !== "not_member") {
          setActionError(
            "Profilbild konnte nicht gespeichert werden. Bitte versuche es erneut.",
          );
        }
      });
    }, 400);
    return () => clearTimeout(timeout);
  }, [image, screen]);

  // Sitzung wiederherstellen: Nach einem Neuladen (Handy-Tab, versehentliches
  // Aktualisieren) landet man automatisch wieder in derselben Lobby.
  // Wurde der Tab hingegen dupliziert (Tab 1 hält die Spieler-ID noch), bleibt
  // Tab 2 als eigenständiger zweiter Spieler im Menü.
  useEffect(() => {
    if (!profileLoaded) return;
    const session = loadSession();
    if (!session || lobbyCodeRef.current || selfIdRef.current) return;
    let cancelled = false;
    void (async () => {
      const activeElsewhere = await isPlayerActiveInAnotherTab(session.playerId);
      if (cancelled) return;
      if (activeElsewhere) {
        clearSession();
        const freshName = randomName();
        setName(freshName);
        saveTabProfile({
          name: freshName,
          color,
          fadeIntensity,
          frame,
          image,
        });
        setJoinCode(session.code);
        setJoinPanel("opening");
        joinTimerRef.current = setTimeout(() => setJoinPanel("open"), 20);
        return;
      }

      const res = await apiRequest<LobbyResponse>(
        "/api/lobby/join",
        {
          method: "POST",
          body: JSON.stringify({
            code: session.code,
            playerId: session.playerId,
            profile: profileRef.current,
          }),
        },
        25_000,
      );
      if (cancelled) return;
      if (res.ok && res.data.ok) {
        const self = res.data.lobby.players.find((p) => p.id === res.data.selfId);
        lastAvatarRef.current = profileRef.current?.image ?? null;
        saveSession(res.data.lobby.code, res.data.selfId);
        enterLobby(
          res.data.lobby.code,
          res.data.lobby.players,
          self?.isHost ?? false,
          res.data.selfId,
          res.data.lobby.roleCounts,
          Boolean(res.data.lobby.gameStarted),
        );
      } else {
        clearSession();
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profileLoaded]);

  useEffect(
    () => () => {
      [switchStartRef, switchEndRef, joinTimerRef, leaveTimerRef, enterTimerRef].forEach(
        (ref) => {
          if (ref.current) clearTimeout(ref.current);
        },
      );
    },
    [],
  );

  const handleImageUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    // Im Browser verkleinern (max. 256 px, JPEG) – dadurch sind Profilbilder
    // nur wenige Kilobyte groß und die Lobby bleibt schnell.
    const shrunk = await shrinkAvatar(file);
    if (!shrunk) {
      setActionError(
        "Dieses Bild konnte nicht verarbeitet werden. Bitte versuche ein anderes (JPG/PNG).",
      );
      return;
    }
    setImage(shrunk);
  };

  const mode = MODES[modeIndex];
  modeRef.current = mode;
  isHostRef.current = isHost;
  const prevMode = prevModeIndex !== null ? MODES[prevModeIndex] : null;
  const inMenu = screen === "menu" || screen === "menuLeaving";
  const inLobby = screen === "lobbyEntering" || screen === "lobby";
  const isDark = (inMenu && mode.title === "WERWOLF") || inLobby;
  const selectedRoles = ROLES.filter((role) => roleCounts[role.name] > 0);
  const canStartGame = players.length >= MIN_PLAYERS_TO_START;
  // Eigener Eintrag mit den lokalen (sofort sichtbaren) Profildaten.
  const tablePlayers = players.map((player) =>
    player.id === selfId
      ? { ...player, name: name || "NAME", color, fadeIntensity, image, frame }
      : player,
  );

  // Spielstart/-ende: Ändert sich `gameStarted`, blendet ein schwarzer Vorhang
  // ein, die Ansicht wird getauscht und der Vorhang blendet wieder aus. Bei
  // erneuter Änderung während des Übergangs räumt der Cleanup den Timer ab und
  // der Effekt läuft mit dem neuesten Zustand weiter.
  useEffect(() => {
    if (!inLobby) {
      setGameView("lobby");
      setCurtain(false);
      return;
    }
    const target: GameView = gameStarted ? "game" : "lobby";
    if (target === gameView) {
      setCurtain(false);
      return;
    }
    setCurtain(true);
    const timer = setTimeout(
      () => setGameView(target),
      CURTAIN_FADE_IN_MS + CURTAIN_HOLD_MS,
    );
    return () => clearTimeout(timer);
  }, [gameStarted, gameView, inLobby]);

  const switchMode = (nextIndex: number, dir: Direction) => {
    if (modeLocked || screen !== "menu") return;
    if (MODES[nextIndex]?.title !== "WERWOLF" && joinPanel !== "closed") {
      if (joinTimerRef.current) clearTimeout(joinTimerRef.current);
      setJoinPanel("closed");
      setJoinCode("");
    }
    setModeLocked(true);
    setDirection(dir);
    setPrevModeIndex(modeIndex);
    setModeIndex(nextIndex);
    setSlidePhase("start");
    switchStartRef.current = setTimeout(() => setSlidePhase("go"), 20);
    switchEndRef.current = setTimeout(() => {
      setPrevModeIndex(null);
      setSlidePhase("idle");
      setModeLocked(false);
    }, 470);
  };
  const nextMode = () => switchMode((modeIndex + 1) % MODES.length, "right");
  const prevModeFn = () =>
    switchMode((modeIndex - 1 + MODES.length) % MODES.length, "left");

  const toggleJoinPanel = () => {
    if (screen !== "menu" || mode.title !== "WERWOLF") return;
    if (joinTimerRef.current) clearTimeout(joinTimerRef.current);
    if (joinPanel === "closed") {
      setJoinPanel("opening");
      joinTimerRef.current = setTimeout(() => setJoinPanel("open"), 20);
    } else if (joinPanel === "open") {
      setJoinPanel("closing");
      joinTimerRef.current = setTimeout(() => {
        setJoinPanel("closed");
        setJoinCode("");
      }, 350);
    }
  };

  const copyCode = () => {
    navigator.clipboard.writeText(lobbyCode).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  };

  const enterLobby = (
    code: string,
    lobbyPlayers: LobbyPlayer[],
    host: boolean,
    id: string,
    counts: Record<string, number>,
    started: boolean,
  ) => {
    lobbyCodeRef.current = code;
    selfIdRef.current = id;
    isHostRef.current = host;
    setSelfId(id);
    setLobbyCode(code);
    setIsHost(host);
    setPlayers(lobbyPlayers);
    setRoleCounts(counts);
    setGameStarted(started);
    setConnection("ok");
    setActionError(null);
    pollFailuresRef.current = 0;
    // Sitzung merken (übersteht ein Neuladen) und das Profilbild als bereits
    // übertragen markieren.
    saveSession(code, id);
    lastAvatarRef.current = profileRef.current?.image ?? null;
    notifyOtherTabs(code);
    setScreen("menuLeaving");
    leaveTimerRef.current = setTimeout(() => {
      setScreen("lobbyEntering");
      enterTimerRef.current = setTimeout(() => setScreen("lobby"), 20);
    }, 440);
  };

  /** Langsame Free-Instanzen: nach ein paar Sekunden einen Hinweis zeigen. */
  const withSlowHint = async <T,>(
    message: string,
    run: () => Promise<T>,
  ): Promise<T> => {
    setSlowHint(null);
    const timer = setTimeout(() => setSlowHint(message), 3_500);
    try {
      return await run();
    } finally {
      clearTimeout(timer);
      setSlowHint(null);
    }
  };

  const handleCreate = async () => {
    if (screen !== "menu" || modeLocked || busy) return;
    if (mode.title !== "WERWOLF") return;
    if (joinTimerRef.current) clearTimeout(joinTimerRef.current);
    setJoinPanel("closed");
    setJoinCode("");
    setCopied(false);
    setRoleModalOpen(false);
    setActionError(null);
    setBusy("create");
    try {
      const res = await withSlowHint(
        "Der Server startet gerade (Free-Instanz) – das dauert beim ersten Mal bis zu 30 Sekunden …",
        () =>
          withTransientRetry(() =>
            apiRequest<LobbyResponse>(
              "/api/lobby/create",
              {
                method: "POST",
                body: JSON.stringify({
                  mode: mode.title,
                  profile: profileRef.current,
                }),
              },
              35_000,
            ),
          ),
      );
      if (!res.ok || !res.data.ok) {
        throw new Error(res.ok ? "server" : res.reason);
      }
      const self = res.data.lobby.players.find((p) => p.id === res.data.selfId);
      enterLobby(
        res.data.lobby.code,
        res.data.lobby.players,
        self?.isHost ?? true,
        res.data.selfId,
        res.data.lobby.roleCounts,
        Boolean(res.data.lobby.gameStarted),
      );
    } catch (error) {
      const reason = error instanceof Error ? error.message : "server";
      setActionError(
        isTransient(reason)
          ? "Der Server ist gerade nicht erreichbar (Render-Free-Instanz wacht erst auf). Bitte warte ein paar Sekunden und versuche es noch einmal."
          : "Lobby konnte nicht erstellt werden – Server oder Datenbank nicht erreichbar. Bitte versuche es gleich noch einmal.",
      );
    } finally {
      setBusy(null);
    }
  };

  const handleJoin = async () => {
    if (screen !== "menu" || modeLocked || busy) return;
    if (joinCode.length !== 6) {
      setActionError("Bitte gib einen 6-stelligen Lobbycode ein (A–Z).");
      return;
    }
    if (joinTimerRef.current) clearTimeout(joinTimerRef.current);
    setCopied(false);
    setRoleModalOpen(false);
    setActionError(null);
    setBusy("join");
    try {
      const res = await withSlowHint(
        "Der Server startet gerade (Free-Instanz) – das dauert beim ersten Mal bis zu 30 Sekunden …",
        () =>
          withTransientRetry(() =>
            apiRequest<LobbyResponse>(
              "/api/lobby/join",
              {
                method: "POST",
                body: JSON.stringify({
                  code: joinCode,
                  profile: profileRef.current,
                }),
              },
              35_000,
            ),
          ),
      );
      if (!res.ok || !res.data.ok) {
        throw new Error(res.ok ? "server" : res.reason);
      }
      const self = res.data.lobby.players.find((p) => p.id === res.data.selfId);
      setJoinPanel("closed");
      setJoinCode("");
      enterLobby(
        res.data.lobby.code,
        res.data.lobby.players,
        self?.isHost || false,
        res.data.selfId,
        res.data.lobby.roleCounts,
        Boolean(res.data.lobby.gameStarted),
      );
    } catch (error) {
      const reason = error instanceof Error ? error.message : "server";
      setActionError(
        reason === "full"
          ? `Die Lobby ist leider voll (max. ${MAX_LOBBY_PLAYERS - 1} Spieler + Host).`
          : reason === "not_found"
            ? "Lobby mit diesem Code wurde nicht gefunden. Prüfe den Code noch einmal."
            : isTransient(reason)
              ? "Der Server ist gerade nicht erreichbar (Render-Free-Instanz wacht erst auf). Bitte warte ein paar Sekunden und versuche es noch einmal."
              : "Beitreten fehlgeschlagen – bitte versuche es erneut.",
      );
    } finally {
      setBusy(null);
    }
  };

  const handleStartGame = async (started: boolean) => {
    const code = lobbyCodeRef.current;
    const pid = selfIdRef.current;
    if (!code || !pid || busy) return;
    if (started && players.length < MIN_PLAYERS_TO_START) {
      setActionError(
        `Zum Start braucht es mindestens ${MIN_PLAYERS_TO_START} Teilnehmer (inklusive Host).`,
      );
      return;
    }
    setActionError(null);
    setBusy("start");
    try {
      const res = await apiRequest(
        "/api/lobby/start",
        {
          method: "POST",
          body: JSON.stringify({ code, playerId: pid, started }),
        },
        15_000,
      );
      if (!res.ok) throw new Error(res.reason);
      setGameStarted(started);
      notifyOtherTabs(code);
    } catch (error) {
      const reason = error instanceof Error ? error.message : "server";
      setActionError(
        started
          ? reason === "not_enough_players"
            ? `Zum Start braucht es mindestens ${MIN_PLAYERS_TO_START} Teilnehmer (inklusive Host).`
            : isTransient(reason)
            ? "Der Server antwortet gerade nicht – bitte versuche es noch einmal."
            : "Das Spiel konnte nicht gestartet werden. Bitte versuche es erneut."
          : "Das Spiel konnte nicht zurückgesetzt werden.",
      );
    } finally {
      setBusy(null);
    }
  };

  /** Lobby bewusst verlassen (Button) – ganz normal zurück ins Menü. */
  const handleLeaveLobby = () => {
    const code = lobbyCodeRef.current;
    const pid = selfIdRef.current;
    clearSession();
    if (enterTimerRef.current) clearTimeout(enterTimerRef.current);
    if (leaveTimerRef.current) clearTimeout(leaveTimerRef.current);
    enterTimerRef.current = null;
    leaveTimerRef.current = null;
    lobbyCodeRef.current = "";
    selfIdRef.current = null;
    setScreen("menu");
    setSelfId(null);
    setLobbyCode("");
    setPlayers([]);
    setIsHost(false);
    setGameStarted(false);
    setRoleCounts(defaultCounts);
    setRoleModalOpen(false);
    setRoleDetail(null);
    setCopied(false);
    setActionError(null);
    setConnection("ok");
    pollFailuresRef.current = 0;
    lastAvatarRef.current = null;
    if (code && pid) {
      void apiRequest("/api/lobby/leave", {
        method: "POST",
        body: JSON.stringify({ code, playerId: pid }),
      }).finally(() => {
        notifyOtherTabs(code);
      });
    }
  };

  const changeRoleCount = async (roleName: string, delta: number) => {
    if (!isHost) return;
    const next = {
      ...roleCounts,
      [roleName]: Math.max(0, (roleCounts[roleName] ?? 0) + delta),
    };
    setRoleCounts(next);
    const code = lobbyCodeRef.current;
    const pid = selfIdRef.current;
    if (!code || !pid) return;
    let res = await apiRequest(
      "/api/lobby/roles",
      { method: "POST", body: JSON.stringify({ code, playerId: pid, roleCounts: next }) },
      12_000,
    );
    if (!res.ok && isTransient(res.reason)) {
      // Einmal nachfassen – kurze Hänger der Free-Instanz sind normal.
      res = await apiRequest(
        "/api/lobby/roles",
        { method: "POST", body: JSON.stringify({ code, playerId: pid, roleCounts: next }) },
        12_000,
      );
    }
    if (res.ok) notifyOtherTabs(code);
  };

  // --- animation helpers -------------------------------------------------
  const outgoingStyle = (): React.CSSProperties =>
    slidePhase === "start"
      ? { transform: "translateX(0)", opacity: 1, transition: "none" }
      : slidePhase === "go"
        ? {
            transform: `translateX(${direction === "right" ? "-115%" : "115%"})`,
            opacity: 0,
            transition:
              "transform 420ms cubic-bezier(0.4,0,0.2,1), opacity 420ms ease",
          }
        : { transform: "translateX(0)", opacity: 1 };

  const incomingStyle = (): React.CSSProperties =>
    slidePhase === "start"
      ? {
          transform: `translateX(${direction === "right" ? "115%" : "-115%"})`,
          opacity: 0,
          transition: "none",
        }
      : slidePhase === "go"
        ? {
            transform: "translateX(0)",
            opacity: 1,
            transition:
              "transform 420ms cubic-bezier(0.22,1,0.36,1), opacity 420ms ease",
          }
        : { transform: "translateX(0)", opacity: 1 };

  const joinPanelStyle = (): React.CSSProperties =>
    joinPanel === "opening"
      ? { transform: "translateX(-100vw)", opacity: 0, transition: "none" }
      : joinPanel === "closing"
        ? {
            transform: "translateX(-100vw)",
            opacity: 0,
            transition:
              "transform 350ms cubic-bezier(0.4,0,0.2,1), opacity 350ms ease",
          }
        : joinPanel === "open"
          ? {
              transform: "translateX(0)",
              opacity: 1,
              transition:
                "transform 350ms cubic-bezier(0.22,1,0.36,1), opacity 350ms ease",
            }
          : {};

  const leftExitStyle = (): React.CSSProperties =>
    screen === "menuLeaving"
      ? {
          transform: "translateX(-110vw)",
          opacity: 0,
          transition:
            "transform 440ms cubic-bezier(0.4,0,0.2,1), opacity 300ms ease",
        }
      : { transform: "translateX(0)", opacity: 1 };

  const rightExitStyle = (): React.CSSProperties =>
    screen === "menuLeaving"
      ? {
          transform: "translateX(110vw)",
          opacity: 0,
          transition:
            "transform 440ms cubic-bezier(0.4,0,0.2,1), opacity 300ms ease",
        }
      : { transform: "translateX(0)", opacity: 1 };

  const lobbyEnterStyle = (): React.CSSProperties =>
    screen === "lobbyEntering"
      ? { transform: "translateY(110%)", opacity: 0, transition: "none" }
      : screen === "lobby"
        ? {
            transform: "translateY(0)",
            opacity: 1,
            transition:
              "transform 520ms cubic-bezier(0.22,1,0.36,1), opacity 520ms ease",
          }
        : {};

  const menuButtons =
    "w-fit text-left text-[1.75rem] font-bold uppercase transition-all duration-200 hover:translate-x-3 hover:text-neutral-400 sm:text-[2.1rem]";

  const detailRole: Role | null = roleDetail
    ? (ROLES.find((r) => r.name === roleDetail) ?? null)
    : null;

  return (
    <div
      className={`relative min-h-screen w-full overflow-hidden transition-colors duration-700 ${
        isDark ? "bg-[#0b1220] text-white" : "bg-white text-black"
      }`}
    >
      <SkyBackground isActive={isDark} />

      {actionError && (
        <div
          className="fixed inset-x-0 bottom-4 z-[60] flex justify-center px-4"
          role="alert"
        >
          <div className="flex max-w-[min(36rem,92vw)] items-start gap-3 rounded-[1.2rem] border border-red-400/40 bg-red-950/90 px-4 py-3 text-sm font-semibold text-red-100 shadow-2xl backdrop-blur-md">
            <span className="leading-relaxed">{actionError}</span>
            <button
              onClick={() => setActionError(null)}
              aria-label="Fehlermeldung schließen"
              className="mt-0.5 shrink-0 text-red-200/70 transition-colors hover:text-red-100"
            >
              <X size={16} />
            </button>
          </div>
        </div>
      )}

      {slowHint && (
        <div
          className="fixed inset-x-0 bottom-4 z-[60] flex justify-center px-4"
          role="status"
        >
          <div className="flex max-w-[min(36rem,92vw)] items-center gap-3 rounded-[1.2rem] border border-sky-400/40 bg-sky-950/90 px-4 py-3 text-sm font-semibold text-sky-100 shadow-2xl backdrop-blur-md">
            <span className="h-3 w-3 shrink-0 animate-pulse rounded-full bg-sky-300" />
            <span className="leading-relaxed">{slowHint}</span>
          </div>
        </div>
      )}

      {inMenu && (
        <>
          <div
            className="relative z-10 flex min-h-screen flex-col px-4 py-3 sm:px-6 sm:py-4 md:px-8 md:py-5"
            style={leftExitStyle()}
          >
            <div className="relative flex flex-col pt-0.5">
              <p className="text-[1.4rem] font-black uppercase tracking-wide sm:text-[1.6rem]">
                SPIELMODUS {modeIndex + 1}/{MODES.length}
              </p>
              <div className="relative mt-0.5 min-h-[14rem] -translate-y-2 overflow-hidden sm:min-h-[16rem] md:min-h-[18rem]">
                {prevMode && slidePhase !== "idle" && (
                  <div className="absolute inset-0" style={outgoingStyle()}>
                    <h1 className="overflow-visible whitespace-nowrap pt-1 text-[clamp(4rem,8vw,8rem)] font-black uppercase leading-none tracking-tight">
                      {prevMode.title}
                    </h1>
                    <div
                      className={`mt-2 h-[4px] w-full max-w-[57rem] bg-gradient-to-r to-transparent ${
                        isDark ? "from-white" : "from-black"
                      }`}
                    />
                    <p className="mt-3 w-[66vw] text-base font-semibold sm:text-lg">
                      {prevMode.description}
                    </p>
                  </div>
                )}
                <div
                  className={slidePhase !== "idle" ? "absolute inset-0" : ""}
                  style={slidePhase !== "idle" ? incomingStyle() : {}}
                >
                  <h1 className="overflow-visible whitespace-nowrap pt-1 text-[clamp(4rem,8vw,8rem)] font-black uppercase leading-none tracking-tight">
                    {mode.title}
                  </h1>
                  <div
                    className={`mt-2 h-[4px] w-full max-w-[57rem] bg-gradient-to-r to-transparent ${
                      isDark ? "from-white" : "from-black"
                    }`}
                  />
                  <p className="mt-3 w-[66vw] text-base font-semibold sm:text-lg">
                    {mode.description}
                  </p>
                </div>
              </div>
            </div>
            <div className="mt-auto mb-4 flex flex-col gap-2">
              <button onClick={() => setCardModalOpen(true)} className={menuButtons}>
                Spielerkarte
              </button>
              <button className={menuButtons}>Statistiken</button>
              <button className={menuButtons}>Einstellungen</button>
            </div>
          </div>

          <button
            onClick={prevModeFn}
            className="absolute left-1 top-[42%] z-20 -translate-y-1/2 p-3 transition-all duration-200 hover:-translate-x-1 hover:scale-110 hover:text-neutral-400 sm:left-2 md:left-3"
            aria-label="Vorheriger Gamemode"
            style={leftExitStyle()}
          >
            <ChevronLeft size={72} strokeWidth={1.5} />
          </button>
          <button
            onClick={nextMode}
            className="absolute right-1 top-[42%] z-20 -translate-y-1/2 p-3 transition-all duration-200 hover:translate-x-1 hover:scale-110 hover:text-neutral-400 sm:right-2 md:right-3"
            aria-label="Nächster Gamemode"
            style={rightExitStyle()}
          >
            <ChevronRight size={72} strokeWidth={1.5} />
          </button>

          <div
            className="absolute left-4 top-[calc(42%+120px)] z-20 flex flex-col gap-3 sm:left-6 md:left-8"
            style={leftExitStyle()}
          >
            <button
              onClick={handleCreate}
              disabled={busy === "create"}
              className={`w-fit text-left text-[1.75rem] font-bold uppercase transition-all duration-200 sm:text-[2.1rem] ${
                mode.title === "WERWOLF"
                  ? "hover:translate-x-3 hover:text-neutral-400"
                  : "cursor-not-allowed opacity-30"
              } ${busy === "create" ? "animate-pulse opacity-70" : ""}`}
            >
              {mode.title === "WERWOLF"
                ? busy === "create"
                  ? "Erstelle Lobby…"
                  : "Lobby erstellen"
                : "@!=$!)"}
            </button>
            <div className="flex w-fit flex-col">
              <button
                onClick={toggleJoinPanel}
                className={`w-fit text-left text-[1.75rem] font-bold uppercase transition-all duration-200 sm:text-[2.1rem] ${
                  mode.title === "WERWOLF"
                    ? "hover:translate-x-3 hover:text-neutral-400"
                    : "cursor-not-allowed opacity-30"
                }`}
              >
                {mode.title === "WERWOLF" ? "Lobby beitreten" : "@!=$!)"}
              </button>
              {joinPanel !== "closed" && (
                <div
                  className="mt-4 flex items-end justify-between border-b-2 border-current pb-1"
                  style={joinPanelStyle()}
                >
                  <input
                    type="text"
                    value={joinCode}
                    onChange={(e) =>
                      setJoinCode(
                        e.target.value
                          .toUpperCase()
                          .replace(/[^A-Z]/g, "")
                          .slice(0, 6),
                      )
                    }
                    onKeyDown={(e) => {
                      if (e.key === "Enter") handleJoin();
                    }}
                    placeholder="LOBBY-CODE"
                    maxLength={6}
                    className="w-full bg-transparent text-[1.4rem] font-medium tracking-widest outline-none placeholder:text-neutral-400 sm:text-[1.6rem]"
                    autoFocus
                  />
                  <button
                    onClick={handleJoin}
                    disabled={busy === "join"}
                    className="ml-4 shrink-0 text-[1.4rem] font-bold uppercase transition-all hover:text-neutral-400 disabled:animate-pulse disabled:opacity-60 sm:text-[1.6rem]"
                  >
                    {busy === "join" ? "Trete bei…" : "Beitreten"}
                  </button>
                </div>
              )}
            </div>
          </div>

          {cardModalOpen && (
            <div
              className="absolute inset-0 z-50 flex items-center justify-center bg-[#030712]/85 px-4 py-6 backdrop-blur-lg"
              onClick={() => setCardModalOpen(false)}
            >
              <div
                className="flex w-full max-w-[95vw] items-center justify-center gap-8"
                onClick={(e) => e.stopPropagation()}
              >
                <div
                  className="custom-scroll flex max-h-[85vh] shrink-0 flex-col overflow-y-auto rounded-[2rem] border border-white/10 bg-[#0c1525] p-6 shadow-[0_18px_80px_rgba(0,0,0,0.6)] sm:p-8"
                  style={{ width: "780px" }}
                >
                  <div className="flex shrink-0 items-center justify-between gap-4 border-b border-white/10 pb-3">
                    <div>
                      <p className="text-[0.65rem] font-black uppercase tracking-[0.3em] text-white/45">
                        Profil anpassen
                      </p>
                      <h2 className="mt-1 text-[1.5rem] font-black uppercase text-white">
                        Spielerkarte
                      </h2>
                    </div>
                    <button
                      onClick={() => setCardModalOpen(false)}
                      className="group flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-white/10 text-white/50 transition-all duration-200 hover:border-white/30 hover:bg-white/10 hover:text-white"
                    >
                      <X
                        size={20}
                        className="transition-transform duration-200 group-hover:rotate-90"
                      />
                    </button>
                  </div>
                  <div className="mt-5 flex flex-col gap-5">
                    <div>
                      <div className="mb-1.5 flex items-center justify-between">
                        <label className="block text-xs font-black uppercase tracking-[0.2em] text-white/60">
                          User:
                        </label>
                        {nameWarn && (
                          <span className="animate-pulse text-[0.65rem] font-bold uppercase tracking-wider text-red-400">
                            (Max. Zeichen erreicht)
                          </span>
                        )}
                      </div>
                      <input
                        type="text"
                        maxLength={12}
                        value={name}
                        onKeyDown={(e) => {
                          if (
                            e.key === "Backspace" ||
                            e.key === "Delete" ||
                            e.key.includes("Arrow")
                          )
                            return;
                          if (name.length >= 12 && e.key.length === 1) {
                            setNameWarn(true);
                            setTimeout(() => setNameWarn(false), 2000);
                          }
                        }}
                        onChange={(e) =>
                          setName(e.target.value.replace(/[^a-zA-Z0-9 ]/g, ""))
                        }
                        className="w-full rounded-[0.9rem] border border-white/20 bg-white/5 px-3 py-2.5 text-base font-bold text-white outline-none transition-all focus:border-white/40 focus:bg-white/10"
                        placeholder="Dein Name"
                      />
                    </div>
                    <div>
                      <label className="mb-1.5 block text-xs font-black uppercase tracking-[0.2em] text-white/60">
                        Farbe:
                      </label>
                      <div className="grid grid-cols-[8.5rem_1fr] gap-4 rounded-[1rem] border border-white/10 bg-white/[0.03] p-3.5">
                        <div className="flex flex-col justify-center gap-2">
                          <div className="flex items-center gap-3">
                            <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-full border-2 border-white/20">
                              <input
                                type="color"
                                value={color}
                                onChange={(e) => setColor(e.target.value)}
                                className="absolute -inset-2 h-[150%] w-[150%] cursor-pointer border-none bg-transparent"
                              />
                            </div>
                            <span className="font-mono text-[0.72rem] font-bold text-white/45">
                              {color.toUpperCase()}
                            </span>
                          </div>
                        </div>
                        <div className="flex flex-col justify-center gap-1.5">
                          <div className="flex items-center justify-between text-[0.68rem] font-black uppercase tracking-[0.18em] text-white/55">
                            <span>Intensität</span>
                            <span className="text-white/85">{fadeIntensity}%</span>
                          </div>
                          <input
                            type="range"
                            min="0"
                            max="100"
                            value={fadeIntensity}
                            onChange={(e) => setFadeIntensity(Number(e.target.value))}
                            className="card-slider"
                          />
                        </div>
                      </div>
                    </div>
                    <div>
                      <label className="mb-1.5 block text-xs font-black uppercase tracking-[0.2em] text-white/60">
                        Profilbild:
                      </label>
                      <input
                        type="file"
                        ref={fileInputRef}
                        onChange={handleImageUpload}
                        className="hidden"
                        accept="image/*"
                      />
                      <div className="flex items-center gap-3">
                        <button
                          onClick={() => fileInputRef.current?.click()}
                          className="rounded-[0.9rem] border border-white/20 bg-white/5 px-4 py-2.5 text-xs font-bold uppercase tracking-[0.1em] text-white transition-all hover:bg-white/10"
                        >
                          Bild hochladen
                        </button>
                        {image && (
                          <button
                            onClick={() => setImage(null)}
                            className="flex h-10 w-10 items-center justify-center rounded-[0.9rem] border border-red-500/30 bg-red-500/10 text-red-400 transition-all hover:border-red-500/50 hover:bg-red-500/20"
                          >
                            <Trash2 size={16} />
                          </button>
                        )}
                      </div>
                    </div>
                    <div>
                      <label className="mb-1.5 block text-xs font-black uppercase tracking-[0.2em] text-white/60">
                        Spielerrahmen wählen
                      </label>
                      <div className="grid grid-cols-2 gap-4">
                        {FRAME_OPTIONS.map((option) => (
                          <button
                            key={option.id}
                            onClick={() => setFrame(option.id)}
                            className={`flex flex-col items-center justify-center overflow-hidden rounded-[1.4rem] border transition-all ${
                              frame === option.id
                                ? "border-white/60 bg-white/15 ring-1 ring-white/30"
                                : "border-white/15 bg-white/5 hover:border-white/30 hover:bg-white/10"
                            }`}
                            style={{ width: "351.5px", height: "200.3px" }}
                          >
                            {option.id !== "none" && !failedFrames[option.id] ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img
                                src={`/frames/${option.id}.png`}
                                alt={option.name}
                                className="h-full w-full object-contain p-2 opacity-70"
                                onError={() =>
                                  setFailedFrames((prev) => ({
                                    ...prev,
                                    [option.id]: true,
                                  }))
                                }
                              />
                            ) : null}
                            <span
                              className={`text-[0.65rem] font-bold uppercase tracking-[0.12em] ${
                                option.id !== "none" && !failedFrames[option.id]
                                  ? "hidden"
                                  : ""
                              } ${frame === option.id ? "text-white" : "text-white/40"}`}
                            >
                              {option.name}
                            </span>
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
                <div className="hidden shrink-0 items-center justify-center md:flex">
                  <div
                    className={`relative flex flex-col items-center justify-center overflow-hidden rounded-[2rem] border-2 bg-[#172033] text-center transition-all duration-150 ${
                      isSpeaking
                        ? "border-[#4ade80] shadow-[0_0_24px_rgba(34,197,94,0.95),0_0_56px_rgba(34,197,94,0.55),inset_0_0_24px_rgba(34,197,94,0.4)] ring-2 ring-[#4ade80]"
                        : "border-white/15"
                    }`}
                    style={{ width: "703px", height: "400.6px" }}
                  >
                    {color !== DEFAULT_COLOR && (
                      <div
                        className="pointer-events-none absolute inset-0"
                        style={{ background: colorWash(color, fadeIntensity, 70) }}
                      />
                    )}
                    <div className="relative z-10 flex h-40 w-40 items-center justify-center overflow-hidden rounded-full text-5xl font-black uppercase text-white drop-shadow-lg">
                      {image ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={image}
                          alt="Profile"
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center bg-white/10">
                          {name.slice(0, 1) || "?"}
                        </div>
                      )}
                    </div>
                    <p className="relative z-10 mt-8 break-all text-center text-[3rem] font-black uppercase leading-none text-white drop-shadow-lg">
                      {name || "NAME"}
                    </p>
                    <p className="relative z-10 mt-3 text-sm font-bold uppercase tracking-[0.4em] text-white">
                      Punkte: 0
                    </p>
                    {frame === "frame1" && <WalkingCat cardWidth={703} />}
                  </div>
                </div>
              </div>
            </div>
          )}
        </>
      )}

      {inLobby && gameView === "game" && (
        <GameTable
          players={tablePlayers}
          speakingId={isSpeaking ? selfId : null}
          isHost={isHost}
          busy={busy === "start"}
          onBackToLobby={() => handleStartGame(false)}
          onLeave={handleLeaveLobby}
        />
      )}

      {inLobby && gameView === "lobby" && (
        <div
          className="absolute inset-0 z-20 px-4 py-4 text-white sm:px-6 sm:py-6 md:px-8 md:py-8"
          style={lobbyEnterStyle()}
        >
          <div className="custom-scroll mx-auto h-full w-full max-w-[96rem] overflow-y-auto">
            <div className="grid min-h-full grid-cols-1 gap-4 xl:h-full xl:min-h-0 xl:grid-cols-[minmax(0,2.4fr)_minmax(22rem,1fr)]">
              <div className="flex min-h-0 flex-col gap-4">
                <GlassCard className="grid shrink-0 gap-4 px-5 py-5 sm:grid-cols-[minmax(0,1fr)_auto] sm:px-6 sm:py-6">
                  <div className="min-w-0">
                    <p className="text-sm font-black uppercase tracking-[0.32em] text-white/50">
                      Lobbycode
                    </p>
                    <p className="mt-3 font-mono text-[clamp(2.3rem,6vw,4.8rem)] font-black uppercase tracking-[0.28em] text-white">
                      {lobbyCode}
                    </p>
                    <div className="mt-4 flex flex-wrap items-center gap-3">
                      <span
                        className={`flex items-center gap-2 rounded-full border px-3 py-1.5 text-[0.68rem] font-bold uppercase tracking-[0.18em] ${
                          connection === "ok"
                            ? "border-emerald-400/40 bg-emerald-400/10 text-emerald-200"
                            : "border-amber-400/50 bg-amber-400/15 text-amber-100"
                        }`}
                        title={
                          connection === "ok"
                            ? "Lobby wird live synchronisiert"
                            : "Kurzer Hänger – die Verbindung wird automatisch wiederhergestellt"
                        }
                      >
                        <span
                          className={`h-2 w-2 rounded-full ${
                            connection === "ok"
                              ? "bg-emerald-400"
                              : "animate-pulse bg-amber-300"
                          }`}
                        />
                        {connection === "ok"
                          ? "Live verbunden"
                          : "Verbindung wird wiederhergestellt …"}
                      </span>
                    </div>
                  </div>
                  <div className="flex flex-col gap-2 self-start">
                    <button
                      onClick={copyCode}
                      className="flex items-center justify-center gap-2 rounded-[1rem] border border-white/30 bg-white/10 px-3 py-2 text-sm font-bold uppercase tracking-wide text-white backdrop-blur-sm transition-all duration-200 hover:-translate-y-0.5 hover:bg-white/20 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white/70"
                    >
                      {copied ? <Check size={18} /> : <Copy size={18} />}
                      {copied ? "Kopiert" : "Kopieren"}
                    </button>
                    <button
                      onClick={handleLeaveLobby}
                      className="flex items-center justify-center gap-2 rounded-[1rem] border border-white/25 bg-white/5 px-3 py-2 text-sm font-bold uppercase tracking-wide text-white/70 transition-all duration-200 hover:border-red-400/50 hover:bg-red-500/15 hover:text-red-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white/70"
                    >
                      <LogOut size={18} />
                      Lobby verlassen
                    </button>
                  </div>
                </GlassCard>
                <GlassCard className="flex min-h-0 flex-1 flex-col p-3 sm:p-4">
                  <div className="custom-scroll grid auto-rows-[minmax(11rem,1fr)] grid-cols-1 gap-3 overflow-y-auto p-2 md:grid-cols-2 2xl:grid-cols-3">
                    {players.map((player) => {
                      const isSelf = player.id === selfId;
                      const displayName =
                        isSelf ? name || "NAME" : player.name;
                      const displayColor = isSelf ? color : player.color;
                      const displayIntensity =
                        isSelf ? fadeIntensity : player.fadeIntensity;
                      const displayImage = isSelf ? image : player.image;
                      const displayFrame = isSelf ? frame : player.frame;
                      const playerSpeaking = isSelf && isSpeaking;
                      return (
                        <div
                          key={player.id || player.name}
                          className={`relative flex min-h-[11rem] flex-col items-center justify-center overflow-hidden rounded-[1.4rem] border-2 bg-[#172033] px-4 py-5 text-center transition-all duration-150 ${
                            playerSpeaking
                              ? "border-[#4ade80] shadow-[0_0_20px_rgba(34,197,94,0.95),0_0_44px_rgba(34,197,94,0.55),inset_0_0_20px_rgba(34,197,94,0.4)] ring-2 ring-[#4ade80]"
                              : "border-white/15"
                          }`}
                        >
                          {displayColor && displayColor !== DEFAULT_COLOR && (
                            <div
                              className="pointer-events-none absolute inset-0"
                              style={{
                                background: colorWash(
                                  displayColor,
                                  displayIntensity ?? 50,
                                  70,
                                ),
                              }}
                            />
                          )}
                          <div className="relative z-10 flex h-20 w-20 items-center justify-center overflow-hidden rounded-full text-xl font-black uppercase text-white drop-shadow-md">
                            {displayImage ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img
                                src={displayImage}
                                alt="Profile"
                                className="h-full w-full object-cover"
                              />
                            ) : (
                              <div className="flex h-full w-full items-center justify-center bg-white/10">
                                {displayName.slice(0, 1) || "?"}
                              </div>
                            )}
                          </div>
                          {displayFrame === "frame1" && (
                            <WalkingCat cardWidth={280} />
                          )}
                          <p className="relative z-10 mt-4 break-all text-[1.6rem] font-black uppercase leading-none text-white drop-shadow-md sm:text-[1.9rem]">
                            {displayName}
                          </p>
                          <p className="relative z-10 mt-2 text-xs font-bold uppercase tracking-[0.3em] text-white/50">
                            {player.isHost ? "Host" : "Player"}
                          </p>
                        </div>
                      );
                    })}
                    <div className="min-h-[11rem] rounded-[1.4rem] border border-dashed border-white/20" />
                    <div className="hidden min-h-[11rem] rounded-[1.4rem] border border-dashed border-white/20 md:block" />
                    <div className="hidden min-h-[11rem] rounded-[1.4rem] border border-dashed border-white/20 2xl:block" />
                  </div>
                </GlassCard>
              </div>
              <aside className="flex min-h-0 flex-col gap-4">
                <GlassCard className="flex min-h-0 flex-col p-4 xl:flex-[3]">
                  <p className="shrink-0 text-xs font-black uppercase tracking-[0.28em] text-white/50">
                    Rollen für diese Runde
                  </p>
                  <div className="custom-scroll mt-4 max-h-80 space-y-2 overflow-y-auto pr-1 xl:max-h-none xl:flex-1">
                    {selectedRoles.length > 0 ? (
                      selectedRoles.map((role) => (
                        <button
                          key={role.name}
                          onClick={() => setRoleDetail(role.name)}
                          className="flex w-full items-center justify-between rounded-[1rem] border border-white/15 bg-white/5 px-3 py-2 text-left transition-all duration-150 hover:border-white/30 hover:bg-white/10"
                        >
                          <div className="flex items-center gap-3">
                            <div className="flex h-9 w-9 shrink-0 items-center justify-center text-[0.8rem] text-white/70">
                              <RoleIcon name={role.name} short={role.short} />
                            </div>
                            <span className="text-[1.05rem] font-bold uppercase text-white">
                              {role.name}
                            </span>
                          </div>
                          <span className="text-[1.1rem] font-black text-white">
                            {roleCounts[role.name]}
                          </span>
                        </button>
                      ))
                    ) : (
                      <div className="rounded-[1rem] border border-dashed border-white/20 bg-white/5 px-3 py-4 text-sm font-semibold text-white/45">
                        Keine Rollen ausgewählt.
                      </div>
                    )}
                  </div>
                  {isHost && (
                    <button
                      onClick={() => setRoleModalOpen(true)}
                      className="mt-4 rounded-[1rem] border border-white/30 bg-white/10 px-4 py-3 text-sm font-black uppercase tracking-[0.18em] text-white transition-all duration-200 hover:bg-white/20"
                    >
                      Rollen auswählen
                    </button>
                  )}
                </GlassCard>
                <GlassCard className="min-h-[10rem] p-5 xl:flex-[2]">
                  <p className="text-xs font-black uppercase tracking-[0.28em] text-white/50">
                    Sonstige Regeln
                  </p>
                  <p className="mt-3 text-sm font-semibold text-white/30">
                    Keine besonderen Regeln festgelegt.
                  </p>
                </GlassCard>
                {isHost ? (
                  gameStarted ? (
                    <div className="flex flex-col gap-2">
                      <div className="rounded-[1.5rem] border border-green-400/40 bg-green-400/15 px-5 py-4 text-center text-[1.25rem] font-black uppercase tracking-[0.16em] text-green-200">
                        Spiel läuft
                      </div>
                      <button
                        onClick={() => handleStartGame(false)}
                        disabled={busy === "start"}
                        className="rounded-[1rem] border border-white/20 bg-white/5 px-4 py-2 text-xs font-bold uppercase tracking-[0.18em] text-white/60 transition-all duration-200 hover:bg-white/10 hover:text-white disabled:animate-pulse disabled:opacity-50"
                      >
                        Zurück zur Lobby
                      </button>
                    </div>
                  ) : (
                    <div className="flex flex-col gap-2">
                      <button
                        onClick={() => handleStartGame(true)}
                        disabled={busy === "start" || !canStartGame}
                        className={`rounded-[1.5rem] border border-white/30 bg-white/15 px-5 py-4 text-[1.25rem] font-black uppercase tracking-[0.16em] text-white backdrop-blur-sm transition-all duration-200 hover:-translate-y-1 hover:bg-white hover:text-black disabled:cursor-not-allowed disabled:hover:translate-y-0 disabled:hover:bg-white/15 disabled:hover:text-white ${
                          busy === "start" ? "animate-pulse" : ""
                        } ${canStartGame ? "" : "opacity-40"}`}
                      >
                        {busy === "start" ? "Startet…" : "Spiel starten"}
                      </button>
                      {!canStartGame && (
                        <p className="text-center text-xs font-bold uppercase tracking-[0.14em] text-white/50">
                          Mindestens {MIN_PLAYERS_TO_START} Teilnehmer nötig ({players.length}/
                          {MIN_PLAYERS_TO_START})
                        </p>
                      )}
                    </div>
                  )
                ) : (
                  <div
                    className={`rounded-[1.5rem] border px-5 py-4 text-center text-sm font-bold uppercase tracking-[0.16em] ${
                      gameStarted
                        ? "border-green-400/40 bg-green-400/15 text-green-200"
                        : "border-white/10 bg-white/5 text-white/40"
                    }`}
                  >
                    {gameStarted ? "Das Spiel läuft!" : "Warte auf Host…"}
                  </div>
                )}
              </aside>
            </div>
          </div>

          {detailRole &&
            (() => {
              const teamLabel =
                detailRole.team === "gut"
                  ? "Gut"
                  : detailRole.team === "böse"
                    ? "Böse"
                    : "Neutral";
              const teamText =
                detailRole.team === "gut"
                  ? "text-green-400"
                  : detailRole.team === "böse"
                    ? "text-red-400"
                    : "text-[#8ba4d4]";
              const teamBox =
                detailRole.team === "gut"
                  ? "border-green-400/40 bg-green-400/10"
                  : detailRole.team === "böse"
                    ? "border-red-400/40 bg-red-400/10"
                    : "border-[#6382be]/40 bg-[#6382be]/10";
              return (
                <div
                  className="absolute inset-0 z-50 flex items-center justify-center bg-[#030712]/80 px-4 py-6 backdrop-blur-md"
                  onClick={() => setRoleDetail(null)}
                >
                  <div
                    className="w-full max-w-[44rem] rounded-[2rem] border border-white/15 bg-[#0c1525]/95 p-6 shadow-[0_18px_80px_rgba(0,0,0,0.6)] backdrop-blur-2xl sm:p-8"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <div className="flex items-start gap-5">
                      <div
                        className={`flex h-28 w-28 shrink-0 items-center justify-center rounded-[1.2rem] border p-2 text-2xl text-white/70 ${teamBox}`}
                      >
                        <RoleIcon name={detailRole.name} short={detailRole.short} />
                      </div>
                      <div className="flex flex-col justify-center">
                        <h2 className="text-[2.2rem] font-black uppercase leading-none text-white sm:text-[2.8rem]">
                          {detailRole.name}
                        </h2>
                        <p className="mt-2.5 text-sm font-bold uppercase tracking-[0.2em]">
                          <span className="text-white/40">Team: </span>
                          <span className={teamText}>{teamLabel}</span>
                        </p>
                      </div>
                    </div>
                    <div className="my-6 h-[1px] w-full bg-gradient-to-r from-transparent via-white/20 to-transparent" />
                    <div>
                      <p className="text-xs font-black uppercase tracking-[0.28em] text-white/40">
                        Beschreibung
                      </p>
                      <p className="mt-3 text-[1rem] font-medium leading-7 text-white/75">
                        {detailRole.description}
                      </p>
                    </div>
                    <div className="my-6 h-[1px] w-full bg-gradient-to-r from-transparent via-white/20 to-transparent" />
                    <div>
                      <p className="text-xs font-black uppercase tracking-[0.28em] text-white/40">
                        Gewinnkondition
                      </p>
                      <p className="mt-3 text-[1rem] font-medium leading-7 text-white/50">
                        {winCondition(detailRole)}
                      </p>
                    </div>
                    <button
                      onClick={() => setRoleDetail(null)}
                      className="mt-8 w-full rounded-[1.2rem] border border-white/20 bg-white/10 py-3 text-sm font-black uppercase tracking-[0.2em] text-white transition-all duration-200 hover:bg-white/20"
                    >
                      Schließen
                    </button>
                  </div>
                </div>
              );
            })()}

          {roleModalOpen && (
            <div
              className="absolute inset-0 z-40 flex items-center justify-center bg-[#030712]/85 px-4 py-6 backdrop-blur-lg"
              onClick={() => setRoleModalOpen(false)}
            >
              <div
                className="flex h-[min(90vh,58rem)] w-full max-w-[84rem] flex-col rounded-[2rem] p-2 sm:p-4"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="flex shrink-0 items-center justify-between gap-4 pb-4">
                  <div>
                    <p className="text-xs font-black uppercase tracking-[0.3em] text-white/45">
                      Rollen auswählen
                    </p>
                    <h2 className="mt-2 text-[1.8rem] font-black uppercase text-white sm:text-[2.2rem]">
                      Rollen-Konfiguration
                    </h2>
                  </div>
                  <button
                    onClick={() => setRoleModalOpen(false)}
                    className="group flex h-12 w-12 shrink-0 items-center justify-center rounded-full border border-white/10 bg-transparent text-white/50 transition-all duration-200 hover:border-white/30 hover:bg-white/10 hover:text-white"
                    aria-label="Popup schließen"
                  >
                    <X
                      size={22}
                      className="transition-transform duration-200 group-hover:rotate-90"
                    />
                  </button>
                </div>
                <div className="custom-scroll mt-4 min-h-0 flex-1 overflow-y-auto pr-1">
                  {(["gut", "böse", "neutral"] as const).map((team, teamIdx) => {
                    const teamRoles = ROLES.filter((r) => r.team === team);
                    const sectionLabel =
                      team === "gut"
                        ? "Gute Rollen"
                        : team === "böse"
                          ? "Böse Rollen"
                          : "Neutrale Rollen";
                    const accentColor =
                      team === "gut"
                        ? "rgba(34,197,94,0.7)"
                        : team === "böse"
                          ? "rgba(239,68,68,0.7)"
                          : "rgba(99,130,190,0.7)";
                    const cardClasses =
                      team === "gut"
                        ? "border-green-400/30 bg-green-400/[0.09]"
                        : team === "böse"
                          ? "border-red-400/30 bg-red-400/[0.09]"
                          : "border-[#6382be]/30 bg-[#6382be]/[0.09]";
                    const iconClasses =
                      team === "gut"
                        ? "border-green-400/40 bg-green-400/10"
                        : team === "böse"
                          ? "border-red-400/40 bg-red-400/10"
                          : "border-[#6382be]/40 bg-[#6382be]/10";
                    return (
                      <div key={team} className={teamIdx > 0 ? "mt-5" : ""}>
                        <div className="mb-3 flex items-center gap-0">
                          <div
                            className="h-[1.5px] flex-1"
                            style={{
                              background: `linear-gradient(to right, transparent, ${accentColor} 40%, ${accentColor} 60%, transparent)`,
                            }}
                          />
                          <span
                            className="mx-3 shrink-0 text-[0.7rem] font-black uppercase tracking-[0.25em]"
                            style={{ color: accentColor }}
                          >
                            {sectionLabel}
                          </span>
                          <div
                            className="h-[1.5px] flex-1"
                            style={{
                              background: `linear-gradient(to left, transparent, ${accentColor} 40%, ${accentColor} 60%, transparent)`,
                            }}
                          />
                        </div>
                        <div className="grid grid-cols-1 gap-x-3 gap-y-2 sm:grid-cols-2 xl:grid-cols-3">
                          {teamRoles.map((role) => (
                            <div
                              key={role.name}
                              className={`group relative z-0 flex h-[5.4rem] items-center gap-4 rounded-[1.2rem] border px-4 backdrop-blur-sm hover:z-50 ${cardClasses}`}
                            >
                              <div
                                className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-[0.9rem] border p-2 text-base text-white/70 ${iconClasses}`}
                              >
                                <RoleIcon name={role.name} short={role.short} />
                              </div>
                              <div className="flex min-w-0 flex-1 flex-col items-center justify-center">
                                <span className="text-[1.12rem] font-black uppercase leading-none text-white">
                                  {role.name}
                                </span>
                                <div className="mt-1.5 flex items-center gap-3">
                                  <button
                                    onClick={() => changeRoleCount(role.name, 1)}
                                    className="text-white/60 transition-all hover:text-white"
                                  >
                                    <Plus size={18} />
                                  </button>
                                  <span className="min-w-[1.6rem] text-center text-[1.12rem] font-black text-white">
                                    {roleCounts[role.name] ?? 0}
                                  </span>
                                  <button
                                    onClick={() => changeRoleCount(role.name, -1)}
                                    disabled={(roleCounts[role.name] ?? 0) === 0}
                                    className="text-white/60 transition-all hover:text-white disabled:opacity-20"
                                  >
                                    <Minus size={18} />
                                  </button>
                                </div>
                              </div>
                              <div className="relative shrink-0">
                                <div className="peer flex h-[2.1rem] w-[2.1rem] cursor-default items-center justify-center rounded-full border border-white/20 text-white/40 transition-all hover:bg-white/10 hover:text-white">
                                  <Info size={17} />
                                </div>
                                <div className="pointer-events-none absolute right-0 top-11 z-50 w-56 rounded-[0.95rem] border border-white/20 bg-[#0c1525]/98 px-3 py-2 text-[0.78rem] font-medium leading-5 text-white/85 opacity-0 shadow-[0_8px_30px_rgba(0,0,0,0.6)] backdrop-blur-2xl transition-opacity duration-200 peer-hover:pointer-events-auto peer-hover:opacity-100">
                                  {role.description}
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}
        </div>
      )}
      {/* Schwarzer Vorhang für den Spielstart – fängt Eingaben ab, solange er liegt. */}
      <div
        aria-hidden
        className={`fixed inset-0 z-[70] bg-black ease-in-out ${
          curtain ? "pointer-events-auto" : "pointer-events-none"
        }`}
        style={{
          opacity: curtain ? 1 : 0,
          transitionProperty: "opacity",
          transitionDuration: `${curtain ? CURTAIN_FADE_IN_MS : CURTAIN_FADE_OUT_MS}ms`,
        }}
      />
    </div>
  );
}
```

## Datei: `src/components/werwolf/sky-background.tsx`

```tsx
"use client";

export function SkyBackground({ isActive }: { isActive: boolean }) {
  return (
    <div
      className={`pointer-events-none absolute inset-0 z-0 transition-opacity duration-1000 ${
        isActive ? "opacity-100" : "opacity-0"
      }`}
    >
      {/* Ebenen von hinten nach vorne: sky (z-0) → clouds (z-10) → foreground (z-20).
          Der z-Index der Wolken liegt auf den animierten, geblendeten Elementen selbst
          (nicht auf den overflow-hidden-Wrappern), damit mix-blend-screen weiterhin
          gegen den Himmel blendet und der Vordergrund trotzdem davor liegt. */}
      <div className="absolute inset-0 z-0 bg-[url('/sky.png')] bg-cover bg-center" />
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute left-0 top-0 z-10 flex h-full w-[200vw] animate-[slideCloudsRight_140s_linear_infinite] opacity-40 mix-blend-screen">
          <div className="h-full w-[100vw] scale-x-[-1.1] scale-y-110 bg-[url('/clouds.png')] bg-cover bg-center" />
          <div className="h-full w-[100vw] scale-x-[-1.1] scale-y-110 bg-[url('/clouds.png')] bg-cover bg-center" />
        </div>
      </div>
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute left-0 top-0 z-10 flex h-full w-[200vw] animate-[slideCloudsRight_80s_linear_infinite] opacity-75 mix-blend-screen">
          <div className="h-full w-[100vw] bg-[url('/clouds.png')] bg-cover bg-center" />
          <div className="h-full w-[100vw] bg-[url('/clouds.png')] bg-cover bg-center" />
        </div>
      </div>
      {/* Vordergrund liegt deckend vor den Wolken. Bewusst ohne Maske/Verlauf:
          eine Ausblendung der oberen Bildhälfte ließ die Wolken vor dem Dorf
          durchscheinen, obwohl die Ebene korrekt gestapelt war. */}
      <div className="absolute inset-0 z-20 bg-[url('/foreground.png')] bg-bottom bg-cover bg-no-repeat" />
    </div>
  );
}
```

## Datei: `src/components/werwolf/game-table.tsx`

```tsx
"use client";

import { LogOut } from "lucide-react";
import type { ReactNode } from "react";

import { WalkingCat } from "@/components/werwolf/walking-cat";
import {
  DEFAULT_COLOR,
  SEAT_COUNT,
  colorWash,
  type LobbyPlayer,
} from "@/lib/game";

/**
 * Spieltisch – Sitzordnung nach Skizze:
 *
 *   [ 1 ]  [11]    [ HOST ]    [12]  [ 2 ]
 *   [ 3 ]                      [ 4 ]
 *   [ 5 ]                      [ 6 ]
 *   [ 7 ]                      [ 8 ]
 *   [ 9 ]                      [10 ]
 *
 * Alle Angaben in Prozent der Spielfläche. Die Plätze werden in der
 * Beitrittsreihenfolge besetzt (1, 2, 3, …), d. h. links und rechts wachsen
 * immer im Wechsel – die Anordnung bleibt damit für jede Spielerzahl
 * symmetrisch und füllt sich von oben nach unten.
 */
interface SeatBox {
  left: number;
  top: number;
  width: number;
  height: number;
}

const SIDE_LEFT = 1;
const SIDE_RIGHT = 82;
const SIDE_WIDTH = 17;
const ROW_HEIGHT = 18.6;
const ROW_GAP = 1.2;
const ROW_TOP = Array.from({ length: 5 }, (_, row) => 1 + row * (ROW_HEIGHT + ROW_GAP));
const TOP_ROW_LEFT = 19.5;
const TOP_ROW_RIGHT = 63.5;

const HOST_BOX: SeatBox = { left: 39.5, top: 1, width: 21, height: 26 };

/** Platz 1 bis 12 (Index 0–11). Ungerade Plätze links, gerade rechts. */
export const SEAT_LAYOUT: SeatBox[] = [
  ...ROW_TOP.flatMap((top) => [
    { left: SIDE_LEFT, top, width: SIDE_WIDTH, height: ROW_HEIGHT },
    { left: SIDE_RIGHT, top, width: SIDE_WIDTH, height: ROW_HEIGHT },
  ]),
  { left: TOP_ROW_LEFT, top: 1, width: SIDE_WIDTH, height: ROW_HEIGHT },
  { left: TOP_ROW_RIGHT, top: 1, width: SIDE_WIDTH, height: ROW_HEIGHT },
];

export interface GameTableProps {
  /** Teilnehmer inklusive Host; der eigene Eintrag ist bereits aufgelöst. */
  players: LobbyPlayer[];
  /** Spieler-ID, der gerade spricht (grüner Leuchtrand). */
  speakingId: string | null;
  isHost: boolean;
  busy: boolean;
  onBackToLobby: () => void;
  onLeave: () => void;
}

export function GameTable({
  players,
  speakingId,
  isHost,
  busy,
  onBackToLobby,
  onLeave,
}: GameTableProps) {
  const host = players.find((player) => player.isHost) ?? null;
  const guests = players.filter((player) => !player.isHost).slice(0, SEAT_COUNT);

  return (
    <div className="absolute inset-0 z-20 overflow-hidden bg-[#1e40af] text-white">
      {host && (
        <Seat box={HOST_BOX}>
          <PlayerCard
            player={host}
            speaking={host.id === speakingId}
            label="Host"
          />
        </Seat>
      )}

      {SEAT_LAYOUT.map((box, index) => {
        const player = guests[index];
        return (
          <Seat key={`seat-${index}`} box={box} number={index + 1}>
            {player ? (
              <PlayerCard
                player={player}
                speaking={player.id === speakingId}
                label="Player"
              />
            ) : null}
          </Seat>
        );
      })}

      <div className="pointer-events-none absolute left-1/2 top-[52%] flex -translate-x-1/2 flex-col items-center text-center">
        <p className="text-[clamp(1.2rem,2.6vw,2.4rem)] font-black uppercase tracking-[0.24em] text-white">
          Spiel läuft
        </p>
        <p className="mt-2 text-xs font-bold uppercase tracking-[0.3em] text-white/60">
          {players.length} Teilnehmer
        </p>
      </div>

      <div className="absolute bottom-[2.5%] left-1/2 flex -translate-x-1/2 items-center gap-3">
        <button
          onClick={onLeave}
          className="flex items-center gap-2 rounded-[1rem] border border-white/25 bg-white/5 px-3 py-2 text-xs font-bold uppercase tracking-wide text-white/70 transition-all duration-200 hover:border-red-400/50 hover:bg-red-500/15 hover:text-red-100"
        >
          <LogOut size={16} />
          Lobby verlassen
        </button>
        {isHost && (
          <button
            onClick={onBackToLobby}
            disabled={busy}
            className="rounded-[1rem] border border-white/20 bg-white/5 px-4 py-2 text-xs font-bold uppercase tracking-[0.18em] text-white/70 transition-all duration-200 hover:bg-white/15 hover:text-white disabled:opacity-50"
          >
            Zurück zur Lobby
          </button>
        )}
      </div>
    </div>
  );
}

function Seat({
  box,
  number,
  children,
}: {
  box: SeatBox;
  number?: number;
  children?: ReactNode;
}) {
  return (
    <div
      className="absolute"
      style={{
        left: `${box.left}%`,
        top: `${box.top}%`,
        width: `${box.width}%`,
        height: `${box.height}%`,
      }}
    >
      {children ?? (
        <div className="flex h-full w-full items-center justify-center rounded-[1.4rem] border-2 border-dashed border-white/20 text-white/30">
          <span className="text-[clamp(0.9rem,2vw,1.6rem)] font-bold">{number}</span>
        </div>
      )}
    </div>
  );
}

function PlayerCard({
  player,
  speaking,
  label,
}: {
  player: LobbyPlayer;
  speaking: boolean;
  label: string;
}) {
  const displayName = player.name || "NAME";
  const hasColor = Boolean(player.color) && player.color !== DEFAULT_COLOR;

  return (
    <div
      className={`relative flex h-full w-full flex-col items-center justify-center overflow-hidden rounded-[1.4rem] border-2 bg-[#172033] px-3 py-3 text-center transition-all duration-150 ${
        speaking
          ? "border-[#4ade80] shadow-[0_0_20px_rgba(34,197,94,0.95),0_0_44px_rgba(34,197,94,0.55),inset_0_0_20px_rgba(34,197,94,0.4)] ring-2 ring-[#4ade80]"
          : "border-white/15"
      }`}
      style={{ containerType: "size" }}
    >
      {hasColor && (
        <div
          className="pointer-events-none absolute inset-0"
          style={{
            background: colorWash(player.color, player.fadeIntensity ?? 50, 70),
          }}
        />
      )}
      <div
        className="relative z-10 flex items-center justify-center overflow-hidden rounded-full text-[clamp(1rem,30cqmin,2.5rem)] font-black uppercase text-white drop-shadow-md"
        style={{ width: "38cqmin", height: "38cqmin" }}
      >
        {player.image ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={player.image} alt="Profile" className="h-full w-full object-cover" />
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-white/10">
            {displayName.slice(0, 1) || "?"}
          </div>
        )}
      </div>
      <p
        className="relative z-10 mt-[4cqmin] max-w-full break-all font-black uppercase leading-none text-white drop-shadow-md"
        style={{ fontSize: "clamp(0.8rem, 13cqmin, 2.2rem)" }}
      >
        {displayName}
      </p>
      <p
        className="relative z-10 mt-[2cqmin] font-bold uppercase tracking-[0.3em] text-white/50"
        style={{ fontSize: "clamp(0.45rem, 5.5cqmin, 0.8rem)" }}
      >
        {label}
      </p>
      {player.frame === "frame1" && <WalkingCat cardWidth={200} />}
    </div>
  );
}
```

## Datei: `src/components/werwolf/walking-cat.tsx`

```tsx
"use client";

import { useEffect, useState } from "react";

export function WalkingCat({ cardWidth }: { cardWidth: number }) {
  const [frame, setFrame] = useState(0);
  const [position, setPosition] = useState(0);
  const [forward, setForward] = useState(true);
  const [failed, setFailed] = useState(false);

  const size = Math.max(16, cardWidth / 8);
  const maxPosition = cardWidth - size;

  useEffect(() => {
    const interval = setInterval(() => setFrame((f) => (f === 0 ? 1 : 0)), 300);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const interval = setInterval(() => {
      setPosition((current) => {
        const step = Math.max(0.5, cardWidth / 200);
        let next = forward ? current + step : current - step;
        if (next >= maxPosition) {
          next = maxPosition;
          setForward(false);
        } else if (next <= 0) {
          next = 0;
          setForward(true);
        }
        return next;
      });
    }, 16);
    return () => clearInterval(interval);
  }, [forward, maxPosition, cardWidth]);

  if (failed) return null;

  const src =
    frame === 0 ? "/frames/GrayCatWalkingOne.png" : "/frames/GrayCatWalkingTwo.png";

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt="Walking Cat"
      onError={() => setFailed(true)}
      className="pointer-events-none absolute bottom-0"
      style={{
        width: size,
        height: size,
        left: position,
        transform: forward ? "scaleX(1)" : "scaleX(-1)",
        objectFit: "contain",
      }}
      draggable={false}
    />
  );
}
```

## Datei: `src/components/werwolf/role-icon.tsx`

```tsx
"use client";

import { useState } from "react";

export function RoleIcon({
  name,
  short,
  className = "",
}: {
  name: string;
  short?: string;
  className?: string;
}) {
  const [failed, setFailed] = useState(false);

  if (failed) {
    return (
      <span
        className={`flex h-full w-full items-center justify-center font-black uppercase tracking-wide ${className}`}
      >
        {short ?? name.slice(0, 2)}
      </span>
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={`/roles/${encodeURIComponent(name)}icon.png`}
      alt={name}
      onError={() => setFailed(true)}
      className={`h-full w-full object-contain ${className}`}
      draggable={false}
    />
  );
}
```

## Datei: `src/components/werwolf/glass-card.tsx`

```tsx
import type { ReactNode } from "react";

export function GlassCard({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`rounded-[1.75rem] border border-white/15 bg-white/[0.06] shadow-[0_8px_32px_rgba(0,0,0,0.35)] backdrop-blur-md ${className}`}
    >
      {children}
    </div>
  );
}
```

## Datei: `src/components/auth/auth-gate.tsx`

```tsx
"use client";

import { useEffect, useState, type ReactNode } from "react";

import { SignInScreen } from "@/components/auth/sign-in-screen";
import { authClient } from "@/lib/auth/client";

type AuthConfig = { enabled: boolean; signedIn: boolean };

/** Wie lange `/api/config` auf sich warten darf, bevor aufgegeben wird. */
const CONFIG_TIMEOUT_MS = 8_000;

function AuthGateInner({ children, config }: { children: ReactNode; config: AuthConfig }) {
  const { data: session, isPending, refetch } = authClient.useSession();

  if (!config.enabled) return <>{children}</>;

  // Während der Session-Prüfung nicht blockieren – die Seite bleibt nutzbar,
  // geschützte API-Routen prüfen die Session serverseitig (401).
  if (isPending && !session) return <>{children}</>;

  if (!session?.user) {
    return <SignInScreen onDone={() => void refetch()} />;
  }

  return <>{children}</>;
}

/**
 * Login-Schranke um die App.
 *
 * Kein Ladescreen: Die App wird sofort gerendert. `/api/config` wird im
 * Hintergrund geladen; ist der Login aktiviert, blendet sich bei Bedarf die
 * Anmeldung ein, ohne die Seite vorher zu blockieren.
 */
export function AuthGate({ children }: { children: ReactNode }) {
  const [config, setConfig] = useState<AuthConfig>({ enabled: false, signedIn: false });

  useEffect(() => {
    let cancelled = false;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), CONFIG_TIMEOUT_MS);

    fetch("/api/config", { cache: "no-store", signal: controller.signal })
      .then((response) => response.json())
      .then((body: { auth?: AuthConfig }) => {
        if (!cancelled) {
          setConfig({ enabled: Boolean(body.auth?.enabled), signedIn: Boolean(body.auth?.signedIn) });
        }
      })
      .catch(() => {
        if (!cancelled) setConfig({ enabled: false, signedIn: false });
      })
      .finally(() => clearTimeout(timer));

    return () => {
      cancelled = true;
      clearTimeout(timer);
      controller.abort();
    };
  }, []);

  // Solange die Konfiguration noch nicht geladen ist (bzw. Login deaktiviert),
  // die App direkt zeigen – kein „Laden…“.
  if (!config.enabled) return <>{children}</>;

  return <AuthGateInner children={children} config={config} />;
}
```

## Datei: `src/components/auth/sign-in-screen.tsx`

```tsx
"use client";

import { useState } from "react";

import { SkyBackground } from "@/components/werwolf/sky-background";
import { GlassCard } from "@/components/werwolf/glass-card";
import { authClient } from "@/lib/auth/client";

type Mode = "signIn" | "signUp";

/**
 * Anmeldung über Neon Auth (Managed Better Auth). Der Client spricht mit der
 * same-origin Route `/api/auth/*`; E-Mails (Verifizierung, Passwort-Reset)
 * verschickt Neon Auth selbst.
 */
export function SignInScreen({ onDone }: { onDone?: () => void }) {
  const [mode, setMode] = useState<Mode>("signIn");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setError(null);
    setNotice(null);

    try {
      const result =
        mode === "signIn"
          ? await authClient.signIn.email({ email, password })
          : await authClient.signUp.email({ email, password, name: name || email });

      if (result.error) {
        setError(result.error.message ?? "Anmeldung fehlgeschlagen.");
        return;
      }
      setNotice(
        mode === "signUp"
          ? "Konto erstellt – falls eine Bestätigungsmail kommt, bitte den Code eingeben."
          : null,
      );
      onDone?.();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unbekannter Fehler.");
    } finally {
      setBusy(false);
    }
  };

  const inputClass =
    "w-full rounded-[1rem] border border-white/20 bg-white/5 px-4 py-3 text-base font-semibold text-white placeholder-white/35 outline-none transition-colors focus:border-white/45 focus:bg-white/10";

  return (
    <div className="relative min-h-screen w-full overflow-hidden bg-[#0b1220] text-white">
      <SkyBackground isActive />
      <div className="relative z-10 flex min-h-screen items-center justify-center px-4 py-10">
        <GlassCard className="w-full max-w-[26rem] p-6 sm:p-8">
          <p className="text-xs font-black uppercase tracking-[0.32em] text-white/50">
            Werwolf Lobby
          </p>
          <h1 className="mt-2 text-[2rem] font-black uppercase leading-none tracking-tight sm:text-[2.4rem]">
            {mode === "signIn" ? "Anmelden" : "Konto erstellen"}
          </h1>
          <p className="mt-3 text-sm font-semibold text-white/55">
            {mode === "signIn"
              ? "Melde dich an, um eine Lobby zu erstellen oder beizutreten."
              : "Erstelle ein Konto, um mitspielen zu können."}
          </p>

          <form onSubmit={submit} className="mt-6 flex flex-col gap-3">
            {mode === "signUp" && (
              <input
                className={inputClass}
                type="text"
                autoComplete="nickname"
                placeholder="Spielname"
                value={name}
                onChange={(event) => setName(event.target.value)}
              />
            )}
            <input
              className={inputClass}
              type="email"
              autoComplete="email"
              placeholder="E-Mail"
              required
              value={email}
              onChange={(event) => setEmail(event.target.value)}
            />
            <input
              className={inputClass}
              type="password"
              autoComplete={mode === "signIn" ? "current-password" : "new-password"}
              placeholder="Passwort"
              required
              minLength={8}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
            />

            {error && (
              <p
                role="alert"
                className="rounded-[1rem] border border-red-400/40 bg-red-500/15 px-3 py-2 text-sm font-semibold text-red-100"
              >
                {error}
              </p>
            )}
            {notice && (
              <p className="rounded-[1rem] border border-emerald-400/40 bg-emerald-500/15 px-3 py-2 text-sm font-semibold text-emerald-100">
                {notice}
              </p>
            )}

            <button
              type="submit"
              disabled={busy}
              className="mt-1 rounded-[1.2rem] border border-white/30 bg-white/15 px-5 py-3 text-[1.05rem] font-black uppercase tracking-[0.16em] text-white transition-all duration-200 hover:-translate-y-0.5 hover:bg-white hover:text-black disabled:animate-pulse disabled:opacity-60"
            >
              {busy ? "Bitte warten…" : mode === "signIn" ? "Anmelden" : "Registrieren"}
            </button>
          </form>

          <button
            onClick={() => {
              setMode(mode === "signIn" ? "signUp" : "signIn");
              setError(null);
              setNotice(null);
            }}
            className="mt-4 w-full text-center text-sm font-bold uppercase tracking-[0.18em] text-white/60 transition-colors hover:text-white"
          >
            {mode === "signIn"
              ? "Noch kein Konto? Registrieren"
              : "Schon registriert? Anmelden"}
          </button>
        </GlassCard>
      </div>
    </div>
  );
}
```

## Datei: `scripts/measure-ram.mjs`

```js
#!/usr/bin/env node
/**
 * RAM-Messung für die StarAFK-App (Render-Free-Plan: 512 MB).
 *
 * Startet den FERTIG gebauten Server (`npm run build` vorher ausführen) in
 * verschiedenen Szenarien, simuliert nebenbei Spieler, die den Lobby-Zustand
 * pollen, und misst dabei durchgehend den RSS-Speicher des Serverprozesses.
 *
 * Aufruf:
 *   node scripts/measure-ram.mjs                      # alle drei Szenarien
 *   node scripts/measure-ram.mjs --scenario extern    # nur mit externer DB
 *   node scripts/measure-ram.mjs --players 24 --seconds 40
 *   node scripts/measure-ram.mjs --with-build         # zusätzlich Build-Peak
 *
 * Szenarien:
 *   extern   – DATABASE_URL gesetzt (Normalfall auf Render, sobald die
 *              Blueprint-Datenbank oder Neon verdrahtet ist)
 *   blocked  – KEINE Datenbank-URL: PGlite bleibt aus (RAM-Schutz, siehe
 *              `pglitePolicy` in src/db/index.ts). Die Seite muss trotzdem
 *              antworten und /api/health muss die Ursache nennen.
 *   pglite   – KEINE Datenbank-URL, aber PGLITE_IN_PRODUCTION=1: zeigt den
 *              RAM-Preis der eingebetteten Datenbank (Vorsicht: > 500 MB!).
 *
 * Nur Node-Bordmittel, keine zusätzlichen Abhängigkeiten.
 */
import { execSync, spawn } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

const ROOT = path.resolve(import.meta.dirname, "..");
const LIMIT_MB = Number(process.env.RENDER_MEMORY_LIMIT_MB ?? 512);
const POLL_INTERVAL_MS = 1_200; // wie im Frontend (POLL_ACTIVE_MS)

/* ----------------------------- CLI-Argumente ---------------------------- */

const cliArgs = process.argv.slice(2);

function argValue(name, fallback) {
  const index = cliArgs.indexOf(`--${name}`);
  return index >= 0 && cliArgs[index + 1] ? cliArgs[index + 1] : fallback;
}

const onlyScenario = argValue("scenario", null);
const players = Math.max(1, Number(argValue("players", 12)) || 12);
const seconds = Math.max(5, Number(argValue("seconds", 25)) || 25);
const withBuild = cliArgs.includes("--with-build");
const basePort = Number(argValue("port", 3210)) || 3210;

const ALL_SCENARIOS = [
  {
    id: "extern",
    label: "externe Datenbank (DATABASE_URL gesetzt)",
    env: {
      // Absichtlich eine nicht erreichbare Adresse: gemessen werden soll der
      // Speicherbedarf des SERVERS, nicht eine laufende Datenbank. Wer den
      // vollen Durchlauf mit echter DB will, setzt DATABASE_URL selbst und
      // startet mit: DATABASE_URL=… node scripts/measure-ram.mjs --scenario extern
      DATABASE_URL: process.env.DATABASE_URL || "postgresql://u:p@127.0.0.1:5432/db",
    },
    lobbyErwartet: false,
  },
  {
    id: "blocked",
    label: "ohne DB – PGlite blockiert (Produktions-Standard)",
    env: { DATABASE_URL: "", AUTO_DATABASE_URL: "" },
    lobbyErwartet: false,
  },
  {
    id: "pglite",
    label: "ohne DB – PGlite erzwungen (PGLITE_IN_PRODUCTION=1)",
    env: { DATABASE_URL: "", AUTO_DATABASE_URL: "", PGLITE_IN_PRODUCTION: "1" },
    lobbyErwartet: true,
  },
];

const scenarios = onlyScenario
  ? ALL_SCENARIOS.filter((scenario) => scenario.id === onlyScenario)
  : ALL_SCENARIOS;

if (scenarios.length === 0) {
  console.error(
    `Unbekanntes Szenario "${onlyScenario}". Möglich: ${ALL_SCENARIOS.map(
      (scenario) => scenario.id,
    ).join(", ")}`,
  );
  process.exit(1);
}

/* -------------------------------- Helfer -------------------------------- */

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/** RSS eines Prozesses in MB (Linux: /proc, sonst `ps`). */
function rssMb(pid) {
  if (!pid) return NaN;
  try {
    const match = /VmRSS:\s+(\d+) kB/.exec(readFileSync(`/proc/${pid}/status`, "utf8"));
    if (match) return Number(match[1]) / 1024;
  } catch {
    /* kein /proc verfügbar (z. B. macOS) – Fallback unten */
  }
  try {
    return Number(execSync(`ps -o rss= -p ${pid}`, { encoding: "utf8" }).trim()) / 1024;
  } catch {
    return NaN;
  }
}

/** Summe aller Node-Prozesse in MB – für die Build-Messung (Worker!). */
function allNodeRssMb() {
  try {
    return (
      execSync("ps -eo rss,args --no-headers", { encoding: "utf8" })
        .split("\n")
        .filter((line) => /node|next/.test(line) && !line.includes("measure-ram"))
        .reduce((sum, line) => sum + (Number(line.trim().split(/\s+/)[0]) || 0), 0) /
      1024
    );
  } catch {
    return NaN;
  }
}

const fmt = (value) => (Number.isFinite(value) ? `${Math.round(value)} MB` : "n/a");

async function waitForHealth(url, timeoutMs = 60_000) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    try {
      const response = await fetch(`${url}/api/health`, { cache: "no-store" });
      if (response.ok) return response.json();
    } catch {
      /* Server startet noch */
    }
    await sleep(400);
  }
  return null;
}

/**
 * Simuliert `count` Spieler, die alle 1,2 s den Lobby-Zustand pollen – exakt
 * das Lastmuster, das die echte Oberfläche erzeugt (POLL_ACTIVE_MS).
 */
function startPolling(url, code, playerId, count) {
  const target = code
    ? `${url}/api/lobby/state?code=${encodeURIComponent(code)}&pid=${encodeURIComponent(playerId)}`
    : `${url}/api/health`;
  const offsets = [];
  const intervals = [];
  for (let index = 0; index < count; index += 1) {
    // Versetzt starten, damit nicht alle im selben Tick feuern.
    offsets.push(
      setTimeout(() => {
        fetch(target, { cache: "no-store" }).catch(() => {});
        intervals.push(
          setInterval(() => {
            fetch(target, { cache: "no-store" }).catch(() => {});
          }, POLL_INTERVAL_MS),
        );
      }, index * 50),
    );
  }
  // Wichtig: ALLE Timer wieder abräumen – sonst läuft die Messung weiter und
  // hält den Prozess künstlich beschäftigt (genau das Muster, das in der App
  // selbst vermieden wird).
  return () => {
    offsets.forEach((timer) => clearTimeout(timer));
    intervals.forEach((timer) => clearInterval(timer));
  };
}

/* ------------------------------ ein Durchlauf ---------------------------- */

async function measure(scenario, port) {
  console.log(`\n── Szenario: ${scenario.label} ─────────────────────────`);

  const child = spawn(
    process.execPath,
    [
      `--max-old-space-size=${process.env.NODE_MAX_OLD_SPACE_MB ?? 384}`,
      "node_modules/next/dist/bin/next",
      "start",
      "--hostname",
      "127.0.0.1",
      "--port",
      String(port),
    ],
    {
      cwd: ROOT,
      env: {
        ...process.env,
        PORT: String(port),
        NODE_ENV: "production",
        NEXT_TELEMETRY_DISABLED: "1",
        ...scenario.env,
      },
      stdio: ["ignore", "pipe", "pipe"],
    },
  );

  const logs = [];
  child.stdout.on("data", (chunk) => logs.push(String(chunk)));
  child.stderr.on("data", (chunk) => logs.push(String(chunk)));

  let peak = 0;
  let samples = 0;
  let sum = 0;
  const sampler = setInterval(() => {
    const value = rssMb(child.pid);
    if (!Number.isFinite(value)) return;
    samples += 1;
    sum += value;
    if (value > peak) peak = value;
  }, 250);

  const url = `http://127.0.0.1:${port}`;
  const health = await waitForHealth(url);
  const boot = rssMb(child.pid);

  const stop = async () => {
    clearInterval(sampler);
    child.kill("SIGTERM");
    await sleep(700);
    if (child.exitCode === null) child.kill("SIGKILL");
  };

  if (!health) {
    await stop();
    console.log(
      `  ❌ Server hat nicht geantwortet. Log-Auszug:\n${logs
        .join("")
        .split("\n")
        .slice(-12)
        .map((line) => `     ${line}`)
        .join("\n")}`,
    );
    return null;
  }

  // Lobby anlegen – klappt nur, wenn im Szenario eine Datenbank mitspielt.
  let code = "";
  let playerId = "";
  try {
    const created = await fetch(`${url}/api/lobby/create`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mode: "WERWOLF", profile: { name: "Messung" } }),
    }).then((response) => response.json());
    if (created?.ok) {
      code = created.lobby?.code ?? "";
      playerId = created.selfId ?? "";
    }
  } catch {
    /* ohne erreichbare Datenbank erwartet */
  }

  const stopPolling = startPolling(url, code, playerId, players);
  await sleep(seconds * 1000);
  stopPolling();
  await sleep(1500);

  const steady = rssMb(child.pid);
  const healthNow = await fetch(`${url}/api/health`, { cache: "no-store" })
    .then((response) => response.json())
    .catch(() => null);
  const homepage = await fetch(`${url}/`, { cache: "no-store" })
    .then((response) => response.status)
    .catch(() => 0);

  await stop();

  const average = samples ? sum / samples : NaN;
  const overLimit = peak > LIMIT_MB;

  console.log(`  Boot-RSS:              ${fmt(boot)}`);
  console.log(`  RSS bei ${String(players).padStart(2)} Pollern:     ${fmt(steady)}`);
  console.log(`  RSS-Durchschnitt:      ${fmt(average)}   (${samples} Messpunkte)`);
  console.log(
    `  RSS-Spitze:            ${fmt(peak)}   ${
      overLimit ? `❌ über dem Limit (${LIMIT_MB} MB)` : `✅ unter ${LIMIT_MB} MB`
    }`,
  );
  console.log(
    `  /api/health:           db=${healthNow?.db ?? "?"} provider=${
      healthNow?.provider ?? "?"
    } storage=${healthNow?.status?.storage ?? "?"} ok=${healthNow?.ok}`,
  );
  if (healthNow?.status?.notice) {
    console.log(`  Hinweis in health:     ${healthNow.status.notice.slice(0, 150)}…`);
  }
  console.log(`  Startseite:            HTTP ${homepage}`);
  console.log(
    `  Lobby anlegen:         ${
      code ? `ok (Code ${code})` : "nicht möglich (ohne Datenbank erwartet)"
    }`,
  );
  if (scenario.lobbyErwartet && !code) {
    console.log("  ❌ Hier hätte die Lobby funktionieren müssen!");
  }

  return {
    scenario: scenario.id,
    boot,
    steady,
    peak,
    average,
    overLimit,
    homepage,
  };
}

/* --------------------------------- Build -------------------------------- */

async function measureBuild() {
  console.log("\n── Build: npm run build ────────────────────────────────");
  const child = spawn("npm", ["run", "build"], {
    cwd: ROOT,
    env: { ...process.env, NEXT_TELEMETRY_DISABLED: "1" },
    stdio: ["ignore", "pipe", "pipe"],
  });
  let peak = 0;
  const sampler = setInterval(() => {
    const value = allNodeRssMb();
    if (Number.isFinite(value) && value > peak) peak = value;
  }, 250);
  const exitCode = await new Promise((resolve) => child.on("close", resolve));
  clearInterval(sampler);
  console.log(`  Build-Spitze (alle Node-Prozesse): ${fmt(peak)}   Exit=${exitCode}`);
  console.log(
    "  Einordnung: Der Build läuft auf Render als eigener Schritt; das\n" +
      "  512-MB-Limit des Laufzeitprozesses gilt dafür nicht zwangsläufig.",
  );
  return peak;
}

/* ---------------------------------- Main -------------------------------- */

if (!existsSync(path.join(ROOT, ".next", "BUILD_ID"))) {
  console.error(
    "Kein Build gefunden (.next/BUILD_ID fehlt). Bitte zuerst ausführen: npm run build",
  );
  process.exit(1);
}

console.log(
  `StarAFK RAM-Messung – Container-Limit ${LIMIT_MB} MB, ` +
    `${players} simulierte Spieler, ${seconds} s pro Szenario`,
);

const buildPeak = withBuild ? await measureBuild() : null;
const results = [];
let port = basePort;
for (const scenario of scenarios) {
  const result = await measure(scenario, port);
  if (result) results.push(result);
  port += 1;
  await sleep(1000);
}

console.log("\n=== Zusammenfassung ===================================");
console.log("Szenario         Boot       Dauerlauf  Spitze     Status");
for (const result of results) {
  console.log(
    `${result.scenario.padEnd(16)} ${fmt(result.boot).padEnd(10)} ${fmt(
      result.steady,
    ).padEnd(10)} ${fmt(result.peak).padEnd(10)} ${
      result.overLimit ? `❌ > ${LIMIT_MB} MB` : `✅ ≤ ${LIMIT_MB} MB`
    }`,
  );
}
if (buildPeak !== null) console.log(`\nBuild-Spitze:    ${fmt(buildPeak)}`);
console.log(
  `\nDeutung: „Spitze“ ist der höchste RSS-Wert des Serverprozesses – genau der\n` +
    `Wert, den Render im Dashboard anzeigt (Service → Metrics → Memory).\n` +
    `Das Szenario "pglite" zeigt, warum die eingebettete Datenbank in Produktion\n` +
    `blockiert wird: Sie allein braucht mehr als das gesamte 512-MB-Budget.`,
);
```

## Datei: `scripts/build-readme.mjs`

````js
#!/usr/bin/env node
/**
 * Generiert public/README.md mit dem VOLLSTÄNDIGEN Quellcode des Projekts.
 * Aufruf: node scripts/build-readme.mjs
 *
 * Ziel: Wer die Website-URL kennt, kann über <url>/README.md alle Dateien
 * 1:1 rekonstruieren (Textdateien inline, Binärdateien per Pfad ladbar).
 */
import { readFileSync, writeFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

const ROOT = process.cwd();

/** Textdateien, die vollständig eingebettet werden (Reihenfolge = Ausgabe). */
const TEXT_FILES = [
  "package.json",
  "next.config.ts",
  "tsconfig.json",
  "drizzle.config.json",
  "postcss.config.mjs",
  "render.yaml",
  "src/instrumentation.ts",
  "src/db/index.ts",
  "src/db/migrate.ts",
  "src/db/schema.ts",
  "src/lib/api.ts",
  "src/lib/health.ts",
  "src/lib/game.ts",
  "src/lib/image.ts",
  "src/lib/lobby-service.ts",
  "src/lib/game-master.ts",
  "src/lib/storage.ts",
  "src/lib/auth/server.ts",
  "src/lib/auth/guard.ts",
  "src/lib/auth/client.ts",
  "src/app/layout.tsx",
  "src/app/page.tsx",
  "src/app/globals.css",
  "src/app/api/health/route.ts",
  "src/app/api/config/route.ts",
  "src/app/api/auth/[...path]/route.ts",
  "src/app/api/lobby/create/route.ts",
  "src/app/api/lobby/join/route.ts",
  "src/app/api/lobby/state/route.ts",
  "src/app/api/lobby/profile/route.ts",
  "src/app/api/lobby/roles/route.ts",
  "src/app/api/lobby/start/route.ts",
  "src/app/api/lobby/leave/route.ts",
  "src/app/api/lobby/avatar/route.ts",
  "src/components/werwolf/werwolf-app.tsx",
  "src/components/werwolf/sky-background.tsx",
  "src/components/werwolf/game-table.tsx",
  "src/components/werwolf/walking-cat.tsx",
  "src/components/werwolf/role-icon.tsx",
  "src/components/werwolf/glass-card.tsx",
  "src/components/auth/auth-gate.tsx",
  "src/components/auth/sign-in-screen.tsx",
  "scripts/measure-ram.mjs",
  "scripts/build-readme.mjs",
];

/** Binärdateien: nicht inline, sondern über die Website-URL ladbar. */
const BINARY_FILES = [
  "public/sky.png",
  "public/clouds.png",
  "public/foreground.png",
  "public/frames/GrayCatWalkingOne.png",
  "public/frames/GrayCatWalkingTwo.png",
  ...readdirSync(join(ROOT, "public/roles"))
    .filter((file) => file.endsWith(".png"))
    .sort()
    .map((file) => `public/roles/${file}`),
];

function langFor(path) {
  if (path.endsWith(".ts") || path.endsWith(".tsx")) return "tsx";
  if (path.endsWith(".css")) return "css";
  if (path.endsWith(".json")) return "json";
  if (path.endsWith(".mjs")) return "js";
  if (path.endsWith(".svg")) return "xml";
  return "";
}

function fence(content) {
  // Längeren Zaun wählen, falls der Inhalt bereits ``` enthält.
  let longest = 0;
  for (const match of content.matchAll(/`+/g)) {
    longest = Math.max(longest, match[0].length);
  }
  return "`".repeat(Math.max(3, longest + 1));
}

const svgFiles = readdirSync(join(ROOT, "public/roles"))
  .filter((f) => f.endsWith(".svg"))
  .sort()
  .map((f) => `public/roles/${f}`);

const allTextFiles = [
  ...TEXT_FILES,
  "public/favicon-light.svg",
  "public/favicon-dark.svg",
  ...svgFiles,
];

const sections = [];
sections.push(`# Werwolf Lobby — Vollständiger Quellcode

> **ANLEITUNG FÜR KI-ASSISTENTEN / MENSCHEN ZUM 1:1-WIEDERAUFBAU:**
> Diese Datei enthält den KOMPLETTEN Quellcode aller Textdateien dieses Projekts.
> Jede Datei beginnt mit einer Überschrift \`## Datei: <pfad>\`, gefolgt von genau
> einem Code-Block, dessen Inhalt EXAKT so (Byte für Byte) unter dem angegebenen
> Pfad gespeichert werden muss. Binärdateien (Bilder) sind unten gelistet und
> können direkt von diesem Server unter ihrem Pfad heruntergeladen werden
> (z. B. \`GET /sky.png\` → speichern als \`public/sky.png\`).
>
> **Reihenfolge beim Wiederaufbau:**
> 1. Leeres Next.js-Projekt anlegen (oder Dateien einfach in einen Ordner schreiben).
> 2. ALLE Textdateien exakt wie hier abgedruckt anlegen.
> 3. Alle Binärdateien von dieser Website herunterladen (Liste unten).
> 4. \`npm install\` → \`npm run build\` → \`npm run start\` — fertig.
>    **Wichtig (RAM):** \`next start\` setzt \`NODE_ENV=production\`. Dort startet die
>    eingebettete PGlite-Datenbank NICHT mehr von selbst, weil sie als
>    WASM-PostgreSQL im Serverprozess ~456 MB belegt (gemessen: 596 MB RSS ohne
>    Last, 758 MB Spitze mit 6 pollenden Spielern) und eine 512-MB-Instanz damit
>    sofort gekillt wird. Für \`npm run start\` also \`DATABASE_URL\` setzen — oder
>    bei >= 1 GB RAM den Notausgang \`PGLITE_IN_PRODUCTION=1\`.
>    In \`npm run dev\` (\`NODE_ENV=development\`) bleibt alles beim Alten: ohne
>    \`DATABASE_URL\` entsteht automatisch \`.data/pglite\`.
> 5. Externe PostgreSQL-Datenbank (auf Render Pflicht): \`.env\` bzw.
>    Umgebungsvariable \`DATABASE_URL=postgresql://…\` — die Tabellen werden
>    ebenfalls automatisch angelegt (kein \`drizzle-kit push\`). Auf Render wird
>    \`AUTO_DATABASE_URL\` von der Blueprint (\`render.yaml\`) automatisch befüllt.
>    Ohne gültige Datenbank bleibt die Seite erreichbar (Startseite, \`/api/health\`),
>    die Lobby-API meldet einen klaren Fehler und die Ursache steht in
>    \`/api/health\` unter \`status.notice\`.

## Projektübersicht

Mehrspieler-Lobby für das Partyspiel **Werwolf** (Bonus-Modus: **Höhle der Löwen**):

- **Menü**: Spielmodus-Karussell (SPIELMODUS 1/2) mit Slide-Animation, Nachthimmel
  mit Wolken-Parallax und Dorf-Silhouette, „Lobby erstellen" / „Lobby beitreten"
  (6-stelliger Code, A–Z), Menüpunkte „Spielerkarte" / „Statistiken" / „Einstellungen".
- **Spielerkarte**: Name (max. 12 Zeichen), Farbe + Intensität (135°-Farbverlauf),
  Profilbild-Upload (Data-URL), Rahmenwahl (Rahmen 1 = laufende Katze \`Cd\`/\`WalkingCat\`).
  Persistenz in \`localStorage\` unter \`werwolf-player-profile\`.
- **Lobby**: kopierbarer Lobbycode mit „Lobby verlassen" direkt unter „Kopieren",
  deckende Spielerkarten (Farbe/Avatar/Host-Badge), Seitenleiste mit
  „Rollen für diese Runde" oben und vergrößertem Bereich „Sonstige Regeln",
  „Spiel starten" (Host) bzw. „Warte auf Host…" (Gäste).
- **15 Rollen** (Teams gut/böse/neutral) mit PNG-Symbolen aus
  \`/roles/<Rollenname>icon.png\`, Beschreibung, Gewinnkondition und Host-Zählern;
  Standard: 1× Werwolf, 2× Dorfbewohner.
- **Einladungslink**: \`?code=ABCDEF\` öffnet das Beitreten-Feld vorausgefüllt.
- **Realtime**: REST-Polling (1,2 s sichtbar / 20 s im Hintergrund-Tab),
  Lebenszeichen-Fenster 120 s, automatischer **Reconnect/Resume** (gleiche
  Spieler-ID, Host-Rolle bleibt), automatische Host-Nachfolge, Lobbys/Spieler in
  PostgreSQL via Drizzle ORM. „Spiel starten" (Host) synchronisiert den
  Spielstart in Echtzeit an alle Spieler.
- **Profilbilder**: im Browser auf max. 256 px verkleinert, liegen in der
  Datenbank und werden über \`GET /api/lobby/avatar?pid=…&v=…\` mit langem
  Browser-Cache ausgeliefert (winziges Polling statt Megabyte-Payloads).
- **Robuste Datenbank**: Verbindung baut sich bei Fehlern automatisch neu auf
  (\`src/db/index.ts\`), PGlite fällt bei Problemen mit dem Datenordner in den
  Speicher-Modus zurück; \`/api/health\` zeigt Modus, Speicherart und Fehlerzähler.
- **RAM-Budget 512 MB**: PGlite wird lazy geladen und in Produktion bzw. in
  Containern unter \`PGLITE_MIN_MEMORY_MB\` (Standard 900) blockiert
  (\`pglitePolicy()\`), der S3-Client wird nur mit konfiguriertem Bucket geladen,
  und das \`start\`-Skript begrenzt den V8-Heap (\`NODE_MAX_OLD_SPACE_MB\`,
  Standard 384). Nachmessen: \`node scripts/measure-ram.mjs\`.

## Binärdateien (von diesem Server laden, nicht inline)

${BINARY_FILES.map((f) => `- \`/${f.replace(/^public\//, "")}\` → speichern als \`${f}\``).join("\n")}

Falls ein Asset nicht mehr lädt: beliebige dunkle Nachthimmel-/Wolken-/Dorfsilhouetten-
Grafiken erzeugen ein nahezu identisches Bild; die Katzen-Sprites sind zwei Laufphasen
einer grauen Katze (transparente PNGs).

## Verzeichnisstruktur

\`\`\`
${[...allTextFiles.filter((f) => f !== "scripts/build-readme.mjs"), ...BINARY_FILES].join("\n")}
\`\`\`

---
`);

for (const file of allTextFiles) {
  const content = readFileSync(join(ROOT, file), "utf8");
  const f = fence(content);
  sections.push(`## Datei: \`${file}\`\n\n${f}${langFor(file)}\n${content.replace(/\s+$/, "")}\n${f}\n`);
}

const output = sections.join("\n");
writeFileSync(join(ROOT, "public/README.md"), output, "utf8");
console.log(`public/README.md geschrieben (${(output.length / 1024).toFixed(1)} KB, ${allTextFiles.length} Textdateien).`);
````

## Datei: `public/favicon-light.svg`

````xml
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
  <circle cx="32" cy="32" r="30" fill="#0b1220"/>
  <path d="M42.5 12a21 21 0 1 0 9.4 27.6A17.5 17.5 0 0 1 42.5 12z" fill="#f1f5f9"/>
  <circle cx="24" cy="30" r="2.4" fill="#0b1220"/>
  <path d="M16 44c3-5 8-8 13-8" stroke="#0b1220" stroke-width="2.6" fill="none" stroke-linecap="round"/>
</svg>
```

## Datei: `public/favicon-dark.svg`
````

## Datei: `public/favicon-dark.svg`

````xml
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
  <circle cx="32" cy="32" r="30" fill="#f1f5f9"/>
  <path d="M42.5 12a21 21 0 1 0 9.4 27.6A17.5 17.5 0 0 1 42.5 12z" fill="#0b1220"/>
  <circle cx="24" cy="30" r="2.4" fill="#f1f5f9"/>
  <path d="M16 44c3-5 8-8 13-8" stroke="#f1f5f9" stroke-width="2.6" fill="none" stroke-linecap="round"/>
</svg>
```

## Datei: `public/roles/Amoricon.svg`
````

## Datei: `public/roles/Amoricon.svg`

````xml
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" fill="none" stroke="#ffffff" stroke-opacity="0.85" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round">
  <path d="M24 40S8 30 8 18.5C8 12.5 12.5 9 17 9c3 0 5.5 1.5 7 4 1.5-2.5 4-4 7-4 4.5 0 9 3.5 9 9.5C40 30 24 40 24 40z"/>
  <path d="M30 8l10-4M40 4l-3 1M40 4l-1 3" />
  <path d="M40 4L30 16"/>
</svg>
```

## Datei: `public/roles/Bürgermeistericon.svg`
````

## Datei: `public/roles/Bürgermeistericon.svg`

````xml
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" fill="none" stroke="#ffffff" stroke-opacity="0.85" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round">
  <path d="M16 30V12h16v18"/>
  <path d="M10 30h28"/>
  <path d="M14 38h20"/>
  <path d="M16 21h16"/>
  <circle cx="24" cy="15.5" r="1.6" fill="#ffffff" stroke="none"/>
</svg>
```

## Datei: `public/roles/Detektivicon.svg`
````

## Datei: `public/roles/Detektivicon.svg`

````xml
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" fill="none" stroke="#ffffff" stroke-opacity="0.85" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round">
  <circle cx="20" cy="20" r="11"/>
  <path d="M28 28l13 13"/>
  <path d="M15 20c1.5-3 4-4.5 7-4"/>
</svg>
```

## Datei: `public/roles/Diebicon.svg`
````

## Datei: `public/roles/Diebicon.svg`

````xml
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" fill="none" stroke="#ffffff" stroke-opacity="0.85" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round">
  <path d="M6 20c4-3 8-4.5 12-4.5S26 17 30 20c2-1.2 5-2 8-2-1 8-6 13-14 13S8 28 6 20z"/>
  <circle cx="17" cy="21.5" r="1.7" fill="#ffffff" stroke="none"/>
  <path d="M28 21c1.8.6 3.6 1.7 5 3"/>
  <path d="M14 38c3-2.5 7-4 10-4s7 1.5 10 4" stroke-dasharray="0.5 4"/>
</svg>
```

## Datei: `public/roles/Doktoricon.svg`
````

## Datei: `public/roles/Doktoricon.svg`

````xml
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" fill="none" stroke="#ffffff" stroke-opacity="0.85" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round">
  <path d="M24 5l14 5v11c0 10-6.5 17-14 22C16.5 38 10 31 10 21V10l14-5z"/>
  <path d="M24 17v14M17 24h14"/>
</svg>
```

## Datei: `public/roles/Dorfbewohnericon.svg`
````

## Datei: `public/roles/Dorfbewohnericon.svg`

````xml
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" fill="none" stroke="#ffffff" stroke-opacity="0.85" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round">
  <path d="M8 24L24 10l16 14"/>
  <path d="M12 22v16h24V22"/>
  <path d="M20 38v-9h8v9"/>
</svg>
```

## Datei: `public/roles/Dorftrottelicon.svg`
````

## Datei: `public/roles/Dorftrottelicon.svg`

````xml
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" fill="none" stroke="#ffffff" stroke-opacity="0.85" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round">
  <path d="M8 34c2-8 4-12 8-14-1-3 0-6 3-7 2 3 5 3 7 0 2 2 2 6 0 8 4 2 8 6 10 13"/>
  <circle cx="15" cy="35.5" r="2.2"/>
  <circle cx="33" cy="35.5" r="2.2"/>
  <circle cx="24" cy="41" r="2.2"/>
  <path d="M15 34l7 5M33 34l-7 5"/>
</svg>
```

## Datei: `public/roles/Goetheicon.svg`
````

## Datei: `public/roles/Goetheicon.svg`

````xml
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" fill="none" stroke="#ffffff" stroke-opacity="0.85" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round">
  <path d="M34 6c4 0 8 3 8 8 0 9-9 20-18 26l-3-3c6-9 6-18 7-22 1-5 3-9 6-9z"/>
  <path d="M21 37l-9 5 4-10"/>
  <path d="M27 20c2 2 5 2 7 0"/>
</svg>
```

## Datei: `public/roles/Hexeicon.svg`
````

## Datei: `public/roles/Hexeicon.svg`

````xml
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" fill="none" stroke="#ffffff" stroke-opacity="0.85" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round">
  <path d="M18 8h12"/>
  <path d="M20 8v8L12 34c-1.4 2.6.6 6 4 6h16c3.4 0 5.4-3.4 4-6L28 16V8"/>
  <path d="M15 30h18"/>
  <circle cx="21" cy="34" r="1.6" fill="#ffffff" stroke="none"/>
  <circle cx="27" cy="36" r="1.3" fill="#ffffff" stroke="none"/>
</svg>
```

## Datei: `public/roles/Jägericon.svg`
````

## Datei: `public/roles/Jägericon.svg`

````xml
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" fill="none" stroke="#ffffff" stroke-opacity="0.85" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round">
  <circle cx="24" cy="24" r="14"/>
  <circle cx="24" cy="24" r="7"/>
  <circle cx="24" cy="24" r="1.8" fill="#ffffff" stroke="none"/>
  <path d="M24 4v8M24 36v8M4 24h8M36 24h8"/>
</svg>
```

## Datei: `public/roles/Kopfgeldjägericon.svg`
````

## Datei: `public/roles/Kopfgeldjägericon.svg`

````xml
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" fill="none" stroke="#ffffff" stroke-opacity="0.85" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round">
  <path d="M24 6l4.8 9.6L40 17l-8 7.8L34 36l-10-5.2L14 36l2-11.2L8 17l11.2-1.4L24 6z"/>
  <circle cx="24" cy="22" r="3.4"/>
</svg>
```

## Datei: `public/roles/Mediumicon.svg`
````

## Datei: `public/roles/Mediumicon.svg`

````xml
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" fill="none" stroke="#ffffff" stroke-opacity="0.85" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round">
  <circle cx="24" cy="22" r="13"/>
  <path d="M16 40h16M19 35h10"/>
  <path d="M19 20c1.5-2 4-2 5 0s3.5 2 5 0"/>
  <path d="M18 26c2 2.5 4 2.5 6 0s4-2.5 6 0" stroke-dasharray="1 3.5"/>
</svg>
```

## Datei: `public/roles/Sandmannicon.svg`
````

## Datei: `public/roles/Sandmannicon.svg`

````xml
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" fill="none" stroke="#ffffff" stroke-opacity="0.85" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round">
  <path d="M30 8a14 14 0 1 0 8 22A12 12 0 0 1 30 8z"/>
  <path d="M34 32h7l-7 8h7"/>
  <path d="M10 10l3 3M13 9v4M9 13h4" />
</svg>
```

## Datei: `public/roles/Sehericon.svg`
````

## Datei: `public/roles/Sehericon.svg`

````xml
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" fill="none" stroke="#ffffff" stroke-opacity="0.85" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round">
  <path d="M4 24c6-8 12-12 20-12s14 4 20 12c-6 8-12 12-20 12S10 32 4 24z"/>
  <circle cx="24" cy="24" r="7"/>
  <circle cx="24" cy="24" r="2.4" fill="#ffffff" stroke="none"/>
</svg>
```

## Datei: `public/roles/Werwolficon.svg`
````

## Datei: `public/roles/Werwolficon.svg`

````xml
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" fill="none" stroke="#ffffff" stroke-opacity="0.85" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round">
  <path d="M10 6l6 8 8-3 8 3 6-8 3 12c0 2-1 4-3 5 3 2 4 5 4 8 0 7-8 11-18 11S6 38 6 31c0-3 1-6 4-8-2-1-3-3-3-5l3-12z"/>
  <circle cx="17.5" cy="27" r="1.6" fill="#ffffff" stroke="none"/>
  <circle cx="30.5" cy="27" r="1.6" fill="#ffffff" stroke="none"/>
  <path d="M24 33l-3 3h6l-3-3z" fill="#ffffff" stroke="none"/>
  <path d="M20 38c1.5 1.2 2.7 1.8 4 1.8s2.5-.6 4-1.8"/>
</svg>
```
````
