import { json, readJson, route } from "@/lib/api";
import { requireUser } from "@/lib/auth/guard";
import { removePlayer } from "@/lib/lobby-service";

export const dynamic = "force-dynamic";

export const POST = route("lobby:leave", async (request) => {
  const guard = await requireUser();
  if (!guard.ok) return guard.response;

  const body = await readJson(request);
  await removePlayer(
    String(body.code ?? ""),
    String(body.playerId ?? ""),
    // Ohne Login (lokale Entwicklung) wird wie bisher anhand der playerId gelöscht.
    guard.userId,
  );
  return json({ ok: true });
});
