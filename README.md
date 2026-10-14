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

## Optional: lokale/externe Datenbank konfigurieren

| Umgebungsvariable | Bedeutung |
| --- | --- |
| `DATABASE_URL` | PostgreSQL-Verbindungsstring. Ohne sie läuft PGlite eingebettet. |
| `DATABASE_SSL` | `true`/`false` erzwingt bzw. deaktiviert TLS (Standard: automatisch – TLS bei bekannten Anbietern und bei `sslmode=…` im String). |
| `DATABASE_POOL_MAX` | Größe des Verbindungspools (Standard 4). |
| `PGLITE_DIR` | Ablageort der eingebetteten Datenbank (Standard `.data/pglite`). |
| `LOBBY_STALE_MS` | Lebenszeichen-Fenster in ms (Standard 120000). |

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
| `/api/health` | GET | Status, Datenbankmodus, Speicherart, Fehlerzähler |
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
src/
  app/api/…            REST-Routen (dünn: Parameter prüfen, Service aufrufen)
  app/page.tsx         Seite → WerwolfApp
  components/werwolf/  UI (Menü, Lobby, Rollen-Modal, Profilkarte)
  lib/api.ts           einheitlicher Route-Rahmen (Logging, Fehler, Selbstheilung)
  lib/lobby-service.ts Lobby-Logik (Lobbys, Spieler, Rollen, Avatare, Resume)
  lib/image.ts         Prüfen/Zerlegen der Profilbild-Data-URLs
  db/index.ts          Verbindung (extern via DATABASE_URL oder PGlite) + Selbstheilung
  db/migrate.ts        idempotentes Schema (CREATE TABLE IF NOT EXISTS …)
  db/schema.ts         Drizzle-Tabellen
  instrumentation.ts   Datenbank-Vorlauf beim Serverstart
```
