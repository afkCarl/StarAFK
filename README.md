# StarAFK – Werwolf-Lobby (Multiplayer)

Mehrspieler-Lobby für das Partyspiel **Werwolf** (Bonus-Modus: **Höhle der Löwen**):
Lobby erstellen, Code teilen, Freunde beitreten lassen – Spieler, Profilkarten,
Rollen-Setup und der Spielstart werden live für alle synchronisiert.

## Wie funktioniert das?

- **Frontend & Backend in einem**: Die Next.js-App liefert die Website **und** die
  komplette API (`/api/lobby/…`) aus – ein einziger Service genügt.
- **Datenbank**: Alle Lobbys und Spieler liegen in einer PostgreSQL-Datenbank
  (Drizzle ORM). Die Tabellen werden **automatisch** beim ersten Zugriff angelegt –
  es gibt nichts zu migrieren.
- **Live-Sync**: Das Frontend polled den Lobby-Zustand alle 1,2 s. Spieler, die
  den Tab schließen, fliegen nach ~15 s automatisch raus; der Host wird bei Bedarf
  automatisch weitergegeben.

## Null-Konfiguration – ohne irgendetwas zu installieren

Falls **keine** `DATABASE_URL` gesetzt ist, startet die App automatisch mit einer
**eingebetteten PostgreSQL-Datenbank (PGlite)** im Ordner `.data/`:

1. Repository auf [Render](https://render.com) verbinden (oder `render.yaml` als
   Blueprint anlegen).
2. Build: `npm ci && npm run build` · Start: `npm run start` (in `render.yaml`
   bereits hinterlegt).
3. Fertig – „Lobby erstellen" funktioniert sofort, inklusive Datenbank.

> **Hinweis zu Render-Free-Instanzen:** Nach längerer Inaktivität schaltet Render
> Free-Instanzen in den Ruhezustand (erster Aufruf dauert dann ~50 s). Der
> Ordner `.data/` überlebt bis zum nächsten Deploy/Neustart – für Lobbys, die
> nur Minuten leben, ist das egal.

## Optional: externe Datenbank (empfohlen, wenn später mehr Server-Instanzen laufen)

Sobald eine `DATABASE_URL` gesetzt ist, wird automatisch diese Datenbank benutzt
(die Tabellen werden auch hier automatisch angelegt). So richtest du es ein:

1. **Kostenlose PostgreSQL-Datenbank anlegen** – z. B.:
   - [Neon](https://neon.tech) (kostenloser Serverless-Postgres-Tier)
   - [Supabase](https://supabase.com) (kostenloser Tier, „Project Settings → Database")
   - [Render PostgreSQL](https://render.com/docs/databases) (im selben Dashboard)
2. **Connection-String kopieren** – sieht etwa so aus:
   `postgresql://user:pass@host:5432/dbname?sslmode=require`
3. In **Render** → Service → **Environment** → Variable `DATABASE_URL` mit diesem
   Wert anlegen.
4. **Redeploy** („Manual Deploy → Deploy latest commit").

Danach zeigt `/api/health` `"db": "postgres"` an (ohne `DATABASE_URL` steht dort
`"db": "pglite"`).

### Warum nicht einfach eingebettet bleiben?

PGlite speichert auf der Festplatte **einer** Server-Instanz. Das ist für Lobbys,
die nur Minuten leben, völlig ausreichend. Sobald die App aber auf mehreren
Instanzen läuft (oder Daten über Restarts hinaus sollen), braucht es eine echte
externe Datenbank – dann einfach `DATABASE_URL` setzen, mehr nicht.

## Auf Render einrichten (falls „Lobby erstellen" noch nicht geht)

Im Render-Dashboard unter **Settings** prüfen:

| Einstellung | Wert |
| --- | --- |
| Runtime | Node |
| Build Command | `npm ci && npm run build` |
| Start Command | `npm run start` |
| Health Check Path | `/api/health` |
| Environment | `DATABASE_URL` **optional** – nur für externe Datenbank |

Anschließend **Manual Deploy → Deploy latest commit**. Vorher war oft das Problem,
dass der Service noch als reines Vite-Statische-Projekt (ohne Backend) startete –
mit den Werten oben läuft die App als echter Server mit API und Datenbank.

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
| `/api/health` | GET | Status + welche Datenbank aktiv ist |
| `/api/lobby/create` | POST | Lobby anlegen (6-stelliger Code) |
| `/api/lobby/join` | POST | Lobby beitreten (`max. 12 Spieler`) |
| `/api/lobby/state` | GET | Zustand abfragen (Polling, Heartbeat) |
| `/api/lobby/profile` | POST | Spielerprofil syncen |
| `/api/lobby/roles` | POST | Rollen-Setup ändern (nur Host) |
| `/api/lobby/start` | POST | Spiel starten/zurücksetzen (nur Host) |
| `/api/lobby/leave` | POST | Lobby verlassen |

Einladungslinks haben die Form `https://<deine-domain>/?code=ABCDEF` und öffnen
das Beitreten-Feld vorausgefüllt.
