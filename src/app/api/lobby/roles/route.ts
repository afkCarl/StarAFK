import { NextResponse } from "next/server";

import { updateRoleCounts } from "@/lib/lobby-service";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const ok = await updateRoleCounts(
      String(body?.code ?? ""),
      String(body?.playerId ?? ""),
      body?.roleCounts,
    );
    return NextResponse.json({ ok });
  } catch (error) {
    console.error("lobby:updateRoles failed", error);
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
