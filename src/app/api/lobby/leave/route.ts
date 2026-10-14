import { json, readJson, route } from "@/lib/api";
import { removePlayer } from "@/lib/lobby-service";

export const dynamic = "force-dynamic";

export const POST = route("lobby:leave", async (request) => {
  const body = await readJson(request);
  await removePlayer(String(body.code ?? ""), String(body.playerId ?? ""));
  return json({ ok: true });
});
