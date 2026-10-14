"use client";

import { Loader2, Sparkles } from "lucide-react";
import { useEffect, useState } from "react";

import { GlassCard } from "@/components/werwolf/glass-card";
import { authClient } from "@/lib/auth/client";
import { NARRATION_LABELS, type NarrationKind } from "@/lib/game-master";
import type { LobbyNarration } from "@/lib/game";

type Config = { enabled: boolean; url: string | null };

/**
 * AI Game Master: holt einen Text aus der Neon Function `gamemaster`
 * (siehe functions/gamemaster.ts). Der Browser ruft die Function direkt auf und
 * schickt ein kurzlebiges Neon-Auth-JWT mit – die Function prüft es gegen die
 * Branch-JWKS und schreibt den Text nach Postgres; über das Lobby-Polling kommt
 * er bei allen Spielern an.
 */
export function GameMasterCard({
  code,
  playerId,
  gameStarted,
  narration,
  onNarration,
}: {
  code: string;
  playerId: string | null;
  gameStarted: boolean;
  narration: LobbyNarration | null;
  onNarration: (narration: LobbyNarration) => void;
}) {
  const [config, setConfig] = useState<Config | null>(null);
  const [busyKind, setBusyKind] = useState<NarrationKind | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/config", { cache: "no-store" })
      .then((response) => response.json())
      .then((body: { gameMaster?: Config }) => {
        if (!cancelled) {
          setConfig({
            enabled: Boolean(body.gameMaster?.enabled),
            url: body.gameMaster?.url ?? null,
          });
        }
      })
      .catch(() => {
        if (!cancelled) setConfig({ enabled: false, url: null });
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const request = async (kind: NarrationKind) => {
    if (!config?.url || busyKind) return;
    setBusyKind(kind);
    setError(null);

    try {
      // Kurzlebiges JWT aus der Neon-Auth-Session (15 Min gültig).
      const token = await authClient.token();
      if (token.error || !token.data?.token) {
        setError("Sitzung abgelaufen – bitte neu anmelden.");
        return;
      }

      const response = await fetch(`${config.url}/narration`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token.data.token}`,
        },
        body: JSON.stringify({ code, kind, playerId }),
      });
      const body = (await response.json().catch(() => null)) as
        | { ok?: boolean; reason?: string; narration?: LobbyNarration }
        | null;

      if (response.ok && body?.ok && body.narration) {
        onNarration(body.narration);
        return;
      }
      if (response.status === 401) setError("Sitzung abgelaufen – bitte neu anmelden.");
      else if (response.status === 403) setError("Du bist nicht (mehr) Mitglied dieser Lobby.");
      else if (response.status === 503) setError("Das AI Gateway ist noch nicht bereit.");
      else setError("Der Game Master konnte keinen Text erzeugen.");
    } catch {
      setError("Game Master ist nicht erreichbar.");
    } finally {
      setBusyKind(null);
    }
  };

  const kinds: NarrationKind[] = gameStarted ? ["night", "recap"] : ["intro", "recap"];

  return (
    <GlassCard className="p-4">
      <p className="flex items-center gap-2 text-xs font-black uppercase tracking-[0.28em] text-white/50">
        <Sparkles size={14} />
        AI Game Master
      </p>

      {config && !config.enabled ? (
        <p className="mt-3 text-sm font-semibold text-white/35">
          Nicht konfiguriert – `neon deploy` muss die Function `gamemaster` deployen
          (NEON_FUNCTION_GAMEMASTER_BASE_URL).
        </p>
      ) : (
        <>
          <div className="mt-3 min-h-[4.5rem] rounded-[1.2rem] border border-white/15 bg-white/[0.06] px-4 py-3">
            {narration ? (
              <>
                <p className="text-[0.65rem] font-black uppercase tracking-[0.24em] text-white/40">
                  {NARRATION_LABELS[narration.kind as NarrationKind] ?? narration.kind}
                  {narration.model ? ` · ${narration.model}` : ""}
                </p>
                <p className="mt-2 text-sm font-semibold italic leading-relaxed text-white/85">
                  „{narration.text}“
                </p>
              </>
            ) : (
              <p className="text-sm font-semibold text-white/40">
                Noch kein Text – der Spielleiter wartet auf seinen Auftritt.
              </p>
            )}
          </div>

          <div className="mt-3 flex flex-col gap-2">
            {kinds.map((kind) => (
              <button
                key={kind}
                onClick={() => void request(kind)}
                disabled={busyKind !== null || !playerId}
                className="flex items-center justify-center gap-2 rounded-[1rem] border border-white/25 bg-white/10 px-4 py-2.5 text-[0.8rem] font-black uppercase tracking-[0.16em] text-white transition-all duration-200 hover:bg-white/20 disabled:opacity-50"
              >
                {busyKind === kind ? <Loader2 size={15} className="animate-spin" /> : null}
                {busyKind === kind ? "Der Spielleiter schreibt…" : NARRATION_LABELS[kind]}
              </button>
            ))}
          </div>

          {error && (
            <p role="alert" className="mt-3 text-xs font-bold uppercase tracking-[0.14em] text-red-300">
              {error}
            </p>
          )}
        </>
      )}
    </GlassCard>
  );
}
