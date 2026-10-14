# StarAFK – Werwolf-Lobby (Multiplayer)

Mehrspieler-Lobby für das Partyspiel **Werwolf** (Bonus-Modus: **Höhle der Löwen**):
Lobby erstellen, Code teilen, Freunde beitreten lassen – Spieler, Profilkarten,
Rollen-Setup und der Spielstart werden live für alle synchronisiert.

## Wie funktioniert das?

- **Frontend & Backend in einem**: Die Next.js-App liefert die Website **und** die
  komplette API (`/api/lobby/…`) aus – ein einziger Service genügt.
- **Datenbank**: Alle Lobbys und Spieler liegen in einer PostgreSQL-Datenbank
  (Drizzle ORM). Die Tabellen werden **automatisch** beim ersten Zugriff angelegt –
  es gibt nichts zu migrieren. Ohne `DATABASE_URL` startet die App **lokal**
  (`next dev`) mit einer **eingebetteten** PostgreSQL-Datenbank (PGlite, Ordner
  `.data/`). In Produktion bzw. in kleinen Containern bleibt PGlite aus – es
  belegt als WASM-PostgreSQL ~456 MB im Serverprozess und würde die
  512-MB-Instanz auf Render sofort killen (siehe „RAM-Budget“ unten).
- **Live-Sync**: Das Frontend fragt den Lobby-Zustand alle 1,2 s ab (im
  Hintergrund-Tab alle 20 s). Spieler ohne Lebenszeichen fliegen nach 2 Minuten
  raus; der Host wird automatisch weitergegeben.
- **Reconnect**: Wer den Tab neu lädt oder kurz die Verbindung verliert, landet
  automatisch wieder in **derselben** Lobby (gleiche Spieler-ID, Host-Rolle bleibt).
  Verliert die Datenbank eine Lobby (z. B. Render-Neustart ohne externe DB),
  öffnet der Host sie mit **demselben Code** neu – die Freunde landen über ihr
  Resume-Polling automatisch wieder drin.
- **Schnell**: Profilbilder werden im Browser auf max. 256 px verkleinert und
  über `GET /api/lobby/avatar?pid=…&v=…` mit langem Browser-Cache ausgeliefert.
  Der Lobby-Zustand ist dadurch nur wenige Kilobyte groß (statt mehrerer Megabyte
  pro Abfrage).
- **Selbstheilend**: Schlägt die Datenbank fehl, baut das Backend die Verbindung
  automatisch neu auf (`src/db/index.ts`); `/api/health` zeigt Modus, Speicherart
  und Fehlerzähler.
- **Die Seite bleibt immer erreichbar**: `/api/health` prüft die Datenbank
  **im Hintergrund** und antwortet sofort (immer HTTP 200, solange der Server
  lebt). Hintergrund: Render bricht seinen Health-Check nach **5 s** ab. Wartet
  die Route selbst auf die Datenbank, gilt die Instanz bei einer langsamen oder
  kurz nicht erreichbaren Datenbank als „kaputt“: Render startet sie neu, der
  nächste Check läuft wieder ins Zeitlimit – die Seite bleibt dann dauerhaft
  mit **502 „This service is currently unavailable“** weg, obwohl sie selbst in
  Millisekunden antworten würde (gemessen: 34 s Health-Antwort bei
  nicht erreichbarer Datenbank, Startseite gleichzeitig 17 ms).

## Render + Datenbank: läuft automatisch (nichts einzurichten)

**Du musst nichts von Hand einrichten.** Die `render.yaml` (Blueprint) im Repo
sorgt dafür, dass Render beim Deploy beides anlegt: den Web-Service **und**
eine PostgreSQL-Datenbank (`starafk-db`). Ihr Verbindungs-String landet
automatisch als `AUTO_DATABASE_URL` im Service, die App legt alle Tabellen
beim ersten Zugriff selbst an. Lobbys überleben damit Deploys und Neustarts,
und „Lobby erstellen" funktioniert sofort.

Reihenfolge, in der die App ihre Datenbank wählt (`src/db/index.ts`):

1. **`DATABASE_URL`** – eine eigene Datenbank, z. B. **Neon**. Sobald diese
   Variable gesetzt ist, gewinnt sie immer (Neon wird am Hostnamen erkannt,
   TLS geht automatisch an, ein `channel_binding=require` aus dem
   Neon-Dashboard wird verträglich entfernt).
