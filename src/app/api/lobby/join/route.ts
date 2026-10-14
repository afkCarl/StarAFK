import { NextResponse } from "next/server";

import { joinLobby } from "@/lib/lobby-service";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const result = await joinLobby(String(body?.code ?? ""), body?.profile);
    if (!result.ok) {
      return NextResponse.json(
        { ok: false, reason: result.reason },
        { status: result.reason === "full" ? 409 : 404 },
      );
    }
    return NextResponse.json({ ok: true, selfId: result.selfId, lobby: result.lobby });
  } catch (error) {
    console.error("lobby:join failed", error);
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
