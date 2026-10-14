import { json, readJson, route } from "@/lib/api";
import { setGameStarted } from "@/lib/lobby-service";

export const dynamic = "force-dynamic";

export const POST = route("lobby:start", async (request) => {
  const body = await readJson(request);
  const ok = await setGameStarted(
    String(body.code ?? ""),
    String(body.playerId ?? ""),
    body.started !== false,
  );
  if (!ok) {
    return json({ ok: false, reason: "not_host" }, 403);
  }
  return json({ ok: true });
});
