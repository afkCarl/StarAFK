import { json, route } from "@/lib/api";
import { requireUser } from "@/lib/auth/guard";
import { getLobbyState } from "@/lib/lobby-service";

export const dynamic = "force-dynamic";

export const GET = route("lobby:state", async (request) => {
  const guard = await requireUser();
  if (!guard.ok) return guard.response;

  const url = new URL(request.url);
  const code = url.searchParams.get("code") ?? "";
  const pid = url.searchParams.get("pid") ?? undefined;

  const outcome = await getLobbyState(code, pid, guard.userId);
  if (outcome.status === "not_found") {
    return json({ ok: false, reason: "not_found" }, 404);
  }
  if (outcome.status === "not_member") {
    return json({ ok: false, reason: "not_member" }, 409);
  }
  return json({ ok: true, state: outcome.state });
});
