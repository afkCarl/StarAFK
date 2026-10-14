import { NextResponse } from "next/server";

import { setGameStarted } from "@/lib/lobby-service";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const ok = await setGameStarted(
      String(body?.code ?? ""),
      String(body?.playerId ?? ""),
      body?.started !== false,
    );
    return NextResponse.json({ ok });
  } catch (error) {
    console.error("lobby:start failed", error);
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
