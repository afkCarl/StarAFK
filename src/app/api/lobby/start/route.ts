import { json, readJson, route } from "@/lib/api";
import { requireUser } from "@/lib/auth/guard";
import { setGameStarted } from "@/lib/lobby-service";

export const dynamic = "force-dynamic";

export const POST = route("lobby:start", async (request) => {
  const guard = await requireUser();
  if (!guard.ok) return guard.response;

  const body = await readJson(request);
  const result = await setGameStarted(
    String(body.code ?? ""),
    String(body.playerId ?? ""),
    body.started !== false,
    guard.userId,
  );
  if (!result.ok) {
    return json(
      { ok: false, reason: result.reason },
      result.reason === "not_host" ? 403 : 409,
    );
  }
  return json({ ok: true });
});