2. **`AUTO_DATABASE_URL`** – die von Render automatisch provisionierte
   Datenbank aus der Blueprint (Standard, ganz ohne Einrichtung).
3. **PGlite** eingebettet (`.data/`) – nur für lokale Entwicklung ohne DB
   (`next dev`). In Produktion und in Containern unter 900 MB bleibt PGlite
   **aus**, weil es den RAM-Rahmen sprengt (Messwerte unten). Notausgang für
   große Instanzen: `PGLITE_IN_PRODUCTION=1`.

**Neon dauerhaft nutzen (optional):** Die kostenlose Render-Datenbank wird
nach 30 Tagen gelöscht, Neon verfällt nicht. Für Neon nur einmalig im
Render-Dashboard (Service → Environment) `DATABASE_URL` mit dem Neon
Connection String setzen
(`postgresql://…@ep-….eu-central-1.aws.neon.tech/neondb?sslmode=require`) –
ab dem nächsten (automatischen) Deploy nutzt die App Neon, ganz ohne
Codeänderung. Ein Konto bei Neon kann dir niemand abnehmen; angelegt ist es
in ~2 Minuten auf [neon.tech](https://neon.tech) (keine Kreditkarte nötig).

Prüfen kannst du alles unter `https://<deine-domain>/api/health`:
`"ok": true` plus `"provider": "neon" | "postgres"` heißt: Backend und
externe Datenbank laufen. Die Seite selbst bleibt auch bei einer gerade
aufwachenden/kurz nicht erreichbaren Datenbank aufrufbar – der Health-Check
antwortet dann `ok: false` mit Fehlertext in `status.lastError`, statt dass
Render die Instanz in einer Neustart-Schleife festhält.

Antwort von `/api/health` (Beispiel):

```json
{
  "ok": true, "starting": false, "db": "postgres", "provider": "postgres",
  "status": { "mode": "postgres", "provider": "postgres", "storage": "external",
              "ready": true, "failures": 0, "resets": 0 },
  "services": { "postgres": "postgres", "auth": false, "objectStorage": false,
                "aiGateway": false, "functions": false },
  "check": { "running": false, "checkedAt": "2026-10-14T15:55:35.645Z",
             "ageMs": 1234, "latencyMs": 3 }
}
```

`ok` ist das Ergebnis der letzten Hintergrundprüfung, `check.checkedAt` ihr
Zeitpunkt (`starting: true` = die allererste Prüfung läuft noch). Wie oft im
Hintergrund geprüft wird, bestimmt `HEALTH_CHECK_INTERVAL_MS`
(Standard 60000 = 1 Minute).

Fehlt auf Render die Datenbank (PGlite bleibt dann aus RAM-Gründen blockiert),
steht die komplette Erklärung zusätzlich in `status.notice`:

```json
{
  "ok": false, "db": "pglite", "provider": "pglite",
  "status": { "mode": "pglite", "storage": "none", "ready": false,
              "failures": 0, "resets": 0,
              "notice": "NODE_ENV=production – PGlite würde ~456 MB RAM belegen … Bitte DATABASE_URL … setzen." }
}
```

`failures`/`resets` bleiben dabei bewusst bei 0: Ein Konfigurationsfehler wird
nicht als „Verbindung kaputt“ gezählt (ein Neuaufbau würde ihn nicht heilen).

> **Kein Datenbank-Download nötig.** Falls du wirklich offline/lokal spielen
> willst: Die eingebettete PGlite-Datenbank liegt als normaler Ordner unter
> `.data/pglite` und wird automatisch erzeugt – die „herunterzuladende Datenbank"
> ist also einfach mit im Projekt. Nichts zu installieren.
> **Ausnahme Produktion/Render:** Dort bleibt PGlite aus (RAM), es braucht eine
> `DATABASE_URL` bzw. `AUTO_DATABASE_URL` – Details im nächsten Abschnitt.

## RAM-Budget: 512 MB auf Render (gemessen, nicht geschätzt)

Die Free-Instanz hat **512 MB RAM**. Alle Zahlen unten sind echte Messungen mit
`process.memoryUsage.rss()` bzw. `VmRSS` aus `/proc` auf Node 22 – nachvollziehbar
mit `node scripts/measure-ram.mjs` (siehe „RAM selbst messen“).

### Die Absturzursache: PGlite im Serverprozess

Ohne `DATABASE_URL`/`AUTO_DATABASE_URL` startete die App die **eingebettete**
PostgreSQL (PGlite). Die läuft als WASM **im selben Node-Prozess** wie Next.js:

| Szenario | Boot | Dauerlauf | Spitze |
| --- | --- | --- | --- |
| **alter Stand**, `next start` ohne DB-URL → PGlite | 168 MB | **596 MB** | **758 MB** ❌ |
| davon isoliert: `new PGlite(); await waitReady` | – | **+456 MB** | – |
| **alter Stand**, `next start` mit `DATABASE_URL` | 141 MB | 146 MB | – ✅ |
| **jetzt**, mit `DATABASE_URL` | **130 MB** | **133 MB** | **151 MB** ✅ |
| **jetzt**, ohne DB-URL → PGlite blockiert | **130 MB** | **133 MB** | **148 MB** ✅ |
| **jetzt**, PGlite erzwungen (`PGLITE_IN_PRODUCTION=1`) | 135 MB | 474 MB | 653 MB ❌ |

Messbedingungen: `next start` (Produktions-Build), 12 simulierte Spieler mit
dem echten 1,2-s-Polling, 20 s pro Szenario, `VmRSS` aus `/proc` alle 250 ms –
 reproduzierbar mit `node scripts/measure-ram.mjs`. Die Zeilen „alter Stand“
sind mit 6 bzw. 0 Pollern gemessen; entscheidend ist die Größenordnung.

596 MB Dauerlauf (und 758 MB Spitze) gegen ein 512-MB-Limit = der Container
wird vom Kernel gekillt (OOM). Im Render-Dashboard sieht das aus wie ein
Neustart ohne verwertbare Fehlermeldung, weil V8 sein Heap-Limit nach dem RAM
des **Hosts** richtet (hier gemessen: 1954 MB) und nicht nach dem cgroup-Limit
des Containers.

### Was dagegen jetzt eingebaut ist

1. **PGlite-Schutz** (`pglitePolicy()` in `src/db/index.ts`): PGlite startet
   nicht mehr, wenn `NODE_ENV=production` ist **oder** der Container weniger
   als `PGLITE_MIN_MEMORY_MB` (Standard 900) RAM meldet
   (`process.constrainedMemory()`). Notausgang: `PGLITE_IN_PRODUCTION=1`
   (nur auf Instanzen mit ≥ 1 GB sinnvoll).
   → Die Seite bleibt erreichbar (Startseite HTTP 200 in ~12 ms), nur die
   Lobby-API meldet einen klaren Fehler. Die Ursache steht **ohne Logsuche** in
   `/api/health` unter `status.notice` und einmalig in den Render-Logs.
2. **PGlite wird lazy geladen**: `import("@electric-sql/pglite")` statt statischem
   Import. Vorher lud jeder Server-Chunk, der `@/db` importiert (alle API-Routen
   **und** der Instrumentation-Hook), das PGlite-Modul samt WASM-Lader – auch
   wenn längst eine externe Datenbank lief.
3. **AWS-SDK wird lazy geladen** (`src/lib/storage.ts`): `@aws-sdk/client-s3`
   wird von Next.js zwar nicht gebündelt (es steht in Next' eigener
   `server-external-packages.jsonc`), aber ein **statischer** Import führt das
   `require` beim Initialisieren des Moduls aus – und `storage.ts` liegt im
   Startpfad (`instrumentation.ts` → `lib/health.ts` → `lib/storage.ts`, weil
   health.ts `storageEnabled` liest). Das SDK lag also bei jedem Serverstart im
   Speicher, auch ohne konfigurierten Bucket. Jetzt steht es in einem
   `import()`-Ausdruck und wird ohne `AWS_*`-Variablen **nie** geladen.
   A/B-gemessen (sonst identischer Build): Boot **138–139 MB → 131 MB**,
   Spitze 154 → 150 MB. Ein zusätzlicher Eintrag in `serverExternalPackages`
   war dafür **nicht** nötig und ist deshalb nicht enthalten.
4. **Heap-Grenze** (`start`-Skript in `package.json`,
   `NODE_MAX_OLD_SPACE_MB`, Standard 384): V8 mistet jetzt aus, **bevor** der
   Container killt. Ein echtes Leck meldet sich als „Reached heap limit“ in den
   Logs statt als lautloser OOM-Neustart. Betrifft nur den Laufzeitprozess –
   der Build läuft unverändert.
5. **Keine Timer-/Listener-Lecks**: Der 15-s-Timeout des Datenbank-Vorlaufs wird
   jetzt freigegeben (`clearTimeout`), der Health-Monitor bleibt ein einzelner
   `unref()`-Intervall (durch `globalThis`-Zustand gegen Next.js-Hot-Reload
   abgesichert), und derselbe Konfigurationsfehler wird nicht mehr bei jedem
   Prüfintervall neu geloggt.

### Geprüft und **nicht** als Ursache befunden

Damit nichts „auf Verdacht“ umgebaut wurde – diese Punkte sind gemessen bzw.
am Code belegt unkritisch:

- **Kein Socket.IO / keine WebSockets.** Die Live-Synchronisation läuft über
  REST-Polling (`/api/lobby/state`, 1,2 s sichtbar / 20 s im Hintergrund-Tab).
  Es gibt also keine Server-Instanz, pro Verbindung keine Sockets und keine
  Adapter/Rooms, die Speicher halten könnten.
- **Keine unbegrenzt wachsenden Arrays/Maps/Caches im Server.** Lobby- und
  Spielzustand liegen vollständig in PostgreSQL, nicht im Prozess. Die einzigen
  prozessinternen Strukturen sind: zwei Zeitstempel (`lastCleanupAt`,
  `lastPurgeAt`), ein Zähler-Objekt auf `globalThis` und eine `WeakMap` für die
  Schema-Initialisierung (schwach referenziert, kann nicht wachsen).
- **Spielräume werden aufgeräumt** – in der Datenbank, nicht im RAM:
  Spieler ohne Lebenszeichen nach `LOBBY_STALE_MS` (120 s), leere Lobbys nach
  10 min Gnadenfrist, Lobbys älter als 24 h beim nächsten Erstellen.
- **Request-Stau ist kein RAM-Problem.** 300 parallele Anfragen gegen eine
  hängende Datenbank: **+26 MB** (143 → 169 MB). Kein Grund, am Polling oder
  am Verbindungspool etwas zu ändern – Multiplayer-Verhalten bleibt unangetastet.
- **Auth-Import beim Start**: nur ~2 MB (124 vs. 126 MB Boot-RSS im A/B-Test) →
  der funktionierende Login-Code wurde bewusst **nicht** umgebaut.
- **Statische Dateien** (`public/`, 6,5 MB) werden von der Festplatte gestreamt
  und nicht im RAM gehalten. Profilbilder sind über
  `/api/lobby/avatar?pid=…&v=…` mit `immutable`-Header 7 Tage im Browser-Cache,
  werden also nicht bei jeder Statusabfrage neu übertragen.

### RAM selbst messen

```bash
npm run build
node scripts/measure-ram.mjs                     # alle drei Szenarien
node scripts/measure-ram.mjs --scenario blocked  # nur „ohne DB“
node scripts/measure-ram.mjs --players 24 --seconds 60
node scripts/measure-ram.mjs --with-build        # zusätzlich Build-Spitze
```

Das Skript startet den gebauten Server, legt eine Lobby an (wenn die Datenbank
mitspielt), simuliert `--players` Spieler mit dem echten 1,2-s-Polling und
protokolliert Boot-, Dauerlauf-, Durchschnitts- und Spitzen-RSS samt
`/api/health`-Antwort. Es vergleicht die Spitze automatisch mit
`RENDER_MEMORY_LIMIT_MB` (Standard 512).

Auf Render selbst: **Service → Metrics → Memory** zeigt denselben RSS-Wert;
**Logs** enthalten beim Start eine Zeile `[start] Datenbank: …` bzw.
`[start] KEINE Datenbank nutzbar: …`. Zusätzlich liefert
`https://<deine-domain>/api/health` mit `status.mode/provider/storage/notice`
die Antwort ohne Dashboard.

Einordnung der Build-Spitze: `npm run build` erreicht hier ~1,3 GB
(davon ~400 MB der TypeScript-Worker; ohne TS-Check ~886 MB). Der Build läuft
auf Render als eigener Schritt und teilt sich das 512-MB-Limit des
Laufzeitprozesses nicht. Falls dein **Deploy** (nicht die laufende App) mit
OOM abbricht, ist das die Stellschraube – dann lohnt `next build` mit
`typescript.ignoreBuildErrors` zu prüfen oder der Render-Support-Beleg aus
`node scripts/measure-ram.mjs --with-build`.

## Seite zeigt „502 – This service is currently unavailable“

Das heißt: Render bekommt keine Antwort **oder** die Instanz fällt durch die
Health-Checks (Render bricht `/api/health` nach **5 s** ab und startet die
Instanz bei wiederholten Fehlern neu – dann bleibt die Seite dauerhaft weg).

Die App ist dagegen gebaut: `/api/health` wartet **nie** auf die Datenbank,
sondern antwortet sofort aus dem letzten geprüften Zustand (die
Datenbankprüfung läuft im Hintergrund). Trotzdem kurz durchgehen:

1. **Render-Logs öffnen** (Dashboard → Service → Logs, Filter `level: error`).
   Dort steht, ob der Build fehlgeschlagen ist oder woran die Instanz stirbt.
2. **Letzten Deploy prüfen** (Dashboard → Deploys): steht dort „Deploy failed",
   steht die Ursache in den Build-Logs (meist ein `npm ci`/Dependency-Problem).
3. **Health-Check-Pfad** (Settings): `/api/health`. Die Route antwortet immer
   mit 200 – fällt sie trotzdem aus, hängt der Server selbst (Logs!).
4. **Free-Instanz schläft**: der erste Aufruf nach 15 Minuten Pause dauert
   ~30–50 s. Einfach noch einmal neu laden.

Zur Not kann der Health-Check im Dashboard vorübergehend entfernt werden –
Render prüft dann nur per TCP, ob der Port offen ist.

## Lobby erstellen geht nicht / „Fehlercode" auf Render – Checkliste

1. **Health prüfen**: `https://<deine-domain>/api/health`
   - `{"ok":true,"db":"pglite"|"postgres","ready":true,…}` → Backend & Datenbank laufen.
   - `"ok":false` + `"lastError"` → der Fehlertext steht direkt in der Antwort
     (z. B. falsche `DATABASE_URL`).
2. **Erster Aufruf nach dem Einschlafen**: Free-Instanzen brauchen **30–50 s**.
   Die App zeigt in dieser Zeit „Der Server startet gerade (Free-Instanz) …" und
   wartet bis zu 35 s – einfach noch einmal klicken. Beim Laden der Seite wird
   der Server schon im Hintergrund aufgeweckt.
3. **Build/Start-Einstellungen** im Render-Dashboard (Settings):

   | Einstellung | Wert |
   | --- | --- |
   | Runtime | Node |
   | Build Command | `npm ci && npm run build` |
   | Start Command | `npm run start` |
   | Health Check Path | `/api/health` |
   | Environment | nichts nötig (DB kommt automatisch aus der Blueprint; optional `DATABASE_URL` = Neon) |

4. **„Lobby existiert nicht mehr"** nach einem Neustart ohne externe Datenbank:
   Der Host kann die Lobby mit demselben Code neu öffnen – die App macht das
   automatisch, sobald der Host-Tab es merkt (innerhalb weniger Sekunden).
5. **Kein Weißbildschirm/„Fehler" mehr bei kurzen Hängern**: Verbindungsabbrüche
   werden jetzt abgefangen (Badge „Verbindung wird wiederhergestellt …"), statt
   den Spieler sofort aus der Lobby zu werfen.

## Neon-Setup (Postgres, Auth, Object Storage, AI Gateway, Functions)

Die App ist auf **Neon** verdrahtet: Datenbank, Login, Profilbild-Speicher, die
AI-Game-Master-Texte und deren Serverless-Endpunkte kommen aus einem Projekt.
`neon.ts` deklariert die Dienste (Infrastructure as Code), `neon deploy`
provisioniert sie und schreibt die Zugangsdaten in `.env.local`.

| Dienst | Verwendung in der App | Variablen |
| --- | --- | --- |
| **Neon Postgres** | Lobbys, Spieler, Game-Master-Texte (Drizzle ORM + `pg`) | `DATABASE_URL`, `DATABASE_URL_UNPOOLED` |
| **Neon Auth** (Managed Better Auth) | Anmeldung; ohne Session kein Lobby-Beitritt | `NEON_AUTH_BASE_URL`, `NEON_AUTH_JWKS_URL`, `NEON_AUTH_COOKIE_SECRET` |
| **Neon Object Storage** | Profilbilder im Bucket `assets` (`avatars/<player-id>/…`) | `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `AWS_ENDPOINT_URL_S3`, `AWS_REGION` |
| **Neon AI Gateway** | Texte des AI Game Masters | `NEON_AI_GATEWAY_BASE_URL`, `NEON_AI_GATEWAY_TOKEN` |
| **Neon Functions** | Function `gamemaster` (`functions/gamemaster.ts`) mit `/narration` + `/health` | `NEON_FUNCTION_GAMEMASTER_BASE_URL` |

### Einrichtung (auf einem Rechner mit Neon-Zugang)

```bash
npm i -g neon@latest          # Neon CLI
neon login                    # Browser-Sign-in

# Projekt verknüpfen (Org/Projekt stehen unten) und Dienste deployen:
neon link --project-id broad-thunder-03529066 --branch production -y
neon deploy                   # provisioniert neon.ts + zieht die Variablen in .env.local

# App-Secret für den Session-Cookie (wird NICHT von Neon injiziert):
echo "NEON_AUTH_COOKIE_SECRET=$(openssl rand -base64 32)" >> .env.local

npm run build && npm run start
```

> **Region:** Auth, Functions, Object Storage und AI Gateway laufen nur in
> `aws-us-east-1`, `aws-us-east-2`, `aws-eu-central-1` und `aws-ap-southeast-1`.
> Ein Projekt außerhalb dieser Regionen unterstützt diese Dienste nicht.

> **Trusted Domain:** Neon Auth leitet nur auf registrierte Origins um.
> `localhost` ist voreingestellt; für Deployments einmalig
> `neon neon-auth domain add https://<deine-domain>` ausführen.

### Prüfen, dass alles läuft

```bash
node --env-file=.env.local scripts/verify-neon.mjs   # echter Branch: DB, Auth, Bucket, Gateway, Function
npm run test:e2e                                     # lokaler E2E-Test ohne Neon (Mocks, siehe unten)
```

`/api/health` zeigt jederzeit, was verdrahtet ist:

```json
{ "ok": true, "db": "postgres",
  "services": { "postgres": "postgres", "auth": true, "objectStorage": "bucket:assets",
                "aiGateway": true, "functions": true } }
```

**Ohne Neon-Zugangsdaten bleibt alles lauffähig:** ohne `DATABASE_URL` läuft die
eingebettete PGlite-Datenbank, ohne Auth-Variablen bleibt der Login aus (die App
spielt dann anonym wie vorher), ohne `AWS_*` werden Profilbilder als Data-URL in
Postgres gespeichert.

### AI Game Master

Der Game Master ist eine **Neon Function** (`functions/gamemaster.ts`, Slug
`gamemaster`): Der Browser holt sich ein kurzlebiges JWT aus der Neon-Auth-
Session (`authClient.token()`), ruft die Function **direkt** auf (`POST
<narration-URL>` mit `Authorization: Bearer …`) und die Function

1. prüft das JWT gegen die Branch-JWKS (`NEON_AUTH_JWKS_URL`),
2. liest Lobby, Spieler und Rollen-Setup aus Postgres,
3. fragt das **AI Gateway** (`/v1/models` → Modellwahl, dann
   `/v1/chat/completions`) nach einem deutschen Text,
4. schreibt den Text in `game_master_lines` – von dort holt ihn das Lobby-Polling
   und zeigt ihn **allen** Spielern in der Karte „AI Game Master“.

Modell: automatisch das schnellste verfügbare (bevorzugt `…mini`/`flash`/
`haiku`). Festlegen lässt sich eines über `GAMEMASTER_MODEL` – dann zusätzlich in
`neon.ts` unter `functions.gamemaster.env` deklarieren und erneut deployen.

### Lokaler E2E-Test (`npm run test:e2e`)

Weil dieser Sandkasten keinen Zugang zu Neon hat, startet der Test Neon-ähnliche
Dienste lokal und prüft die echten Codepfade der App:

- **Phase A** – App ohne Neon (PGlite, Data-URL-Avatare): Lobby-Flow, Rollen,
  Spielstart, Profilbild, Verlassen.
- **Phase B** – App mit „Neon": Postgres über echtes Wire-Protokoll
  (`@electric-sql/pglite-socket`), `DATABASE_URL`-Pfad, Neon Auth (Sign-up,
  Session, JWT, 401-Schutz), S3-kompatibler Bucket (AWS SDK, Path-Style),
  OpenAI-kompatibles Gateway und die echte Function `gamemaster` – inklusive
  Zusammenspiel: Function → Gateway → Postgres → Live-Zustand der Lobby.

Die Attrappen liegen in `scripts/dev-mocks.mjs` und werden nur für Tests benutzt.

## Optional: lokale/externe Datenbank konfigurieren

| Umgebungsvariable | Bedeutung |
| --- | --- |
| `DATABASE_URL` | PostgreSQL-Verbindungsstring (z. B. Neon). Hat Vorrang vor `AUTO_DATABASE_URL`; ohne beides läuft PGlite eingebettet. |
| `AUTO_DATABASE_URL` | Von der Render-Blueprint automatisch provisionierte Datenbank (`render.yaml` → `starafk-db`) – muss nie von Hand gesetzt werden. |
| `DATABASE_SSL` | `true`/`false` erzwingt bzw. deaktiviert TLS (Standard: automatisch – TLS bei bekannten Anbietern und bei `sslmode=…` im String). |
| `DATABASE_POOL_MAX` | Größe des Verbindungspools (Standard 4). |
| `PGLITE_DIR` | Ablageort der eingebetteten Datenbank (Standard `.data/pglite`). |
| `PGLITE_IN_PRODUCTION` | `1` = PGlite trotz Produktion/kleinem Container starten (Notausgang, braucht ≥ 1 GB RAM – gemessen 596–758 MB). |
| `PGLITE_MIN_MEMORY_MB` | Schwelle der automatischen RAM-Erkennung (Standard 900). Meldet der Container weniger, bleibt PGlite aus. |
| `NODE_MAX_OLD_SPACE_MB` | V8-Heap-Grenze des Laufzeitprozesses (Standard 384, gesetzt vom `start`-Skript) – sorgt dafür, dass V8 vor dem 512-MB-Containerkill aufräumt. |
| `LOBBY_STALE_MS` | Lebenszeichen-Fenster in ms (Standard 120000). |
| `HEALTH_CHECK_INTERVAL_MS` | Abstand der Datenbankprüfung im Hintergrund in ms (Standard 60000). `/api/health` antwortet unabhängig davon immer sofort. |
| `NEON_AUTH_*` | Neon Auth (siehe Neon-Setup) – ohne sie bleibt der Login aus. |
| `AWS_*` | Neon Object Storage – ohne sie liegen Profilbilder als Data-URL in Postgres. |
| `NEON_AI_GATEWAY_*`, `NEON_FUNCTION_GAMEMASTER_BASE_URL` | AI Game Master – ohne sie wird die Karte als „nicht konfiguriert“ angezeigt. |

## Lokal testen

```bash
npm install
npm run dev        # http://localhost:3000 – läuft OHNE jede Datenbank-Vorbereitung
```

Auch lokal greift der Fallback: ohne `DATABASE_URL` entsteht automatisch
`.data/pglite` (eine echte PostgreSQL-Instanz im Projektordner). In `next dev`
ist `NODE_ENV=development`, der PGlite-RAM-Schutz greift dort also **nicht** –
lokales Arbeiten bleibt unverändert. Erst `next start` (Produktion) verlangt
eine echte Datenbank oder `PGLITE_IN_PRODUCTION=1`.

```bash
npm run typecheck                 # TypeScript-Prüfung
npm run test:e2e                  # End-to-End: Phase A (PGlite) + Phase B (Neon-Dienste)
node scripts/measure-ram.mjs      # RAM-Messung gegen das 512-MB-Limit
```

## API-Übersicht

| Endpunkt | Methode | Zweck |
| --- | --- | --- |
| `/api/health` | GET | Status, Datenbankmodus, Fehlerzähler, verdrahtete Neon-Dienste |
| `/api/config` | GET | Laufzeit-Konfiguration für den Browser (Login aktiv? Game-Master-URL) |
| `/api/auth/*` | GET/POST/… | Neon Auth (Sign-up, Sign-in, Session, Sign-out, JWT) – Proxy zum Managed-Auth-Server |
| `/api/lobby/create` | POST | Lobby anlegen (6-stelliger Code; optional `code`/`playerId` zum Wiederherstellen) |
| `/api/lobby/join` | POST | Beitreten (`max. 12 Spieler`); mit `playerId` = Reconnect/Resume |
| `/api/lobby/state` | GET | Zustand abfragen (Polling, Heartbeat) |
| `/api/lobby/profile` | POST | Profil syncen (Name, Farbe, Verlauf, Rahmen – ohne Bild) |
| `/api/lobby/avatar` | POST | Profilbild hochladen/entfernen (`image: null`) |
| `/api/lobby/avatar` | GET | Profilbild laden (`?pid=…&v=…`, langer Browser-Cache) |
| `/api/lobby/roles` | POST | Rollen-Setup ändern (nur Host) |
| `/api/lobby/start` | POST | Spiel starten/zurücksetzen (nur Host) |
| `/api/lobby/leave` | POST | Lobby verlassen |

Einladungslinks haben die Form `https://<deine-domain>/?code=ABCDEF` und öffnen
das Beitreten-Feld vorausgefüllt.

## Architektur in Kürze

```
neon.ts                Neon Infrastructure as Code (Auth, AI Gateway, Function, Bucket)
functions/gamemaster.ts Neon Function: AI-Game-Master-Endpunkte (JWT-geschützt)
src/
  app/api/…            REST-Routen (dünn: Parameter prüfen, Service aufrufen)
  app/api/auth/…       Neon-Auth-Proxy (/api/auth/*)
  app/page.tsx         Seite → AuthGate → WerwolfApp
  components/auth/     Anmeldebildschirm + Login-Schranke
  components/werwolf/  UI (Menü, Lobby, Rollen-Modal, Profilkarte, AI-Game-Master-Karte)
  lib/api.ts           einheitlicher Route-Rahmen (Logging, Fehler, Selbstheilung)
  lib/auth/            Neon Auth (Server-Session, Browser-Client, 401-Guard)
  lib/storage.ts       Neon Object Storage (Put/Get/Delete – S3-SDK wird lazy geladen)
  lib/game-master.ts   Function-URL + Beschriftungen für den AI Game Master
  lib/lobby-service.ts Lobby-Logik (Lobbys, Spieler, Rollen, Avatare, Resume, Narration)
  lib/image.ts         Prüfen/Zerlegen der Profilbild-Data-URLs
  db/index.ts          Verbindung (extern via DATABASE_URL oder PGlite) + Selbstheilung
                       + RAM-Schutz `pglitePolicy()` (PGlite lazy, in Produktion blockiert)
  db/migrate.ts        idempotentes Schema (CREATE TABLE IF NOT EXISTS …)
  db/schema.ts         Drizzle-Tabellen (inkl. user_id, image_key, game_master_lines)
  instrumentation.ts   Datenbank-Vorlauf beim Serverstart + Startmeldung zum DB-Plan
scripts/
  measure-ram.mjs      RAM-Messung: Boot/Dauerlauf/Spitze gegen das 512-MB-Limit
  verify-neon.mjs      Prüft den echten Neon-Branch (DB, Auth, Bucket, Gateway, Function)
  e2e-local.mjs        End-to-End-Test ohne Neon (Phase A/B, siehe oben)
  dev-mocks.mjs        Lokale Attrappen (Postgres-Socket, S3, Gateway, Auth)
```

**Nicht Teil des Builds** (liegen nur noch als Referenz im Repo und stehen in
`tsconfig.json` unter `exclude`, damit `next build` sie nicht mitprüft):
`src/App.tsx`, `src/main.tsx`, `src/index.css`, `index.html`, `vite.config.ts` –
das ist der alte Vite-Standalone-Stand der App. Next.js rendert ausschließlich
`src/app/page.tsx` → `src/components/werwolf/werwolf-app.tsx`. Kein npm-Skript
ruft Vite auf; die Vite-DevDependencies sind entsprechend entfernt. Falls Vite
je wieder gebraucht wird:
`npm i -D vite @vitejs/plugin-react vite-plugin-singlefile @tailwindcss/vite`.
