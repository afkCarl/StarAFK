import type { S3Client as S3ClientType } from "@aws-sdk/client-s3";

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

/**
 * SDK und S3-Client werden ERST beim ersten echten Bild-Upload/-Download geladen.
 *
 * Warum das RAM spart – der Mechanismus (Next.js 16, Turbopack):
 * `@aws-sdk/client-s3` steht bereits in Next.js' eigener Liste
 * `next/dist/lib/server-external-packages.jsonc`, wird also NICHT gebündelt,
 * sondern im Server-Chunk als `require("@aws-sdk/client-s3-…")` referenziert.
 * Entscheidend ist, WANN dieses `require` ausgeführt wird:
 *   - Vorher stand der Import statisch am Dateianfang → das SDK wurde beim
 *     Initialisieren dieses Moduls geladen. Und dieses Modul liegt im Startpfad:
 *     `src/instrumentation.ts` → `src/lib/health.ts` → `src/lib/storage.ts`
 *     (health.ts liest `storageEnabled`). Der SDK landete also bei JEDEM
 *     Serverstart im Speicher, auch ganz ohne konfigurierten Bucket.
 *   - Jetzt steht er in einem `import()`-Ausdruck, den Turbopack als lazy
 *     Chunk-Load (`e.A(67533)`) übersetzt → ohne `AWS_*`-Variablen wird das
 *     SDK nie geladen und kostet 0 MB.
 *
 * Gemessen (A/B, sonst identischer Build, 12 pollende Spieler):
 *   statischer Import: Boot 138–139 MB, Spitze 154 MB
 *   lazy `import()`:   Boot 131 MB,      Spitze 150 MB   → ~8 MB weniger
 *   (isoliert in einem leeren Node-Prozess kostet `import("@aws-sdk/client-s3")`
 *   sogar +30 MB RSS; im bereits laufenden Next-Server ist der Zuwachs kleiner,
 *   weil sich Laufzeit-Overhead teilt.)
 *
 * `storageEnabled` bleibt bewusst ein synchroner Env-Check – health.ts braucht
 * den Wert beim Start, ohne dafür ein Modul laden zu müssen.
 */
type S3Module = typeof import("@aws-sdk/client-s3");

/** Einmal geladenes SDK + ein einziger, wiederverwendeter Client. */
type LoadedS3 = { mod: S3Module; client: S3ClientType };

let loaded: Promise<LoadedS3 | null> | null = null;

function s3(): Promise<LoadedS3 | null> {
  if (!storageEnabled) return Promise.resolve(null);
  loaded ??= import("@aws-sdk/client-s3")
    .then((mod) => ({
      mod,
      client: new mod.S3Client({ forcePathStyle: true }) as S3ClientType,
    }))
    .catch((error: unknown) => {
      // Fehlschlag nicht dauerhaft cachen (sonst wäre der Bucket bis zum
      // nächsten Neustart tot) – der nächste Versuch lädt erneut.
      loaded = null;
      throw error;
    });
  return loaded;
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
  const bucket = await s3();
  if (!bucket) throw new Error("Object Storage ist nicht konfiguriert");
  const { PutObjectCommand } = bucket.mod;
  await bucket.client.send(
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
  const bucket = await s3();
  if (!bucket) return null;
  try {
    const { GetObjectCommand } = bucket.mod;
    const result = await bucket.client.send(
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
  const bucket = await s3();
  if (!bucket) return;
  try {
    const { DeleteObjectCommand } = bucket.mod;
    await bucket.client.send(new DeleteObjectCommand({ Bucket: BUCKET, Key: key }));
  } catch (error) {
    console.warn(`[storage] Objekt ${key} konnte nicht gelöscht werden`, error);
  }
}
