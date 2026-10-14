"use client";

import { useState } from "react";

import { SkyBackground } from "@/components/werwolf/sky-background";
import { GlassCard } from "@/components/werwolf/glass-card";
import { authClient } from "@/lib/auth/client";

type Mode = "signIn" | "signUp";

/**
 * Anmeldung über Neon Auth (Managed Better Auth). Der Client spricht mit der
 * same-origin Route `/api/auth/*`; E-Mails (Verifizierung, Passwort-Reset)
 * verschickt Neon Auth selbst.
 */
export function SignInScreen({ onDone }: { onDone?: () => void }) {
  const [mode, setMode] = useState<Mode>("signIn");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setError(null);
    setNotice(null);

    try {
      const result =
        mode === "signIn"
          ? await authClient.signIn.email({ email, password })
          : await authClient.signUp.email({ email, password, name: name || email });

      if (result.error) {
        setError(result.error.message ?? "Anmeldung fehlgeschlagen.");
        return;
      }
      setNotice(
        mode === "signUp"
          ? "Konto erstellt – falls eine Bestätigungsmail kommt, bitte den Code eingeben."
          : null,
      );
      onDone?.();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unbekannter Fehler.");
    } finally {
      setBusy(false);
    }
  };

  const inputClass =
    "w-full rounded-[1rem] border border-white/20 bg-white/5 px-4 py-3 text-base font-semibold text-white placeholder-white/35 outline-none transition-colors focus:border-white/45 focus:bg-white/10";

  return (
    <div className="relative min-h-screen w-full overflow-hidden bg-[#0b1220] text-white">
      <SkyBackground isActive />
      <div className="relative z-10 flex min-h-screen items-center justify-center px-4 py-10">
        <GlassCard className="w-full max-w-[26rem] p-6 sm:p-8">
          <p className="text-xs font-black uppercase tracking-[0.32em] text-white/50">
            Werwolf Lobby
          </p>
          <h1 className="mt-2 text-[2rem] font-black uppercase leading-none tracking-tight sm:text-[2.4rem]">
            {mode === "signIn" ? "Anmelden" : "Konto erstellen"}
          </h1>
          <p className="mt-3 text-sm font-semibold text-white/55">
            {mode === "signIn"
              ? "Melde dich an, um eine Lobby zu erstellen oder beizutreten."
              : "Erstelle ein Konto, um mitspielen zu können."}
          </p>

          <form onSubmit={submit} className="mt-6 flex flex-col gap-3">
            {mode === "signUp" && (
              <input
                className={inputClass}
                type="text"
                autoComplete="nickname"
                placeholder="Spielname"
                value={name}
                onChange={(event) => setName(event.target.value)}
              />
            )}
            <input
              className={inputClass}
              type="email"
              autoComplete="email"
              placeholder="E-Mail"
              required
              value={email}
              onChange={(event) => setEmail(event.target.value)}
            />
            <input
              className={inputClass}
              type="password"
              autoComplete={mode === "signIn" ? "current-password" : "new-password"}
              placeholder="Passwort"
              required
              minLength={8}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
            />

            {error && (
              <p
                role="alert"
                className="rounded-[1rem] border border-red-400/40 bg-red-500/15 px-3 py-2 text-sm font-semibold text-red-100"
              >
                {error}
              </p>
            )}
            {notice && (
              <p className="rounded-[1rem] border border-emerald-400/40 bg-emerald-500/15 px-3 py-2 text-sm font-semibold text-emerald-100">
                {notice}
              </p>
            )}

            <button
              type="submit"
              disabled={busy}
              className="mt-1 rounded-[1.2rem] border border-white/30 bg-white/15 px-5 py-3 text-[1.05rem] font-black uppercase tracking-[0.16em] text-white transition-all duration-200 hover:-translate-y-0.5 hover:bg-white hover:text-black disabled:animate-pulse disabled:opacity-60"
            >
              {busy ? "Bitte warten…" : mode === "signIn" ? "Anmelden" : "Registrieren"}
            </button>
          </form>

          <button
            onClick={() => {
              setMode(mode === "signIn" ? "signUp" : "signIn");
              setError(null);
              setNotice(null);
            }}
            className="mt-4 w-full text-center text-sm font-bold uppercase tracking-[0.18em] text-white/60 transition-colors hover:text-white"
          >
            {mode === "signIn"
              ? "Noch kein Konto? Registrieren"
              : "Schon registriert? Anmelden"}
          </button>
        </GlassCard>
      </div>
    </div>
  );
}
