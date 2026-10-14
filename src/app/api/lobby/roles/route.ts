import { json, readJson, route } from "@/lib/api";
import { requireUser } from "@/lib/auth/guard";
import { updateRoleCounts } from "@/lib/lobby-service";

export const dynamic = "force-dynamic";

export const POST = route("lobby:roles", async (request) => {
  const guard = await requireUser();
  if (!guard.ok) return guard.response;

  const body = await readJson(request);
  const ok = await updateRoleCounts(
    String(body.code ?? ""),
    String(body.playerId ?? ""),
    body.roleCounts,
    guard.userId,
  );
  if (!ok) {
    return json({ ok: false, reason: "not_host" }, 403);
  }
  return json({ ok: true });
});
