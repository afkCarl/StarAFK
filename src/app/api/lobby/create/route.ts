import { NextResponse } from "next/server";

import { createLobby } from "@/lib/lobby-service";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const result = await createLobby(String(body?.mode ?? "WERWOLF"), body?.profile);
    return NextResponse.json({ ok: true, selfId: result.selfId, lobby: result.lobby });
  } catch (error) {
    console.error("lobby:create failed", error);
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
