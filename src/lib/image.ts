/**
 * Profilbilder kommen als Data-URL vom Browser (nach clientseitigem
 * Verkleinern) und werden als solche gespeichert. Wichtig: Sie werden NIE in
 * den Lobby-Zustand geladen, sondern über `GET /api/lobby/avatar` ausgeliefert.
 */
export const MAX_IMAGE_CHARS = 400_000;

const DATA_URL_RE = /^data:image\/(png|jpe?g|webp|gif);base64,([A-Za-z0-9+/=]+)$/;

export type ImageParseResult =
  | { ok: true; image: string | null }
  | { ok: false; reason: "too_large" | "unsupported" };

/** `null`/leer = Bild entfernen, gültige Data-URL = Bild setzen. */
export function parseImageInput(input: unknown): ImageParseResult {
  if (input === null || input === undefined || input === "") {
    return { ok: true, image: null };
  }
  if (typeof input !== "string") return { ok: false, reason: "unsupported" };
  if (input.length > MAX_IMAGE_CHARS) return { ok: false, reason: "too_large" };
  if (!DATA_URL_RE.test(input)) return { ok: false, reason: "unsupported" };
  return { ok: true, image: input };
}

export function decodeImage(
  dataUrl: string,
): { mime: string; bytes: Uint8Array<ArrayBuffer> } | null {
  const match = DATA_URL_RE.exec(dataUrl);
  if (!match) return null;
  const mime = `image/${match[1] === "jpg" ? "jpeg" : match[1]}`;
  try {
    const buffer = Buffer.from(match[2], "base64");
    if (buffer.length === 0) return null;
    return { mime, bytes: new Uint8Array(buffer) };
  } catch {
    return null;
  }
}
