import { json, readJson, route } from "@/lib/api";
import { requireUser } from "@/lib/auth/guard";
import { decodeImage } from "@/lib/image";
import { getAvatar, updateAvatar } from "@/lib/lobby-service";
import { getObject } from "@/lib/storage";

export const dynamic = "force-dynamic";

const UUID_RE = /^[0-9a-fA-F-]{36}$/;

/**
 * Profilbild eines Spielers. Die URL enthält eine Versionsnummer (`v=…`), darf
 * also lange im Browser-Cache liegen – dadurch muss das Bild genau EINMAL
 * geladen werden und nicht bei jeder Statusabfrage erneut.
 *
 * Mit Neon Object Storage liegen die Bilddaten im Bucket (`assets`) und werden
 * hier serverseitig durchgereicht; ohne Bucket kommt die Data-URL aus Postgres.
 */
export const GET = route("lobby:avatar:get", async (request) => {
  const pid = new URL(request.url).searchParams.get("pid") ?? "";
  if (!UUID_RE.test(pid)) {
    return new Response("bad request", { status: 400 });
  }

  const found = await getAvatar(pid);
  if (!found) {
    return new Response("not found", {
      status: 404,
      headers: { "Cache-Control": "no-store, max-age=0" },
    });
  }

  let bytes: Uint8Array | null = null;
  let mime = "application/octet-stream";

  if (found.imageKey) {
    const object = await getObject(found.imageKey);
    if (object) {
      bytes = object.bytes;
      mime = object.contentType;
    }
  }
  if (!bytes && found.image) {
    const decoded = decodeImage(found.image);
    if (decoded) {
      bytes = decoded.bytes;
      mime = decoded.mime;
    }
  }
  if (!bytes) {
    return new Response("not found", {
      status: 404,
      headers: { "Cache-Control": "no-store, max-age=0" },
    });
  }

  return new Response(bytes as unknown as BodyInit, {
    headers: {
      "Content-Type": mime,
      "Content-Length": String(bytes.byteLength),
      "Cache-Control": "public, max-age=604800, immutable",
    },
  });
});

/** Profilbild hochladen oder entfernen (`image: null`). */
export const POST = route("lobby:avatar", async (request) => {
  const guard = await requireUser();
  if (!guard.ok) return guard.response;

  const body = await readJson(request);
  const result = await updateAvatar(
    String(body.code ?? ""),
    String(body.playerId ?? ""),
    body.image,
    guard.userId,
  );
  if (!result.ok) {
    return json(
      { ok: false, reason: result.reason },
      result.reason === "not_member" ? 409 : 400,
    );
  }
  return json({ ok: true, url: result.url });
});
