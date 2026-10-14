import { json, readJson, route } from "@/lib/api";
import { joinLobby } from "@/lib/lobby-service";

export const dynamic = "force-dynamic";

export const POST = route("lobby:join", async (request) => {
  const body = await readJson(request);
  // `playerId` (optional): Reconnect – derselbe Spieler kommt in dieselbe
  // Lobby zurück (z. B. nachdem der Tab im Hintergrund war oder die
  // Render-Instanz kurz neu gestartet ist). Host-Rolle bleibt erhalten.
  const result = await joinLobby(String(body.code ?? ""), body.profile, {
    playerId: typeof body.playerId === "string" ? body.playerId : undefined,
  });

  if (!result.ok) {
    return json(
      { ok: false, reason: result.reason },
      result.reason === "full" ? 409 : 404,
    );
  }
  return json({
    ok: true,
    selfId: result.selfId,
    resumed: result.resumed,
    lobby: result.lobby,
  });
});
