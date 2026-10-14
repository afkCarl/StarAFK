import { sql } from "drizzle-orm";

import { dbStatus, getDb, noteDbFailure, noteDbSuccess } from "@/db";
import { json, route } from "@/lib/api";
import { authEnabled } from "@/lib/auth/server";
import { aiGatewayConfigured, gameMasterEnabled } from "@/lib/game-master";
import { BUCKET, storageEnabled } from "@/lib/storage";

export const dynamic = "force-dynamic";

/**
 * Health-Check (Render: `healthCheckPath: /api/health`). Prüft die Datenbank
 * wirklich an und zeigt an, welche Variante aktiv ist (`provider: "neon"` =
 * Neon-Datenbank aus DATABASE_URL, `"postgres"` = sonstige externe Datenbank,
 * z. B. automatisch von Render provisioniert, `"pglite"` = eingebettet).
 *
 * Bewusst IMMER HTTP 200, solange der Server selbst lebt: Render würde die
 * Instanz bei einem 503 sonst als „kaputt“ behandeln und neu starten – auch
 * dann, wenn die Datenbank nur kurz aufwacht (Neon Scale-to-Zero) oder die
 * Seite längst wieder funktioniert. Der eigentliche Zustand steht im Body
 * (`ok`, `status.lastError`, …); eine fehlgeschlagene Prüfung löst zusätzlich
 * den automatischen Neuaufbau der Verbindung aus (siehe src/db/index.ts).
 */
export const GET = route("health", async () => {
  const started = Date.now();
  const services = () => ({
    postgres: dbStatus().mode,
    provider: dbStatus().provider,
    auth: authEnabled,
    objectStorage: storageEnabled ? `bucket:${BUCKET}` : false,
    aiGateway: aiGatewayConfigured,
    functions: gameMasterEnabled,
  });
  try {
    const db = await getDb();
    await db.execute(sql`select 1`);
    noteDbSuccess();
    return json({
      ok: true,
      db: dbStatus().mode,
      provider: dbStatus().provider,
      status: dbStatus(),
      // Zeigt, welche Neon-Dienste verdrahtet sind (Neon Postgres, Auth,
      // Object Storage, AI Gateway, Functions).
      services: services(),
      latencyMs: Date.now() - started,
      uptimeSec: Math.round(process.uptime()),
    });
  } catch (error) {
    noteDbFailure(error);
    console.error("[api] health check failed", error);
    return json({
      ok: false,
      db: dbStatus().mode,
      provider: dbStatus().provider,
      status: dbStatus(),
      services: services(),
      latencyMs: Date.now() - started,
      uptimeSec: Math.round(process.uptime()),
    });
  }
});
