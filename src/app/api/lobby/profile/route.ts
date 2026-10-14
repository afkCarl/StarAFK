import { json, readJson, route } from "@/lib/api";
import { updateProfile } from "@/lib/lobby-service";

export const dynamic = "force-dynamic";

export const POST = route("lobby:profile", async (request) => {
  const body = await readJson(request);
  const ok = await updateProfile(
    String(body.code ?? ""),
    String(body.playerId ?? ""),
    body.profile,
  );
  if (!ok) {
    return json({ ok: false, reason: "not_member" }, 409);
  }
  return json({ ok: true });
});
