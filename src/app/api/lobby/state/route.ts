import { json, route } from "@/lib/api";
import { getLobbyState } from "@/lib/lobby-service";

export const dynamic = "force-dynamic";

export const GET = route("lobby:state", async (request) => {
  const url = new URL(request.url);
  const code = url.searchParams.get("code") ?? "";
  const pid = url.searchParams.get("pid") ?? undefined;

  const outcome = await getLobbyState(code, pid);
  if (outcome.status === "not_found") {
    return json({ ok: false, reason: "not_found" }, 404);
  }
  if (outcome.status === "not_member") {
    return json({ ok: false, reason: "not_member" }, 409);
  }
  return json({ ok: true, state: outcome.state });
});
