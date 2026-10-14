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
  "src/components/werwolf/walking-cat.tsx",
  "src/components/werwolf/role-icon.tsx",
  "src/components/werwolf/glass-card.tsx",
  "src/components/auth/auth-gate.tsx",
  "src/components/auth/sign-in-screen.tsx",
  "scripts/build-readme.mjs",
];

/** Binärdateien: nicht inline, sondern über die Website-URL ladbar. */
const BINARY_FILES = [
  "public/sky.png",
  "public/clouds.png",
  "public/foreground.png",
  "public/frames/GrayCatWalkingOne.png",
  "public/frames/GrayCatWalkingTwo.png",
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
> 4. \`npm install\` → \`npm run build\` → \`npm run start\` — fertig, die App läuft
>    1:1 identisch OHNE jede Datenbank-Vorbereitung: ohne \`DATABASE_URL\` wird
>    automatisch eine eingebettete PostgreSQL-Datenbank (PGlite) in \`.data/\` angelegt.
> 5. Optional (empfohlen auf Render): \`.env\` bzw. Umgebungsvariable
>    \`DATABASE_URL=postgresql://…\` für eine externe PostgreSQL-Datenbank — die
>    Tabellen werden ebenfalls automatisch angelegt (kein \`drizzle-kit push\`).
>    Ohne \`DATABASE_URL\` läuft die App eingebettet (PGlite); auf Render-Free-
>    Instanzen ist das Dateisystem flüchtig, Lobbys sind dann nach einem
>    Neustart weg (die Lobby wird automatisch mit gleichem Code neu geöffnet).

## Projektübersicht

Mehrspieler-Lobby für das Partyspiel **Werwolf** (Bonus-Modus: **Höhle der Löwen**):

- **Menü**: Spielmodus-Karussell (SPIELMODUS 1/2) mit Slide-Animation, Nachthimmel
  mit Wolken-Parallax und Dorf-Silhouette, „Lobby erstellen" / „Lobby beitreten"
  (6-stelliger Code, A–Z), Menüpunkte „Spielerkarte" / „Statistiken" / „Einstellungen".
- **Spielerkarte**: Name (max. 12 Zeichen), Farbe + Intensität (135°-Farbverlauf),
  Profilbild-Upload (Data-URL), Rahmenwahl (Rahmen 1 = laufende Katze \`Cd\`/\`WalkingCat\`).
  Persistenz in \`localStorage\` unter \`werwolf-player-profile\`.
- **Lobby**: kopierbarer Lobbycode, Glaskarten-Grid der Spieler (Farbe/Avatar/Host-Badge),
  Seitenleiste mit Spielmodus, „Rollen für diese Runde", „Sonstige Regeln",
  „Spiel starten" (Host) bzw. „Warte auf Host…" (Gäste).
- **15 Rollen** (Teams gut/böse/neutral) mit Beschreibung, Gewinnkondition und
  Host-Zählern; Standard: 1× Werwolf, 2× Dorfbewohner.
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
