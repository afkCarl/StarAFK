"use client";

import { useEffect, useState, type ReactNode } from "react";

import { SignInScreen } from "@/components/auth/sign-in-screen";
import { authClient } from "@/lib/auth/client";

type AuthConfig = { enabled: boolean; signedIn: boolean };

/** Wie lange `/api/config` auf sich warten darf, bevor aufgegeben wird. */
const CONFIG_TIMEOUT_MS = 8_000;
/**
 * Zeitfenster, nach dem die Login-Schranke **in jedem Fall** öffnet.
 * Sonst bliebe die Seite auf „Laden…“ stehen, wenn der Server (oder der
 * Auth-Dienst dahinter) einmal nicht antwortet – die Seite wäre zwar online,
 * aber für den Besucher „kaputt“.
 */
const GATE_TIMEOUT_MS = 10_000;

function Loading({ text }: { text: string }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-[#0b1220] text-sm font-semibold uppercase tracking-[0.3em] text-white/40">
      {text}
    </div>
  );
}

/**
 * Login-Schranke um die App.
 *
 * - Kein Neon Auth konfiguriert (lokale Entwicklung/PGlite) → App sofort.
 * - Neon Auth konfiguriert → ohne Session erscheint die Anmeldung; die
 *   API-Routen prüfen die Session zusätzlich serverseitig (401).
 * - Antwortet `/api/config` (oder die Session-Prüfung) nicht rechtzeitig, wird
 *   nicht ewig gewartet, sondern geöffnet (bzw. die Anmeldung gezeigt). Die
 *   Seite ist damit auch bei einem hängenden Auth-Server erreichbar.
 */
export function AuthGate({ children }: { children: ReactNode }) {
  const [config, setConfig] = useState<AuthConfig | null>(null);
  const [timedOut, setTimedOut] = useState(false);
  const { data: session, isPending, refetch } = authClient.useSession();

  useEffect(() => {
    let cancelled = false;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), CONFIG_TIMEOUT_MS);

    fetch("/api/config", { cache: "no-store", signal: controller.signal })
      .then((response) => response.json())
      .then((body: { auth?: AuthConfig }) => {
        if (!cancelled) {
          setConfig({ enabled: Boolean(body.auth?.enabled), signedIn: Boolean(body.auth?.signedIn) });
        }
      })
      .catch(() => {
        // Konfiguration nicht lesbar (Server startet gerade, Zeitlimit, …) →
        // App nicht blockieren.
        if (!cancelled) setConfig({ enabled: false, signedIn: false });
      })
      .finally(() => clearTimeout(timer));

    return () => {
      cancelled = true;
      clearTimeout(timer);
      controller.abort();
    };
  }, []);

  // Notausstieg: niemals endlos im Ladezustand bleiben.
  useEffect(() => {
    const timer = setTimeout(() => setTimedOut(true), GATE_TIMEOUT_MS);
    return () => clearTimeout(timer);
  }, []);

  if (config === null) {
    if (!timedOut) return <Loading text="Laden…" />;
    // Konfiguration unbekannt → lieber die App zeigen als gar nichts.
    return <>{children}</>;
  }

  if (!config.enabled) return <>{children}</>;

  if (isPending && !session) {
    // Die Session-Prüfung hängt (Auth-Server nicht erreichbar) → Anmeldung
    // zeigen statt weiter zu warten; dort kann es erneut versucht werden.
    if (timedOut) return <SignInScreen onDone={() => void refetch()} />;
    return <Loading text="Session wird geprüft…" />;
  }

  if (!session?.user) {
    return <SignInScreen onDone={() => void refetch()} />;
  }

  return <>{children}</>;
}
