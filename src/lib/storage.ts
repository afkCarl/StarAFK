import {
  DeleteObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";

/**
 * Neon Object Storage (S3-kompatibel, branch-scoped).
 *
 * `neon deploy` schreibt die AWS-Standardvariablen in `.env.local`, daher findet
 * der AWS-SDK den Endpunkt, die Region und die Zugangsdaten von selbst:
 *
 *   AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, AWS_ENDPOINT_URL_S3, AWS_REGION
 *
 * Nötig ist nur `forcePathStyle: true` – Neon spricht ausschließlich
 * Path-Style-Adressierung. Ist nichts konfiguriert, bleibt der Bucket aus und
 * Profilbilder werden wie bisher als Data-URL in Postgres gespeichert.
 */
export const BUCKET = process.env.NEON_STORAGE_BUCKET?.trim() || "assets";

export const storageEnabled = Boolean(
  process.env.AWS_ACCESS_KEY_ID &&
    process.env.AWS_SECRET_ACCESS_KEY &&
    process.env.AWS_ENDPOINT_URL_S3,
);

let client: S3Client | null = null;

function s3(): S3Client | null {
  if (!storageEnabled) return null;
  client ??= new S3Client({ forcePathStyle: true });
  return client;
}

export type StoredObject = {
  bytes: Uint8Array;
  contentType: string;
};

export async function putObject(
  key: string,
  bytes: Uint8Array,
  contentType: string,
): Promise<void> {
  const s3Client = s3();
  if (!s3Client) throw new Error("Object Storage ist nicht konfiguriert");
  await s3Client.send(
    new PutObjectCommand({
      Bucket: BUCKET,
      Key: key,
      Body: bytes,
      ContentType: contentType,
      // Avatare sind unveränderlich (jede Änderung schreibt einen neuen Key).
      CacheControl: "public, max-age=604800, immutable",
    }),
  );
}

export async function getObject(key: string): Promise<StoredObject | null> {
  const s3Client = s3();
  if (!s3Client) return null;
  try {
    const result = await s3Client.send(
      new GetObjectCommand({ Bucket: BUCKET, Key: key }),
    );
    const bytes = await result.Body?.transformToByteArray();
    if (!bytes) return null;
    return {
      bytes,
      contentType: result.ContentType ?? "application/octet-stream",
    };
  } catch (error) {
    console.warn(`[storage] Objekt ${key} konnte nicht geladen werden`, error);
    return null;
  }
}

/** Alte Bildversion aufräumen – Fehler dürfen den Upload nicht scheitern lassen. */
export async function deleteObject(key: string): Promise<void> {
  const s3Client = s3();
  if (!s3Client) return;
  try {
    await s3Client.send(new DeleteObjectCommand({ Bucket: BUCKET, Key: key }));
  } catch (error) {
    console.warn(`[storage] Objekt ${key} konnte nicht gelöscht werden`, error);
  }
}
