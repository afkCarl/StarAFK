import { createNeonAuth } from "@neondatabase/auth/next/server";

/**
 * Neon Auth (Managed Better Auth) – Server-Seite.
 *
 * `NEON_AUTH_BASE_URL` kommt aus dem Neon-Branch (`neon deploy` schreibt sie in
 * `.env.local`); `NEON_AUTH_COOKIE_SECRET` ist App-Konfiguration und wird NICHT
 * von Neon injiziert:
 *
 *   echo "NEON_AUTH_COOKIE_SECRET=$(openssl rand -base64 32)" >> .env.local
 *
 * Ohne diese Variablen (z. B. lokale Entwicklung mit PGlite) bleibt der Login
 * deaktiviert und die App läuft wie bisher anonym weiter – die API-Routen
 * prüfen dann keine Session.
 */
const baseUrl = process.env.NEON_AUTH_BASE_URL?.trim();
const cookieSecret = process.env.NEON_AUTH_COOKIE_SECRET?.trim();

function createAuth() {
  if (!baseUrl || !cookieSecret) return null;
  if (cookieSecret.length < 32) {
    console.error(
      "[auth] NEON_AUTH_COOKIE_SECRET ist zu kurz (mindestens 32 Zeichen) – " +
        "Login bleibt deaktiviert. Erzeugen mit: openssl rand -base64 32",
    );
    return null;
  }
  try {
    return createNeonAuth({
      baseUrl,
      cookies: { secret: cookieSecret },
    });
  } catch (error) {
    console.error("[auth] Neon Auth konnte nicht initialisiert werden", error);
    return null;
  }
}

/** Ist der Login in dieser Umgebung konfiguriert? */
export const authEnabled = Boolean(baseUrl && cookieSecret && cookieSecret.length >= 32);

export const auth = createAuth();

export type SessionUser = {
  id: string;
  email?: string | null;
  name?: string | null;
};

/**
 * So lange darf die Session-Prüfung höchstens dauern.
 *
 * Ohne Grenze hängt `auth.getSession()` bei einem nicht erreichbaren
 * Auth-Server so lange, wie das Netzwerk braucht – und da JEDER Lobby-Aufruf
 * die Session prüft, würde „Lobby erstellen“ minutenlang scheinbar nichts tun.
 */
const SESSION_TIMEOUT_MS = Number(process.env.AUTH_SESSION_TIMEOUT_MS ?? 5_000);

function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  if (!Number.isFinite(ms) || ms <= 0) return promise;
  let timer: ReturnType<typeof setTimeout> | undefined;
  return Promise.race([
    promise.finally(() => {
      if (timer) clearTimeout(timer);
    }),
    new Promise<never>((_, reject) => {
      timer = setTimeout(
        () => reject(new Error(`${label} nach ${ms} ms abgebrochen`)),
        ms,
      );
      timer.unref?.();
    }),
  ]);
}

/**
 * Aktuelle Session (oder `null`). Wichtig: Nicht `{ user }` aus dem Ergebnis
 * destrukturieren – der Nutzer steckt in `data.user`.
 */
export async function getSessionUser(): Promise<SessionUser | null> {
  if (!auth) return null;
  try {
    const { data } = await withTimeout(
      auth.getSession(),
      SESSION_TIMEOUT_MS,
      "Auth-Session-Prüfung",
    );
    const user = data?.user;
    if (!user?.id) return null;
    return {
      id: user.id,
      email: user.email ?? null,
      name: user.name ?? null,
    };
  } catch (error) {
    // Auth-Server nicht erreichbar o. Ä. → gilt als „nicht angemeldet“.
    // Wichtig: schnell antworten (401) statt die Lobby-API hängen zu lassen.
    console.warn("[auth] getSession fehlgeschlagen", error);
    return null;
  }
}
