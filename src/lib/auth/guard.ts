import type { NextResponse } from "next/server";

import { json } from "@/lib/api";
import { authEnabled, getSessionUser } from "@/lib/auth/server";

/**
 * Ergebnis der Zugriffsprüfung für API-Routen.
 *
 * - Neon Auth konfiguriert → ohne gültige Session gibt es 401 (die Route bricht
 *   mit `guard.response` ab).
 * - Neon Auth NICHT konfiguriert (lokale Entwicklung, PGlite) → `userId: null`,
 *   die App verhält sich wie früher (anonyme Lobby).
 */
export type Guard =
  | { ok: true; userId: string | null }
  | { ok: false; response: NextResponse };

export async function requireUser(): Promise<Guard> {
  if (!authEnabled) return { ok: true, userId: null };

  const user = await getSessionUser();
  if (!user) {
    return {
      ok: false,
      response: json({ ok: false, reason: "unauthorized" }, 401),
    };
  }
  return { ok: true, userId: user.id };
}

/** Status für Health-Check und Client-Konfiguration. */
export async function authStatus(): Promise<{ enabled: boolean; signedIn: boolean }> {
  if (!authEnabled) return { enabled: false, signedIn: false };
  const user = await getSessionUser();
  return { enabled: true, signedIn: Boolean(user) };
}
