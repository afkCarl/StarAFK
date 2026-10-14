import { json, readJson, route } from "@/lib/api";
import { decodeImage } from "@/lib/image";
import { getAvatar, updateAvatar } from "@/lib/lobby-service";

export const dynamic = "force-dynamic";

const UUID_RE = /^[0-9a-fA-F-]{36}$/;

/**
 * Profilbild eines Spielers (Rohdaten). Die URL enthält eine Versionsnummer
 * (`v=…`), darf also lange im Browser-Cache liegen – dadurch muss das Bild
 * genau EINMAL geladen werden und nicht bei jeder Statusabfrage erneut.
 */
export const GET = route("lobby:avatar:get", async (request) => {
  const pid = new URL(request.url).searchParams.get("pid") ?? "";
  if (!UUID_RE.test(pid)) {
    return new Response("bad request", { status: 400 });
  }

  const found = await getAvatar(pid);
  const decoded = found ? decodeImage(found.image) : null;
  if (!decoded) {
    return new Response("not found", {
      status: 404,
      headers: { "Cache-Control": "no-store, max-age=0" },
    });
  }

  return new Response(decoded.bytes, {
    headers: {
      "Content-Type": decoded.mime,
      "Content-Length": String(decoded.bytes.byteLength),
      "Cache-Control": "public, max-age=604800, immutable",
    },
  });
});

/** Profilbild hochladen oder entfernen (`image: null`). */
export const POST = route("lobby:avatar", async (request) => {
  const body = await readJson(request);
  const result = await updateAvatar(
    String(body.code ?? ""),
    String(body.playerId ?? ""),
    body.image,
  );
  if (!result.ok) {
    return json(
      { ok: false, reason: result.reason },
      result.reason === "not_member" ? 409 : 400,
    );
  }
  return json({ ok: true, url: result.url });
});
