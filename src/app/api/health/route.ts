import { sql } from "drizzle-orm";

import { dbStatus, getDb, noteDbFailure, noteDbSuccess } from "@/db";
import { json, route } from "@/lib/api";
import { authEnabled } from "@/lib/auth/server";
import { aiGatewayConfigured, gameMasterEnabled } from "@/lib/game-master";
import { BUCKET, storageEnabled } from "@/lib/storage";

export const dynamic = "force-dynamic";

/**
 * Health-Check (Render: `healthCheckPath: /api/health`). Prüft die Datenbank
 * wirklich an und zeigt an, welche Variante aktiv ist (`postgres` = externe
 * Datenbank aus DATABASE_URL, `pglite` = eingebettet). Fehlgeschlagene
 * Prüfungen lösen den automatischen Neuaufbau der Verbindung aus
 * (siehe src/db/index.ts).
 */
export const GET = route("health", async () => {
  const started = Date.now();
  try {
    const db = await getDb();
    await db.execute(sql`select 1`);
    noteDbSuccess();
    return json({
      ok: true,
      db: dbStatus().mode,
      status: dbStatus(),
      // Zeigt, welche Neon-Dienste verdrahtet sind (Neon Postgres, Auth,
      // Object Storage, AI Gateway, Functions).
      services: {
        postgres: dbStatus().mode,
        auth: authEnabled,
        objectStorage: storageEnabled ? `bucket:${BUCKET}` : false,
        aiGateway: aiGatewayConfigured,
        functions: gameMasterEnabled,
      },
      latencyMs: Date.now() - started,
      uptimeSec: Math.round(process.uptime()),
    });
  } catch (error) {
    noteDbFailure(error);
    console.error("[api] health check failed", error);
    return json(
      {
        ok: false,
        db: dbStatus().mode,
        status: dbStatus(),
        latencyMs: Date.now() - started,
      },
      503,
    );
  }
});
