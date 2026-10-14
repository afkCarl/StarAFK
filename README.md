# StarAFK – Werwolf-Lobby (Multiplayer)

Mehrspieler-Lobby für das Partyspiel **Werwolf** (Bonus-Modus: **Höhle der Löwen**):
Lobby erstellen, Code teilen, Freunde beitreten lassen – Spieler, Profilkarten,
Rollen-Setup und der Spielstart werden live für alle synchronisiert.

## Wie funktioniert das?

- **Frontend & Backend in einem**: Die Next.js-App liefert die Website **und** die
  komplette API (`/api/lobby/…`) aus – ein einziger Service genügt.
- **Datenbank**: Alle Lobbys und Spieler liegen in einer PostgreSQL-Datenbank
  (Drizzle ORM). Die Tabellen werden **automatisch** beim ersten Zugriff angelegt –
  es gibt nichts zu migrieren. Ohne `DATABASE_URL` startet die App mit einer
  **eingebetteten** PostgreSQL-Datenbank (PGlite, Ordner `.data/`).
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

## Empfehlung für Render: externe Datenbank in 3 Minuten (kostenlos)

**Das ist der wichtigste Punkt für ein stabiles Multiplayer-Spiel.** Render
verwendet für Web-Services ein **flüchtiges Dateisystem**: Bei jedem Deploy und
jedem Neustart ist die eingebettete Datenbank leer (Free-Instanzen werden zudem
nach ~15 min Inaktivität schlafen gelegt und regelmäßig neu gestartet). Genau
daher kam bisher „irgendwann" ein Fehler: Die Lobby war nach einem Neustart weg.

Mit einer externen Datenbank überleben Lobbys jeden Neustart:

1. Kostenlose PostgreSQL-Datenbank anlegen – am schnellsten bei
   [Neon](https://neon.tech) (kein Kreditkarte nötig, verfällt nicht):
   - Registrieren → „Create project" → Region z. B. Frankfurt wählen.
   - Im Dashboard den **Connection String** kopieren, er sieht so aus:
     `postgresql://user:passwort@ep-xyz.eu-central-1.aws.neon.tech/neondb?sslmode=require`
   - Alternativen: [Supabase](https://supabase.com) (Project Settings →
     Database → Connection String) oder **Render PostgreSQL** (im selben
     Dashboard; im kostenlosen Plan verfällt die Datenbank nach 30 Tagen).
2. In **Render** → deinen Service → **Environment** → **Add Environment Variable**:
   - Key: `DATABASE_URL`
   - Value: der kopierte Connection String (mit `?sslmode=require`)
3. **Manual Deploy → Deploy latest commit**.

Fertig. Prüfen kannst du es unter `https://<deine-domain>/api/health` – dort
muss jetzt `"db": "postgres"` stehen (und `"ready": true`). Ab dann gilt: Lobbys
überleben Deploys, Neustarts und das Einschlafen der Free-Instanz.

> **Kein Datenbank-Download nötig.** Falls du wirklich offline/lokal spielen
> willst: Die eingebettete PGlite-Datenbank liegt als normaler Ordner unter
> `.data/pglite` und wird automatisch erzeugt – die „herunterzuladende Datenbank"
> ist also einfach mit im Projekt. Nichts zu installieren.

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
   | Environment | `DATABASE_URL` (empfohlen, siehe oben) |

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
| `DATABASE_URL` | PostgreSQL-Verbindungsstring. Ohne sie läuft PGlite eingebettet. |
| `DATABASE_SSL` | `true`/`false` erzwingt bzw. deaktiviert TLS (Standard: automatisch – TLS bei bekannten Anbietern und bei `sslmode=…` im String). |
| `DATABASE_POOL_MAX` | Größe des Verbindungspools (Standard 4). |
| `PGLITE_DIR` | Ablageort der eingebetteten Datenbank (Standard `.data/pglite`). |
| `LOBBY_STALE_MS` | Lebenszeichen-Fenster in ms (Standard 120000). |
| `NEON_AUTH_*` | Neon Auth (siehe Neon-Setup) – ohne sie bleibt der Login aus. |
| `AWS_*` | Neon Object Storage – ohne sie liegen Profilbilder als Data-URL in Postgres. |
| `NEON_AI_GATEWAY_*`, `NEON_FUNCTION_GAMEMASTER_BASE_URL` | AI Game Master – ohne sie wird die Karte als „nicht konfiguriert“ angezeigt. |

## Lokal testen

```bash
npm install
npm run dev        # http://localhost:3000 – läuft OHNE jede Datenbank-Vorbereitung
```

Auch lokal greift der Fallback: ohne `DATABASE_URL` entsteht automatisch
`.data/pglite` (eine echte PostgreSQL-Instanz im Projektordner).

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
  lib/storage.ts       Neon Object Storage (S3Client, Put/Get/Delete)
  lib/game-master.ts   Function-URL + Beschriftungen für den AI Game Master
  lib/lobby-service.ts Lobby-Logik (Lobbys, Spieler, Rollen, Avatare, Resume, Narration)
  lib/image.ts         Prüfen/Zerlegen der Profilbild-Data-URLs
  db/index.ts          Verbindung (extern via DATABASE_URL oder PGlite) + Selbstheilung
  db/migrate.ts        idempotentes Schema (CREATE TABLE IF NOT EXISTS …)
  db/schema.ts         Drizzle-Tabellen (inkl. user_id, image_key, game_master_lines)
  instrumentation.ts   Datenbank-Vorlauf beim Serverstart
scripts/
  verify-neon.mjs      Prüft den echten Neon-Branch (DB, Auth, Bucket, Gateway, Function)
  e2e-local.mjs        End-to-End-Test ohne Neon (Phase A/B, siehe oben)
  dev-mocks.mjs        Lokale Attrappen (Postgres-Socket, S3, Gateway, Auth)
```
