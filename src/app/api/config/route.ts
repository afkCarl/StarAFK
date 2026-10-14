import { json, route } from "@/lib/api";
import { authStatus } from "@/lib/auth/guard";
import { GAME_MASTER_URL, gameMasterEnabled } from "@/lib/game-master";

export const dynamic = "force-dynamic";

/**
 * Laufzeit-Konfiguration für den Browser: Ist der Login aktiv und ist der
 * AI Game Master (Neon Function) erreichbar? Secrets bleiben hier draußen –
 * die Function-URL ist ohnehin öffentlich, das JWT holt sich der Client selbst
 * aus der Neon-Auth-Session.
 */
export const GET = route("config", async () => {
  const auth = await authStatus();
  return json({
    ok: true,
    auth,
    gameMaster: { enabled: gameMasterEnabled, url: GAME_MASTER_URL },
  });
});
