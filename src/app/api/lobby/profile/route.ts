import { NextResponse } from "next/server";

import { updateProfile } from "@/lib/lobby-service";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const ok = await updateProfile(
      String(body?.code ?? ""),
      String(body?.playerId ?? ""),
      body?.profile,
    );
    return NextResponse.json({ ok });
  } catch (error) {
    console.error("lobby:updateProfile failed", error);
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
