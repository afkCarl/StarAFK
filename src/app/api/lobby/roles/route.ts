import { json, readJson, route } from "@/lib/api";
import { updateRoleCounts } from "@/lib/lobby-service";

export const dynamic = "force-dynamic";

export const POST = route("lobby:roles", async (request) => {
  const body = await readJson(request);
  const ok = await updateRoleCounts(
    String(body.code ?? ""),
    String(body.playerId ?? ""),
    body.roleCounts,
  );
  if (!ok) {
    return json({ ok: false, reason: "not_host" }, 403);
  }
  return json({ ok: true });
});
