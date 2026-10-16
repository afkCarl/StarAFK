import { json, readJson, route } from "@/lib/api";
import { requireUser } from "@/lib/auth/guard";
import { setGameStarted } from "@/lib/lobby-service";

export const dynamic = "force-dynamic";

export const POST = route("lobby:start", async (request) => {
  const guard = await requireUser();
  if (!guard.ok) return guard.response;

  const body = await readJson(request);
  const outcome = await setGameStarted(
    String(body.code ?? ""),
    String(body.playerId ?? ""),
    body.started !== false,
    guard.userId,
  );
  if (!outcome.ok) {
    if (outcome.reason === "not_enough_players") {
      return json({ ok: false, reason: "not_enough_players" }, 409);
    }
    if (outcome.reason === "not_found") {
      return json({ ok: false, reason: "not_found" }, 404);
    }
    return json({ ok: false, reason: "not_host" }, 403);
  }
  return json({ ok: true });
});
