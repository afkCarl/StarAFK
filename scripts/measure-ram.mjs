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
