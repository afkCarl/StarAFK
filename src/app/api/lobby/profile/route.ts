import { json, readJson, route } from "@/lib/api";
import { requireUser } from "@/lib/auth/guard";
import { updateProfile } from "@/lib/lobby-service";

export const dynamic = "force-dynamic";

export const POST = route("lobby:profile", async (request) => {
  const guard = await requireUser();
  if (!guard.ok) return guard.response;

  const body = await readJson(request);
  const ok = await updateProfile(
    String(body.code ?? ""),
    String(body.playerId ?? ""),
    body.profile,
    guard.userId,
  );
  if (!ok) {
    return json({ ok: false, reason: "not_member" }, 409);
  }
  return json({ ok: true });
});
