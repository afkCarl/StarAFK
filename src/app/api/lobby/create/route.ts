import { json, readJson, route } from "@/lib/api";
import { createLobby } from "@/lib/lobby-service";

export const dynamic = "force-dynamic";

export const POST = route("lobby:create", async (request) => {
  const body = await readJson(request);
  // `code` + `playerId` (optional): Wiederherstellung – z. B. wenn die
  // Render-Free-Instanz neu gestartet ist und die Lobby verloren ging, kann
  // der Host sie mit DEMSELBEN Code wieder aufmachen und seine Freunde landen
  // automatisch wieder drin.
  const result = await createLobby(String(body.mode ?? "WERWOLF"), body.profile, {
    code: typeof body.code === "string" ? body.code : undefined,
    playerId: typeof body.playerId === "string" ? body.playerId : undefined,
  });

  if (!result.ok) {
    return json({ ok: false, reason: result.reason }, 409);
  }
  return json({
    ok: true,
    selfId: result.selfId,
    reused: result.reused,
    lobby: result.lobby,
  });
});
