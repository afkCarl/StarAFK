"use client";

import {
  Check,
  ChevronLeft,
  ChevronRight,
  Copy,
  Info,
  Minus,
  Plus,
  Trash2,
  X,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

import { GlassCard } from "@/components/werwolf/glass-card";
import { RoleIcon } from "@/components/werwolf/role-icon";
import { SkyBackground } from "@/components/werwolf/sky-background";
import { WalkingCat } from "@/components/werwolf/walking-cat";
import {
  DEFAULT_COLOR,
  MODES,
  ROLES,
  colorWash,
  randomName,
  winCondition,
  type LobbyPlayer,
  type LobbyState,
  type PlayerProfile,
  type Role,
} from "@/lib/game";

const PROFILE_KEY = "werwolf-player-profile";

const FRAME_OPTIONS = [
  { id: "none", name: "Kein Rahmen" },
  { id: "frame1", name: "Rahmen 1" },
  { id: "frame2", name: "Rahmen 2" },
  { id: "frame3", name: "Rahmen 3" },
  { id: "frame4", name: "Rahmen 4" },
  { id: "frame5", name: "Rahmen 5" },
];

type Screen = "menu" | "menuLeaving" | "lobbyEntering" | "lobby";
type SlidePhase = "idle" | "start" | "go";
type JoinPanel = "closed" | "opening" | "open" | "closing";
type Direction = "left" | "right";

function loadStoredProfile<K extends keyof PlayerProfile>(
  key: K,
  fallback: PlayerProfile[K],
): PlayerProfile[K] {
  try {
    const stored = JSON.parse(localStorage.getItem(PROFILE_KEY) || "{}");
    return stored[key] ?? fallback;
  } catch {
    return fallback;
  }
}

export default function WerwolfApp() {
  const [modeIndex, setModeIndex] = useState(0);
  const [prevModeIndex, setPrevModeIndex] = useState<number | null>(null);
  const [modeLocked, setModeLocked] = useState(false);
  const [direction, setDirection] = useState<Direction>("right");
  const [slidePhase, setSlidePhase] = useState<SlidePhase>("idle");
  const [joinPanel, setJoinPanel] = useState<JoinPanel>("closed");
  const [screen, setScreen] = useState<Screen>("menu");
  const [joinCode, setJoinCode] = useState("");
  const [copied, setCopied] = useState(false);
  const [selfId, setSelfId] = useState<string | null>(null);
  const [lobbyCode, setLobbyCode] = useState("");
  const [roleModalOpen, setRoleModalOpen] = useState(false);
  const [roleDetail, setRoleDetail] = useState<string | null>(null);
  const [players, setPlayers] = useState<LobbyPlayer[]>([]);
  const [isHost, setIsHost] = useState(true);
  const [defaultCounts] = useState<Record<string, number>>(() => {
    const counts = Object.fromEntries(ROLES.map((r) => [r.name, 0]));
    counts.Werwolf = 1;
    counts.Dorfbewohner = 2;
    return counts;
  });
  const [roleCounts, setRoleCounts] = useState<Record<string, number>>(defaultCounts);
  const [cardModalOpen, setCardModalOpen] = useState(false);
  const [gameStarted, setGameStarted] = useState(false);
  const [busy, setBusy] = useState<null | "create" | "join" | "start">(null);
  const [actionError, setActionError] = useState<string | null>(null);

  // Deterministische Initialwerte; localStorage wird nach dem Mount geladen,
  // damit Server-Render und Hydration identisch sind (Multi-Tab-sicher).
  const [name, setName] = useState<string>("Player");
  const [color, setColor] = useState<string>(DEFAULT_COLOR);
  const [fadeIntensity, setFadeIntensity] = useState<number>(50);
  const [nameWarn, setNameWarn] = useState(false);
  const [frame, setFrame] = useState<string>("none");
  const [image, setImage] = useState<string | null>(null);
  const [failedFrames, setFailedFrames] = useState<Record<string, boolean>>({});

  const fileInputRef = useRef<HTMLInputElement>(null);
  const switchStartRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const switchEndRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const joinTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const leaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const enterTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lobbyCodeRef = useRef("");
  const selfIdRef = useRef<string | null>(null);

  lobbyCodeRef.current = lobbyCode;
  selfIdRef.current = selfId;

  // Gespeichertes Profil nach dem Mount laden.
  useEffect(() => {
    setName(loadStoredProfile("name", randomName()));
    setColor(loadStoredProfile("color", DEFAULT_COLOR));
    setFadeIntensity(loadStoredProfile("fadeIntensity", 50));
    setFrame(loadStoredProfile("frame", "none"));
    setImage(loadStoredProfile("image", null));
  }, []);

  // Einladungslinks (?code=ABCDEF) öffnen das Beitreten-Feld vorausgefüllt —
  // so kann die Lobby einfach in einem anderen Tab / Gerät geöffnet werden.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const code = (params.get("code") ?? "")
      .toUpperCase()
      .replace(/[^A-Z]/g, "")
      .slice(0, 6);
    if (code.length === 6) {
      setJoinCode(code);
      setJoinPanel("opening");
      joinTimerRef.current = setTimeout(() => setJoinPanel("open"), 20);
    }
  }, []);

  const skipInitialPersist = useRef(true);
  useEffect(() => {
    if (skipInitialPersist.current) {
      skipInitialPersist.current = false;
      return;
    }
    localStorage.setItem(
      PROFILE_KEY,
      JSON.stringify({ name, color, fadeIntensity, frame, image }),
    );
  }, [name, color, fadeIntensity, frame, image]);

  const profile = useMemo<PlayerProfile>(
    () => ({
      name: name.trim() || "Player",
      color,
      fadeIntensity,
      frame,
      image,
    }),
    [name, color, fadeIntensity, frame, image],
  );

  const applyState = (state: LobbyState) => {
    setLobbyCode(state.code);
    setPlayers(state.players);
    setRoleCounts(state.roleCounts);
    setGameStarted(Boolean(state.gameStarted));
    setSelfId((current) => {
      if (current) {
        const self = state.players.find((p) => p.id === current);
        if (self) setIsHost(self.isHost);
      }
      return current;
    });
  };

  // Poll lobby state while inside a lobby (replaces the original socket push).
  useEffect(() => {
    if (screen !== "lobby" && screen !== "lobbyEntering") return;
    let cancelled = false;

    const poll = async () => {
      const code = lobbyCodeRef.current;
      const pid = selfIdRef.current;
      if (!code || !pid) return;
      try {
        const res = await fetch(
          `/api/lobby/state?code=${encodeURIComponent(code)}&pid=${encodeURIComponent(pid)}`,
          { cache: "no-store" },
        );
        if (cancelled) return;
        if (!res.ok) {
          setScreen("menu");
          setSelfId(null);
          setPlayers([]);
          setActionError(
            "Die Lobby ist nicht mehr verfügbar – sie wurde geschlossen oder du wurdest entfernt.",
          );
          return;
        }
        const data = await res.json();
        if (!cancelled && data?.ok) applyState(data.state as LobbyState);
      } catch {
        /* keep polling */
      }
    };

    poll();
    const interval = setInterval(poll, 1200);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [screen]);

  // Push profile changes (debounced) while inside a lobby.
  useEffect(() => {
    if (screen === "lobby" || screen === "lobbyEntering") {
      const timeout = setTimeout(() => {
        const code = lobbyCodeRef.current;
        const pid = selfIdRef.current;
        if (!code || !pid) return;
        fetch("/api/lobby/profile", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ code, playerId: pid, profile }),
        }).catch(() => {});
      }, 150);
      return () => clearTimeout(timeout);
    }
  }, [profile, screen]);

  // Leave the lobby when the tab is closed.
  useEffect(() => {
    const handler = () => {
      const code = lobbyCodeRef.current;
      const pid = selfIdRef.current;
      if (!code || !pid) return;
      const body = new Blob([JSON.stringify({ code, playerId: pid })], {
        type: "application/json",
      });
      navigator.sendBeacon("/api/lobby/leave", body);
    };
    window.addEventListener("pagehide", handler);
    return () => window.removeEventListener("pagehide", handler);
  }, []);

  useEffect(
    () => () => {
      [switchStartRef, switchEndRef, joinTimerRef, leaveTimerRef, enterTimerRef].forEach(
        (ref) => {
          if (ref.current) clearTimeout(ref.current);
        },
      );
    },
    [],
  );

  const handleImageUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = () => setImage(String(reader.result));
      reader.readAsDataURL(file);
    }
  };

  const mode = MODES[modeIndex];
  const prevMode = prevModeIndex !== null ? MODES[prevModeIndex] : null;
  const modeLabel = mode.title === "WERWOLF" ? "Werwolf (Standard)" : mode.title;
  const modeShort = mode.title === "WERWOLF" ? "WW" : mode.title.slice(0, 2);
  const inMenu = screen === "menu" || screen === "menuLeaving";
  const inLobby = screen === "lobbyEntering" || screen === "lobby";
  const isDark = (inMenu && mode.title === "WERWOLF") || inLobby;
  const selectedRoles = ROLES.filter((role) => roleCounts[role.name] > 0);

  const switchMode = (nextIndex: number, dir: Direction) => {
    if (modeLocked || screen !== "menu") return;
    setModeLocked(true);
    setDirection(dir);
    setPrevModeIndex(modeIndex);
    setModeIndex(nextIndex);
    setSlidePhase("start");
    switchStartRef.current = setTimeout(() => setSlidePhase("go"), 20);
    switchEndRef.current = setTimeout(() => {
      setPrevModeIndex(null);
      setSlidePhase("idle");
      setModeLocked(false);
    }, 470);
  };
  const nextMode = () => switchMode((modeIndex + 1) % MODES.length, "right");
  const prevModeFn = () =>
    switchMode((modeIndex - 1 + MODES.length) % MODES.length, "left");

  const toggleJoinPanel = () => {
    if (screen !== "menu") return;
    if (joinTimerRef.current) clearTimeout(joinTimerRef.current);
    if (joinPanel === "closed") {
      setJoinPanel("opening");
      joinTimerRef.current = setTimeout(() => setJoinPanel("open"), 20);
    } else if (joinPanel === "open") {
      setJoinPanel("closing");
      joinTimerRef.current = setTimeout(() => {
        setJoinPanel("closed");
        setJoinCode("");
      }, 350);
    }
  };

  const copyCode = () => {
    navigator.clipboard.writeText(lobbyCode).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  };

  const enterLobby = (
    code: string,
    lobbyPlayers: LobbyPlayer[],
    host: boolean,
    id: string,
    counts: Record<string, number>,
    started: boolean,
  ) => {
    setSelfId(id);
    setLobbyCode(code);
    setIsHost(host);
    setPlayers(lobbyPlayers);
    setRoleCounts(counts);
    setGameStarted(started);
    setScreen("menuLeaving");
    leaveTimerRef.current = setTimeout(() => {
      setScreen("lobbyEntering");
      enterTimerRef.current = setTimeout(() => setScreen("lobby"), 20);
    }, 440);
  };

  const handleCreate = () => {
    if (screen !== "menu" || modeLocked || busy) return;
    if (mode.title !== "WERWOLF") return;
    if (joinTimerRef.current) clearTimeout(joinTimerRef.current);
    setJoinPanel("closed");
    setJoinCode("");
    setCopied(false);
    setRoleModalOpen(false);
    setActionError(null);
    setBusy("create");
    fetch("/api/lobby/create", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mode: mode.title, profile }),
    })
      .then(async (res) => {
        const data = await res.json().catch(() => null);
        if (!res.ok || !data?.ok) throw new Error("create failed");
        enterLobby(
          data.lobby.code,
          data.lobby.players,
          true,
          data.selfId,
          data.lobby.roleCounts,
          Boolean(data.lobby.gameStarted),
        );
      })
      .catch(() => {
        setActionError(
          "Lobby konnte nicht erstellt werden – Server oder Datenbank nicht erreichbar. Bitte versuche es gleich noch einmal.",
        );
      })
      .finally(() => setBusy(null));
  };

  const handleJoin = () => {
    if (screen !== "menu" || modeLocked || busy) return;
    if (joinCode.length !== 6) {
      setActionError("Bitte gib einen 6-stelligen Lobbycode ein (A–Z).");
      return;
    }
    if (joinTimerRef.current) clearTimeout(joinTimerRef.current);
    setCopied(false);
    setRoleModalOpen(false);
    setActionError(null);
    setBusy("join");
    fetch("/api/lobby/join", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code: joinCode, profile }),
    })
      .then(async (res) => {
        const data = await res.json().catch(() => null);
        if (!res.ok || !data?.ok) {
          if (data?.reason === "full") {
            throw new Error("full");
          }
          throw new Error("not_found");
        }
        const self = (data.lobby.players as LobbyPlayer[]).find(
          (p) => p.id === data.selfId,
        );
        setJoinPanel("closed");
        setJoinCode("");
        enterLobby(
          data.lobby.code,
          data.lobby.players,
          self?.isHost || false,
          data.selfId,
          data.lobby.roleCounts,
          Boolean(data.lobby.gameStarted),
        );
      })
      .catch((error: unknown) => {
        const message =
          error instanceof Error && error.message === "full"
            ? "Die Lobby ist leider voll (max. 12 Spieler)."
            : error instanceof Error && error.message === "not_found"
              ? "Lobby mit diesem Code wurde nicht gefunden."
              : "Beitreten fehlgeschlagen – der Server ist gerade nicht erreichbar.";
        setActionError(message);
      })
      .finally(() => setBusy(null));
  };

  const handleStartGame = (started: boolean) => {
    const code = lobbyCodeRef.current;
    const pid = selfIdRef.current;
    if (!code || !pid || busy) return;
    setActionError(null);
    setBusy("start");
    fetch("/api/lobby/start", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code, playerId: pid, started }),
    })
      .then(async (res) => {
        const data = await res.json().catch(() => null);
        if (!res.ok || !data?.ok) throw new Error("start failed");
        setGameStarted(started);
      })
      .catch(() => {
        setActionError(
          started
            ? "Das Spiel konnte nicht gestartet werden. Bitte versuche es erneut."
            : "Das Spiel konnte nicht zurückgesetzt werden.",
        );
      })
      .finally(() => setBusy(null));
  };

  const changeRoleCount = (roleName: string, delta: number) => {
    if (!isHost) return;
    const next = {
      ...roleCounts,
      [roleName]: Math.max(0, (roleCounts[roleName] ?? 0) + delta),
    };
    setRoleCounts(next);
    const code = lobbyCodeRef.current;
    const pid = selfIdRef.current;
    if (!code || !pid) return;
    fetch("/api/lobby/roles", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code, playerId: pid, roleCounts: next }),
    }).catch(() => {});
  };

  // --- animation helpers -------------------------------------------------
  const outgoingStyle = (): React.CSSProperties =>
    slidePhase === "start"
      ? { transform: "translateX(0)", opacity: 1, transition: "none" }
      : slidePhase === "go"
        ? {
            transform: `translateX(${direction === "right" ? "-115%" : "115%"})`,
            opacity: 0,
            transition:
              "transform 420ms cubic-bezier(0.4,0,0.2,1), opacity 420ms ease",
          }
        : { transform: "translateX(0)", opacity: 1 };

  const incomingStyle = (): React.CSSProperties =>
    slidePhase === "start"
      ? {
          transform: `translateX(${direction === "right" ? "115%" : "-115%"})`,
          opacity: 0,
          transition: "none",
        }
      : slidePhase === "go"
        ? {
            transform: "translateX(0)",
            opacity: 1,
            transition:
              "transform 420ms cubic-bezier(0.22,1,0.36,1), opacity 420ms ease",
          }
        : { transform: "translateX(0)", opacity: 1 };

  const joinPanelStyle = (): React.CSSProperties =>
    joinPanel === "opening"
      ? { transform: "translateX(-100vw)", opacity: 0, transition: "none" }
      : joinPanel === "closing"
        ? {
            transform: "translateX(-100vw)",
            opacity: 0,
            transition:
              "transform 350ms cubic-bezier(0.4,0,0.2,1), opacity 350ms ease",
          }
        : joinPanel === "open"
          ? {
              transform: "translateX(0)",
              opacity: 1,
              transition:
                "transform 350ms cubic-bezier(0.22,1,0.36,1), opacity 350ms ease",
            }
          : {};

  const leftExitStyle = (): React.CSSProperties =>
    screen === "menuLeaving"
      ? {
          transform: "translateX(-110vw)",
          opacity: 0,
          transition:
            "transform 440ms cubic-bezier(0.4,0,0.2,1), opacity 300ms ease",
        }
      : { transform: "translateX(0)", opacity: 1 };

  const rightExitStyle = (): React.CSSProperties =>
    screen === "menuLeaving"
      ? {
          transform: "translateX(110vw)",
          opacity: 0,
          transition:
            "transform 440ms cubic-bezier(0.4,0,0.2,1), opacity 300ms ease",
        }
      : { transform: "translateX(0)", opacity: 1 };

  const lobbyEnterStyle = (): React.CSSProperties =>
    screen === "lobbyEntering"
      ? { transform: "translateY(110%)", opacity: 0, transition: "none" }
      : screen === "lobby"
        ? {
            transform: "translateY(0)",
            opacity: 1,
            transition:
              "transform 520ms cubic-bezier(0.22,1,0.36,1), opacity 520ms ease",
          }
        : {};

  const menuButtons =
    "w-fit text-left text-[1.75rem] font-bold uppercase transition-all duration-200 hover:translate-x-3 hover:text-neutral-400 sm:text-[2.1rem]";

  const detailRole: Role | null = roleDetail
    ? (ROLES.find((r) => r.name === roleDetail) ?? null)
    : null;

  return (
    <div
      className={`relative min-h-screen w-full overflow-hidden transition-colors duration-700 ${
        isDark ? "bg-[#0b1220] text-white" : "bg-white text-black"
      }`}
    >
      <SkyBackground isActive={isDark} />

      {actionError && (
        <div
          className="fixed inset-x-0 bottom-4 z-[60] flex justify-center px-4"
          role="alert"
        >
          <div className="flex max-w-[min(36rem,92vw)] items-start gap-3 rounded-[1.2rem] border border-red-400/40 bg-red-950/90 px-4 py-3 text-sm font-semibold text-red-100 shadow-2xl backdrop-blur-md">
            <span className="leading-relaxed">{actionError}</span>
            <button
              onClick={() => setActionError(null)}
              aria-label="Fehlermeldung schließen"
              className="mt-0.5 shrink-0 text-red-200/70 transition-colors hover:text-red-100"
            >
              <X size={16} />
            </button>
          </div>
        </div>
      )}

      {inMenu && (
        <>
          <div
            className="relative z-10 flex min-h-screen flex-col px-4 py-3 sm:px-6 sm:py-4 md:px-8 md:py-5"
            style={leftExitStyle()}
          >
            <div className="relative flex flex-col pt-0.5">
              <p className="text-[1.4rem] font-black uppercase tracking-wide sm:text-[1.6rem]">
                SPIELMODUS {modeIndex + 1}/{MODES.length}
              </p>
              <div className="relative mt-0.5 min-h-[14rem] -translate-y-2 overflow-hidden sm:min-h-[16rem] md:min-h-[18rem]">
                {prevMode && slidePhase !== "idle" && (
                  <div className="absolute inset-0" style={outgoingStyle()}>
                    <h1 className="overflow-visible whitespace-nowrap pt-1 text-[clamp(4rem,8vw,8rem)] font-black uppercase leading-none tracking-tight">
                      {prevMode.title}
                    </h1>
                    <div
                      className={`mt-2 h-[4px] w-full max-w-[57rem] bg-gradient-to-r to-transparent ${
                        isDark ? "from-white" : "from-black"
                      }`}
                    />
                    <p className="mt-3 w-[66vw] text-base font-semibold sm:text-lg">
                      {prevMode.description}
                    </p>
                  </div>
                )}
                <div
                  className={slidePhase !== "idle" ? "absolute inset-0" : ""}
                  style={slidePhase !== "idle" ? incomingStyle() : {}}
                >
                  <h1 className="overflow-visible whitespace-nowrap pt-1 text-[clamp(4rem,8vw,8rem)] font-black uppercase leading-none tracking-tight">
                    {mode.title}
                  </h1>
                  <div
                    className={`mt-2 h-[4px] w-full max-w-[57rem] bg-gradient-to-r to-transparent ${
                      isDark ? "from-white" : "from-black"
                    }`}
                  />
                  <p className="mt-3 w-[66vw] text-base font-semibold sm:text-lg">
                    {mode.description}
                  </p>
                </div>
              </div>
            </div>
            <div className="mt-auto mb-4 flex flex-col gap-2">
              <button onClick={() => setCardModalOpen(true)} className={menuButtons}>
                Spielerkarte
              </button>
              <button className={menuButtons}>Statistiken</button>
              <button className={menuButtons}>Einstellungen</button>
            </div>
          </div>

          <button
            onClick={prevModeFn}
            className="absolute left-1 top-[42%] z-20 -translate-y-1/2 p-3 transition-all duration-200 hover:-translate-x-1 hover:scale-110 hover:text-neutral-400 sm:left-2 md:left-3"
            aria-label="Vorheriger Gamemode"
            style={leftExitStyle()}
          >
            <ChevronLeft size={72} strokeWidth={1.5} />
          </button>
          <button
            onClick={nextMode}
            className="absolute right-1 top-[42%] z-20 -translate-y-1/2 p-3 transition-all duration-200 hover:translate-x-1 hover:scale-110 hover:text-neutral-400 sm:right-2 md:right-3"
            aria-label="Nächster Gamemode"
            style={rightExitStyle()}
          >
            <ChevronRight size={72} strokeWidth={1.5} />
          </button>

          <div
            className="absolute left-4 top-[calc(42%+120px)] z-20 flex flex-col gap-3 sm:left-6 md:left-8"
            style={leftExitStyle()}
          >
            <button
              onClick={handleCreate}
              disabled={busy === "create"}
              className={`w-fit text-left text-[1.75rem] font-bold uppercase transition-all duration-200 sm:text-[2.1rem] ${
                mode.title === "WERWOLF"
                  ? "hover:translate-x-3 hover:text-neutral-400"
                  : "cursor-not-allowed opacity-30"
              } ${busy === "create" ? "animate-pulse opacity-70" : ""}`}
            >
              {busy === "create" ? "Erstelle Lobby…" : "Lobby erstellen"}
            </button>
            <div className="flex w-fit flex-col">
              <button onClick={toggleJoinPanel} className={menuButtons}>
                Lobby beitreten
              </button>
              {joinPanel !== "closed" && (
                <div
                  className="mt-4 flex items-end justify-between border-b-2 border-current pb-1"
                  style={joinPanelStyle()}
                >
                  <input
                    type="text"
                    value={joinCode}
                    onChange={(e) =>
                      setJoinCode(
                        e.target.value
                          .toUpperCase()
                          .replace(/[^A-Z]/g, "")
                          .slice(0, 6),
                      )
                    }
                    onKeyDown={(e) => {
                      if (e.key === "Enter") handleJoin();
                    }}
                    placeholder="LOBBY-CODE"
                    maxLength={6}
                    className="w-full bg-transparent text-[1.4rem] font-medium tracking-widest outline-none placeholder:text-neutral-400 sm:text-[1.6rem]"
                    autoFocus
                  />
                  <button
                    onClick={handleJoin}
                    disabled={busy === "join"}
                    className="ml-4 shrink-0 text-[1.4rem] font-bold uppercase transition-all hover:text-neutral-400 disabled:animate-pulse disabled:opacity-60 sm:text-[1.6rem]"
                  >
                    {busy === "join" ? "Trete bei…" : "Beitreten"}
                  </button>
                </div>
              )}
            </div>
          </div>

          {cardModalOpen && (
            <div
              className="absolute inset-0 z-50 flex items-center justify-center bg-[#030712]/85 px-4 py-6 backdrop-blur-lg"
              onClick={() => setCardModalOpen(false)}
            >
              <div
                className="flex w-full max-w-[95vw] items-center justify-center gap-8"
                onClick={(e) => e.stopPropagation()}
              >
                <div
                  className="custom-scroll flex max-h-[85vh] shrink-0 flex-col overflow-y-auto rounded-[2rem] border border-white/10 bg-[#0c1525]/95 p-6 shadow-[0_18px_80px_rgba(0,0,0,0.6)] backdrop-blur-2xl sm:p-8"
                  style={{ width: "780px" }}
                >
                  <div className="flex shrink-0 items-center justify-between gap-4 border-b border-white/10 pb-3">
                    <div>
                      <p className="text-[0.65rem] font-black uppercase tracking-[0.3em] text-white/45">
                        Profil anpassen
                      </p>
                      <h2 className="mt-1 text-[1.5rem] font-black uppercase text-white">
                        Spielerkarte
                      </h2>
                    </div>
                    <button
                      onClick={() => setCardModalOpen(false)}
                      className="group flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-white/10 text-white/50 transition-all duration-200 hover:border-white/30 hover:bg-white/10 hover:text-white"
                    >
                      <X
                        size={20}
                        className="transition-transform duration-200 group-hover:rotate-90"
                      />
                    </button>
                  </div>
                  <div className="mt-5 flex flex-col gap-5">
                    <div>
                      <div className="mb-1.5 flex items-center justify-between">
                        <label className="block text-xs font-black uppercase tracking-[0.2em] text-white/60">
                          User:
                        </label>
                        {nameWarn && (
                          <span className="animate-pulse text-[0.65rem] font-bold uppercase tracking-wider text-red-400">
                            (Max. Zeichen erreicht)
                          </span>
                        )}
                      </div>
                      <input
                        type="text"
                        maxLength={12}
                        value={name}
                        onKeyDown={(e) => {
                          if (
                            e.key === "Backspace" ||
                            e.key === "Delete" ||
                            e.key.includes("Arrow")
                          )
                            return;
                          if (name.length >= 12 && e.key.length === 1) {
                            setNameWarn(true);
                            setTimeout(() => setNameWarn(false), 2000);
                          }
                        }}
                        onChange={(e) =>
                          setName(e.target.value.replace(/[^a-zA-Z0-9 ]/g, ""))
                        }
                        className="w-full rounded-[0.9rem] border border-white/20 bg-white/5 px-3 py-2.5 text-base font-bold text-white outline-none transition-all focus:border-white/40 focus:bg-white/10"
                        placeholder="Dein Name"
                      />
                    </div>
                    <div>
                      <label className="mb-1.5 block text-xs font-black uppercase tracking-[0.2em] text-white/60">
                        Farbe:
                      </label>
                      <div className="grid grid-cols-[8.5rem_1fr] gap-4 rounded-[1rem] border border-white/10 bg-white/[0.03] p-3.5">
                        <div className="flex flex-col justify-center gap-2">
                          <div className="flex items-center gap-3">
                            <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-full border-2 border-white/20">
                              <input
                                type="color"
                                value={color}
                                onChange={(e) => setColor(e.target.value)}
                                className="absolute -inset-2 h-[150%] w-[150%] cursor-pointer border-none bg-transparent"
                              />
                            </div>
                            <span className="font-mono text-[0.72rem] font-bold text-white/45">
                              {color.toUpperCase()}
                            </span>
                          </div>
                        </div>
                        <div className="flex flex-col justify-center gap-1.5">
                          <div className="flex items-center justify-between text-[0.68rem] font-black uppercase tracking-[0.18em] text-white/55">
                            <span>Intensität</span>
                            <span className="text-white/85">{fadeIntensity}%</span>
                          </div>
                          <input
                            type="range"
                            min="0"
                            max="100"
                            value={fadeIntensity}
                            onChange={(e) => setFadeIntensity(Number(e.target.value))}
                            className="card-slider"
                          />
                        </div>
                      </div>
                    </div>
                    <div>
                      <label className="mb-1.5 block text-xs font-black uppercase tracking-[0.2em] text-white/60">
                        Profilbild:
                      </label>
                      <input
                        type="file"
                        ref={fileInputRef}
                        onChange={handleImageUpload}
                        className="hidden"
                        accept="image/*"
                      />
                      <div className="flex items-center gap-3">
                        <button
                          onClick={() => fileInputRef.current?.click()}
                          className="rounded-[0.9rem] border border-white/20 bg-white/5 px-4 py-2.5 text-xs font-bold uppercase tracking-[0.1em] text-white transition-all hover:bg-white/10"
                        >
                          Bild hochladen
                        </button>
                        {image && (
                          <button
                            onClick={() => setImage(null)}
                            className="flex h-10 w-10 items-center justify-center rounded-[0.9rem] border border-red-500/30 bg-red-500/10 text-red-400 transition-all hover:border-red-500/50 hover:bg-red-500/20"
                          >
                            <Trash2 size={16} />
                          </button>
                        )}
                      </div>
                    </div>
                    <div>
                      <label className="mb-1.5 block text-xs font-black uppercase tracking-[0.2em] text-white/60">
                        Spielerrahmen wählen
                      </label>
                      <div className="grid grid-cols-2 gap-4">
                        {FRAME_OPTIONS.map((option) => (
                          <button
                            key={option.id}
                            onClick={() => setFrame(option.id)}
                            className={`flex flex-col items-center justify-center overflow-hidden rounded-[1.4rem] border transition-all ${
                              frame === option.id
                                ? "border-white/60 bg-white/15 ring-1 ring-white/30"
                                : "border-white/15 bg-white/5 hover:border-white/30 hover:bg-white/10"
                            }`}
                            style={{ width: "351.5px", height: "200.3px" }}
                          >
                            {option.id !== "none" && !failedFrames[option.id] ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img
                                src={`/frames/${option.id}.png`}
                                alt={option.name}
                                className="h-full w-full object-contain p-2 opacity-70"
                                onError={() =>
                                  setFailedFrames((prev) => ({
                                    ...prev,
                                    [option.id]: true,
                                  }))
                                }
                              />
                            ) : null}
                            <span
                              className={`text-[0.65rem] font-bold uppercase tracking-[0.12em] ${
                                option.id !== "none" && !failedFrames[option.id]
                                  ? "hidden"
                                  : ""
                              } ${frame === option.id ? "text-white" : "text-white/40"}`}
                            >
                              {option.name}
                            </span>
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
                <div className="hidden shrink-0 items-center justify-center md:flex">
                  <div
                    className="relative flex flex-col items-center justify-center overflow-hidden rounded-[2rem] border border-white/15 bg-white/[0.06] text-center backdrop-blur-sm"
                    style={{ width: "703px", height: "400.6px" }}
                  >
                    {color !== DEFAULT_COLOR && (
                      <div
                        className="pointer-events-none absolute inset-0"
                        style={{ background: colorWash(color, fadeIntensity, 70) }}
                      />
                    )}
                    <div className="relative z-10 flex h-40 w-40 items-center justify-center overflow-hidden rounded-full text-5xl font-black uppercase text-white drop-shadow-lg">
                      {image ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={image}
                          alt="Profile"
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center bg-white/10">
                          {name.slice(0, 1) || "?"}
                        </div>
                      )}
                    </div>
                    <p className="relative z-10 mt-8 break-all text-center text-[3rem] font-black uppercase leading-none text-white drop-shadow-lg">
                      {name || "NAME"}
                    </p>
                    <p className="relative z-10 mt-3 text-sm font-bold uppercase tracking-[0.4em] text-white">
                      Punkte: 0
                    </p>
                    {frame === "frame1" && <WalkingCat cardWidth={703} />}
                  </div>
                </div>
              </div>
            </div>
          )}
        </>
      )}

      {inLobby && (
        <div
          className="absolute inset-0 z-20 px-4 py-4 text-white sm:px-6 sm:py-6 md:px-8 md:py-8"
          style={lobbyEnterStyle()}
        >
          <div className="mx-auto flex h-full w-full max-w-[96rem] flex-col">
            <div className="grid h-full min-h-0 grid-cols-1 gap-4 xl:grid-cols-[minmax(0,2.4fr)_minmax(22rem,1fr)]">
              <div className="flex min-h-0 flex-col gap-4">
                <GlassCard className="relative px-5 py-5 sm:px-6 sm:py-6">
                  <p className="text-sm font-black uppercase tracking-[0.32em] text-white/50">
                    Lobbycode
                  </p>
                  <p className="mt-3 font-mono text-[clamp(2.3rem,6vw,4.8rem)] font-black uppercase tracking-[0.28em] text-white">
                    {lobbyCode}
                  </p>
                  <button
                    onClick={copyCode}
                    className="absolute right-4 top-4 flex items-center gap-2 rounded-[1rem] border border-white/30 bg-white/10 px-3 py-2 text-sm font-bold uppercase tracking-wide text-white backdrop-blur-sm transition-all duration-200 hover:-translate-y-0.5 hover:bg-white/20 sm:right-5 sm:top-5"
                  >
                    {copied ? <Check size={18} /> : <Copy size={18} />}
                    {copied ? "Kopiert" : "Kopieren"}
                  </button>
                </GlassCard>
                <GlassCard className="flex min-h-0 flex-1 flex-col p-3 sm:p-4">
                  <div className="custom-scroll grid auto-rows-[minmax(11rem,1fr)] grid-cols-1 gap-3 overflow-y-auto md:grid-cols-2 2xl:grid-cols-3">
                    {players.map((player) => {
                      const displayName =
                        player.id === selfId ? name || "NAME" : player.name;
                      const displayColor = player.id === selfId ? color : player.color;
                      const displayIntensity =
                        player.id === selfId ? fadeIntensity : player.fadeIntensity;
                      const displayImage = player.id === selfId ? image : player.image;
                      const displayFrame = player.id === selfId ? frame : player.frame;
                      return (
                        <div
                          key={player.id || player.name}
                          className="relative flex min-h-[11rem] flex-col items-center justify-center overflow-hidden rounded-[1.4rem] border border-white/15 bg-white/[0.06] px-4 py-5 text-center backdrop-blur-sm"
                        >
                          {displayColor && displayColor !== DEFAULT_COLOR && (
                            <div
                              className="pointer-events-none absolute inset-0"
                              style={{
                                background: colorWash(
                                  displayColor,
                                  displayIntensity ?? 50,
                                  70,
                                ),
                              }}
                            />
                          )}
                          <div className="relative z-10 flex h-20 w-20 items-center justify-center overflow-hidden rounded-full text-xl font-black uppercase text-white drop-shadow-md">
                            {displayImage ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img
                                src={displayImage}
                                alt="Profile"
                                className="h-full w-full object-cover"
                              />
                            ) : (
                              <div className="flex h-full w-full items-center justify-center bg-white/10">
                                {displayName.slice(0, 1) || "?"}
                              </div>
                            )}
                          </div>
                          {displayFrame === "frame1" && (
                            <WalkingCat cardWidth={280} />
                          )}
                          <p className="relative z-10 mt-4 break-all text-[1.6rem] font-black uppercase leading-none text-white drop-shadow-md sm:text-[1.9rem]">
                            {displayName}
                          </p>
                          {player.isHost && (
                            <p className="relative z-10 mt-2 text-xs font-bold uppercase tracking-[0.3em] text-white/50">
                              Host
                            </p>
                          )}
                        </div>
                      );
                    })}
                    <div className="min-h-[11rem] rounded-[1.4rem] border border-dashed border-white/20" />
                    <div className="hidden min-h-[11rem] rounded-[1.4rem] border border-dashed border-white/20 md:block" />
                    <div className="hidden min-h-[11rem] rounded-[1.4rem] border border-dashed border-white/20 2xl:block" />
                  </div>
                </GlassCard>
              </div>
              <aside className="flex min-h-0 flex-col gap-4">
                <GlassCard className="p-4">
                  <p className="text-xs font-black uppercase tracking-[0.28em] text-white/50">
                    Spielmodus
                  </p>
                  <div className="mt-3 flex items-center gap-4 rounded-[1.3rem] border border-white/15 bg-white/[0.06] px-3 py-3">
                    <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-[1rem] border border-white/30 text-xl font-black uppercase text-white">
                      {modeShort}
                    </div>
                    <div>
                      <p className="text-[1.75rem] font-black uppercase leading-tight text-white">
                        {modeLabel}
                      </p>
                      <p className="mt-1 text-sm font-semibold uppercase tracking-[0.2em] text-white/50">
                        Privatlobby · {players.length} Spieler verbunden
                      </p>
                    </div>
                  </div>
                </GlassCard>
                <GlassCard className="flex min-h-0 flex-1 flex-col p-4">
                  <p className="shrink-0 text-xs font-black uppercase tracking-[0.28em] text-white/50">
                    Rollen für diese Runde
                  </p>
                  <div className="custom-scroll mt-4 flex-1 space-y-2 overflow-y-auto pr-1">
                    {selectedRoles.length > 0 ? (
                      selectedRoles.map((role) => (
                        <button
                          key={role.name}
                          onClick={() => setRoleDetail(role.name)}
                          className="flex w-full items-center justify-between rounded-[1rem] border border-white/15 bg-white/5 px-3 py-2 text-left transition-all duration-150 hover:border-white/30 hover:bg-white/10"
                        >
                          <div className="flex items-center gap-3">
                            <div className="flex h-9 w-9 shrink-0 items-center justify-center text-[0.8rem] text-white/70">
                              <RoleIcon name={role.name} short={role.short} />
                            </div>
                            <span className="text-[1.05rem] font-bold uppercase text-white">
                              {role.name}
                            </span>
                          </div>
                          <span className="text-[1.1rem] font-black text-white">
                            {roleCounts[role.name]}
                          </span>
                        </button>
                      ))
                    ) : (
                      <div className="rounded-[1rem] border border-dashed border-white/20 bg-white/5 px-3 py-4 text-sm font-semibold text-white/45">
                        Keine Rollen ausgewählt.
                      </div>
                    )}
                  </div>
                  {isHost && (
                    <button
                      onClick={() => setRoleModalOpen(true)}
                      className="mt-4 rounded-[1rem] border border-white/30 bg-white/10 px-4 py-3 text-sm font-black uppercase tracking-[0.18em] text-white transition-all duration-200 hover:bg-white/20"
                    >
                      Rollen auswählen
                    </button>
                  )}
                </GlassCard>
                <GlassCard className="p-4">
                  <p className="text-xs font-black uppercase tracking-[0.28em] text-white/50">
                    Sonstige Regeln
                  </p>
                  <p className="mt-3 text-sm font-semibold text-white/30">
                    Keine besonderen Regeln festgelegt.
                  </p>
                </GlassCard>
                {isHost ? (
                  gameStarted ? (
                    <div className="flex flex-col gap-2">
                      <div className="rounded-[1.5rem] border border-green-400/40 bg-green-400/15 px-5 py-4 text-center text-[1.25rem] font-black uppercase tracking-[0.16em] text-green-200">
                        Spiel läuft
                      </div>
                      <button
                        onClick={() => handleStartGame(false)}
                        disabled={busy === "start"}
                        className="rounded-[1rem] border border-white/20 bg-white/5 px-4 py-2 text-xs font-bold uppercase tracking-[0.18em] text-white/60 transition-all duration-200 hover:bg-white/10 hover:text-white disabled:animate-pulse disabled:opacity-50"
                      >
                        Zurück zur Lobby
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => handleStartGame(true)}
                      disabled={busy === "start"}
                      className="rounded-[1.5rem] border border-white/30 bg-white/15 px-5 py-4 text-[1.25rem] font-black uppercase tracking-[0.16em] text-white backdrop-blur-sm transition-all duration-200 hover:-translate-y-1 hover:bg-white hover:text-black disabled:animate-pulse disabled:opacity-50"
                    >
                      {busy === "start" ? "Startet…" : "Spiel starten"}
                    </button>
                  )
                ) : (
                  <div
                    className={`rounded-[1.5rem] border px-5 py-4 text-center text-sm font-bold uppercase tracking-[0.16em] ${
                      gameStarted
                        ? "border-green-400/40 bg-green-400/15 text-green-200"
                        : "border-white/10 bg-white/5 text-white/40"
                    }`}
                  >
                    {gameStarted ? "Das Spiel läuft!" : "Warte auf Host…"}
                  </div>
                )}
              </aside>
            </div>
          </div>

          {detailRole &&
            (() => {
              const teamLabel =
                detailRole.team === "gut"
                  ? "Gut"
                  : detailRole.team === "böse"
                    ? "Böse"
                    : "Neutral";
              const teamText =
                detailRole.team === "gut"
                  ? "text-green-400"
                  : detailRole.team === "böse"
                    ? "text-red-400"
                    : "text-[#8ba4d4]";
              const teamBox =
                detailRole.team === "gut"
                  ? "border-green-400/40 bg-green-400/10"
                  : detailRole.team === "böse"
                    ? "border-red-400/40 bg-red-400/10"
                    : "border-[#6382be]/40 bg-[#6382be]/10";
              return (
                <div
                  className="absolute inset-0 z-50 flex items-center justify-center bg-[#030712]/80 px-4 py-6 backdrop-blur-md"
                  onClick={() => setRoleDetail(null)}
                >
                  <div
                    className="w-full max-w-[44rem] rounded-[2rem] border border-white/15 bg-[#0c1525]/95 p-6 shadow-[0_18px_80px_rgba(0,0,0,0.6)] backdrop-blur-2xl sm:p-8"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <div className="flex items-start gap-5">
                      <div
                        className={`flex h-28 w-28 shrink-0 items-center justify-center rounded-[1.2rem] border p-2 text-2xl text-white/70 ${teamBox}`}
                      >
                        <RoleIcon name={detailRole.name} short={detailRole.short} />
                      </div>
                      <div className="flex flex-col justify-center">
                        <h2 className="text-[2.2rem] font-black uppercase leading-none text-white sm:text-[2.8rem]">
                          {detailRole.name}
                        </h2>
                        <p className="mt-2.5 text-sm font-bold uppercase tracking-[0.2em]">
                          <span className="text-white/40">Team: </span>
                          <span className={teamText}>{teamLabel}</span>
                        </p>
                      </div>
                    </div>
                    <div className="my-6 h-[1px] w-full bg-gradient-to-r from-transparent via-white/20 to-transparent" />
                    <div>
                      <p className="text-xs font-black uppercase tracking-[0.28em] text-white/40">
                        Beschreibung
                      </p>
                      <p className="mt-3 text-[1rem] font-medium leading-7 text-white/75">
                        {detailRole.description}
                      </p>
                    </div>
                    <div className="my-6 h-[1px] w-full bg-gradient-to-r from-transparent via-white/20 to-transparent" />
                    <div>
                      <p className="text-xs font-black uppercase tracking-[0.28em] text-white/40">
                        Gewinnkondition
                      </p>
                      <p className="mt-3 text-[1rem] font-medium leading-7 text-white/50">
                        {winCondition(detailRole)}
                      </p>
                    </div>
                    <button
                      onClick={() => setRoleDetail(null)}
                      className="mt-8 w-full rounded-[1.2rem] border border-white/20 bg-white/10 py-3 text-sm font-black uppercase tracking-[0.2em] text-white transition-all duration-200 hover:bg-white/20"
                    >
                      Schließen
                    </button>
                  </div>
                </div>
              );
            })()}

          {roleModalOpen && (
            <div
              className="absolute inset-0 z-40 flex items-center justify-center bg-[#030712]/85 px-4 py-6 backdrop-blur-lg"
              onClick={() => setRoleModalOpen(false)}
            >
              <div
                className="flex h-[min(90vh,58rem)] w-full max-w-[84rem] flex-col rounded-[2rem] p-2 sm:p-4"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="flex shrink-0 items-center justify-between gap-4 pb-4">
                  <div>
                    <p className="text-xs font-black uppercase tracking-[0.3em] text-white/45">
                      Rollen auswählen
                    </p>
                    <h2 className="mt-2 text-[1.8rem] font-black uppercase text-white sm:text-[2.2rem]">
                      Rollen-Konfiguration
                    </h2>
                  </div>
                  <button
                    onClick={() => setRoleModalOpen(false)}
                    className="group flex h-12 w-12 shrink-0 items-center justify-center rounded-full border border-white/10 bg-transparent text-white/50 transition-all duration-200 hover:border-white/30 hover:bg-white/10 hover:text-white"
                    aria-label="Popup schließen"
                  >
                    <X
                      size={22}
                      className="transition-transform duration-200 group-hover:rotate-90"
                    />
                  </button>
                </div>
                <div className="custom-scroll mt-4 min-h-0 flex-1 overflow-y-auto pr-1">
                  {(["gut", "böse", "neutral"] as const).map((team, teamIdx) => {
                    const teamRoles = ROLES.filter((r) => r.team === team);
                    const sectionLabel =
                      team === "gut"
                        ? "Gute Rollen"
                        : team === "böse"
                          ? "Böse Rollen"
                          : "Neutrale Rollen";
                    const accentColor =
                      team === "gut"
                        ? "rgba(34,197,94,0.7)"
                        : team === "böse"
                          ? "rgba(239,68,68,0.7)"
                          : "rgba(99,130,190,0.7)";
                    const cardClasses =
                      team === "gut"
                        ? "border-green-400/30 bg-green-400/[0.09]"
                        : team === "böse"
                          ? "border-red-400/30 bg-red-400/[0.09]"
                          : "border-[#6382be]/30 bg-[#6382be]/[0.09]";
                    const iconClasses =
                      team === "gut"
                        ? "border-green-400/40 bg-green-400/10"
                        : team === "böse"
                          ? "border-red-400/40 bg-red-400/10"
                          : "border-[#6382be]/40 bg-[#6382be]/10";
                    return (
                      <div key={team} className={teamIdx > 0 ? "mt-5" : ""}>
                        <div className="mb-3 flex items-center gap-0">
                          <div
                            className="h-[1.5px] flex-1"
                            style={{
                              background: `linear-gradient(to right, transparent, ${accentColor} 40%, ${accentColor} 60%, transparent)`,
                            }}
                          />
                          <span
                            className="mx-3 shrink-0 text-[0.7rem] font-black uppercase tracking-[0.25em]"
                            style={{ color: accentColor }}
                          >
                            {sectionLabel}
                          </span>
                          <div
                            className="h-[1.5px] flex-1"
                            style={{
                              background: `linear-gradient(to left, transparent, ${accentColor} 40%, ${accentColor} 60%, transparent)`,
                            }}
                          />
                        </div>
                        <div className="grid grid-cols-1 gap-x-3 gap-y-2 sm:grid-cols-2 xl:grid-cols-3">
                          {teamRoles.map((role) => (
                            <div
                              key={role.name}
                              className={`group relative z-0 flex h-[5.4rem] items-center gap-4 rounded-[1.2rem] border px-4 backdrop-blur-sm hover:z-50 ${cardClasses}`}
                            >
                              <div
                                className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-[0.9rem] border p-2 text-base text-white/70 ${iconClasses}`}
                              >
                                <RoleIcon name={role.name} short={role.short} />
                              </div>
                              <div className="flex min-w-0 flex-1 flex-col items-center justify-center">
                                <span className="text-[1.12rem] font-black uppercase leading-none text-white">
                                  {role.name}
                                </span>
                                <div className="mt-1.5 flex items-center gap-3">
                                  <button
                                    onClick={() => changeRoleCount(role.name, 1)}
                                    className="text-white/60 transition-all hover:text-white"
                                  >
                                    <Plus size={18} />
                                  </button>
                                  <span className="min-w-[1.6rem] text-center text-[1.12rem] font-black text-white">
                                    {roleCounts[role.name] ?? 0}
                                  </span>
                                  <button
                                    onClick={() => changeRoleCount(role.name, -1)}
                                    disabled={(roleCounts[role.name] ?? 0) === 0}
                                    className="text-white/60 transition-all hover:text-white disabled:opacity-20"
                                  >
                                    <Minus size={18} />
                                  </button>
                                </div>
                              </div>
                              <div className="relative shrink-0">
                                <div className="peer flex h-[2.1rem] w-[2.1rem] cursor-default items-center justify-center rounded-full border border-white/20 text-white/40 transition-all hover:bg-white/10 hover:text-white">
                                  <Info size={17} />
                                </div>
                                <div className="pointer-events-none absolute right-0 top-11 z-50 w-56 rounded-[0.95rem] border border-white/20 bg-[#0c1525]/98 px-3 py-2 text-[0.78rem] font-medium leading-5 text-white/85 opacity-0 shadow-[0_8px_30px_rgba(0,0,0,0.6)] backdrop-blur-2xl transition-opacity duration-200 peer-hover:pointer-events-auto peer-hover:opacity-100">
                                  {role.description}
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
