import { NextResponse } from "next/server";

import { getLobbyState } from "@/lib/lobby-service";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const code = url.searchParams.get("code") ?? "";
    const pid = url.searchParams.get("pid") ?? undefined;

    const state = await getLobbyState(code, pid);
    if (state === null || state === "gone") {
      return NextResponse.json({ ok: false, reason: "not_found" }, { status: 404 });
    }
    if (state === "kicked") {
      return NextResponse.json({ ok: false, reason: "kicked" }, { status: 409 });
    }
    return NextResponse.json({ ok: true, state });
  } catch (error) {
    console.error("lobby:state failed", error);
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
