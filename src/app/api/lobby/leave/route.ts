import { NextResponse } from "next/server";

import { removePlayer } from "@/lib/lobby-service";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    await removePlayer(String(body?.code ?? ""), String(body?.playerId ?? ""));
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("lobby:leave failed", error);
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
