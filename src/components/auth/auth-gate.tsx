"use client";

import { useEffect, useState, type ReactNode } from "react";

import { SignInScreen } from "@/components/auth/sign-in-screen";
import { authClient } from "@/lib/auth/client";

type AuthConfig = { enabled: boolean; signedIn: boolean };

/**
 * Login-Schranke um die App.
 *
 * - Kein Neon Auth konfiguriert (lokale Entwicklung/PGlite) → App sofort.
 * - Neon Auth konfiguriert → ohne Session erscheint die Anmeldung; die
 *   API-Routen prüfen die Session zusätzlich serverseitig (401).
 */
export function AuthGate({ children }: { children: ReactNode }) {
  const [config, setConfig] = useState<AuthConfig | null>(null);
  const { data: session, isPending, refetch } = authClient.useSession();

  useEffect(() => {
    let cancelled = false;
    fetch("/api/config", { cache: "no-store" })
      .then((response) => response.json())
      .then((body: { auth?: AuthConfig }) => {
        if (!cancelled) {
          setConfig({ enabled: Boolean(body.auth?.enabled), signedIn: Boolean(body.auth?.signedIn) });
        }
      })
      .catch(() => {
        // Konfiguration nicht lesbar → App nicht blockieren.
        if (!cancelled) setConfig({ enabled: false, signedIn: false });
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (config === null) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#0b1220] text-sm font-semibold uppercase tracking-[0.3em] text-white/40">
        Laden…
      </div>
    );
  }

  if (!config.enabled) return <>{children}</>;

  if (isPending && !session) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#0b1220] text-sm font-semibold uppercase tracking-[0.3em] text-white/40">
        Session wird geprüft…
      </div>
    );
  }

  if (!session?.user) {
    return <SignInScreen onDone={() => void refetch()} />;
  }

  return <>{children}</>;
}
