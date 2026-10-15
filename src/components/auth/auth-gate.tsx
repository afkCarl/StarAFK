"use client";

import { useEffect, useState, type ReactNode } from "react";

import { SignInScreen } from "@/components/auth/sign-in-screen";
import { authClient } from "@/lib/auth/client";

type AuthConfig = { enabled: boolean; signedIn: boolean };

/** Wie lange `/api/config` auf sich warten darf, bevor aufgegeben wird. */
const CONFIG_TIMEOUT_MS = 8_000;

function AuthGateInner({ children, config }: { children: ReactNode; config: AuthConfig }) {
  const { data: session, isPending, refetch } = authClient.useSession();

  if (!config.enabled) return <>{children}</>;

  // Während der Session-Prüfung nicht blockieren – die Seite bleibt nutzbar,
  // geschützte API-Routen prüfen die Session serverseitig (401).
  if (isPending && !session) return <>{children}</>;

  if (!session?.user) {
    return <SignInScreen onDone={() => void refetch()} />;
  }

  return <>{children}</>;
}

/**
 * Login-Schranke um die App.
 *
 * Kein Ladescreen: Die App wird sofort gerendert. `/api/config` wird im
 * Hintergrund geladen; ist der Login aktiviert, blendet sich bei Bedarf die
 * Anmeldung ein, ohne die Seite vorher zu blockieren.
 */
export function AuthGate({ children }: { children: ReactNode }) {
  const [config, setConfig] = useState<AuthConfig>({ enabled: false, signedIn: false });

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
        if (!cancelled) setConfig({ enabled: false, signedIn: false });
      })
      .finally(() => clearTimeout(timer));

    return () => {
      cancelled = true;
      clearTimeout(timer);
      controller.abort();
    };
  }, []);

  // Solange die Konfiguration noch nicht geladen ist (bzw. Login deaktiviert),
  // die App direkt zeigen – kein „Laden…“.
  if (!config.enabled) return <>{children}</>;

  return <AuthGateInner children={children} config={config} />;
}
