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
 * Aktuelle Session (oder `null`). Wichtig: Nicht `{ user }` aus dem Ergebnis
 * destrukturieren – der Nutzer steckt in `data.user`.
 */
export async function getSessionUser(): Promise<SessionUser | null> {
  if (!auth) return null;
  try {
    const { data } = await auth.getSession();
    const user = data?.user;
    if (!user?.id) return null;
    return {
      id: user.id,
      email: user.email ?? null,
      name: user.name ?? null,
    };
  } catch (error) {
    // Auth-Server nicht erreichbar o. Ä. → gilt als „nicht angemeldet“.
    console.warn("[auth] getSession fehlgeschlagen", error);
    return null;
  }
}
