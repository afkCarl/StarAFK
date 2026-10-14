import { sql } from "drizzle-orm";

import { getDb, getDbMode } from "@/db";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await (await getDb()).execute(sql`select 1`);
    return Response.json({ ok: true, db: getDbMode() });
  } catch (error) {
    console.error("health check failed", error);
    return Response.json(
      { ok: false, db: getDbMode() },
      { status: 500 },
    );
  }
}
