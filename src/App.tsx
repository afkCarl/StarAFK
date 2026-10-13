import { useEffect, useRef, useState } from "react";
import type { CSSProperties, ReactNode } from "react";
import { Check, ChevronLeft, ChevronRight, Copy, Info, Minus, Plus, Trash2, X } from "lucide-react";

/* ─── Walking Cat Frame ───────────────────────────────────────────── */
function WalkingCat({ cardWidth }: { cardWidth: number }) {
  const [frame, setFrame] = useState(0);
  const [posX, setPosX] = useState(0);
  const [goingRight, setGoingRight] = useState(true);
  const catSize = Math.max(16, cardWidth / 8);
  const maxX = cardWidth - catSize;

  useEffect(() => {
    const frameInterval = setInterval(() => setFrame((f) => (f === 0 ? 1 : 0)), 300);
    return () => clearInterval(frameInterval);
  }, []);

  useEffect(() => {
    const moveInterval = setInterval(() => {
      setPosX((x) => {
        const speed = Math.max(0.5, cardWidth / 200);
        let newX = goingRight ? x + speed : x - speed;
        if (newX >= maxX) {
          newX = maxX;
          setGoingRight(false);
        } else if (newX <= 0) {
          newX = 0;
          setGoingRight(true);
        }
        return newX;
      });
    }, 16);
    return () => clearInterval(moveInterval);
  }, [goingRight, maxX, cardWidth]);

  const src = frame === 0 ? "/frames/GrayCatWalkingOne.png" : "/frames/GrayCatWalkingTwo.png";

  return (
    <img
      src={src}
      alt="Walking Cat"
      className="pointer-events-none absolute bottom-0"
      style={{
        width: catSize,
        height: catSize,
        left: posX,
        transform: goingRight ? "scaleX(1)" : "scaleX(-1)",
        objectFit: "contain",
      }}
      draggable={false}
    />
  );
}

/* ─── Role Icon (PNG from /roles/<Name>icon.png) ──────────────────── */
function RoleIcon({ name, className = "" }: { name: string; className?: string }) {
  const fileName = `${name}icon.png`;
  return (
    <img
      src={`/roles/${fileName}`}
      alt={name}
      className={`h-full w-full object-contain ${className}`}
      draggable={false}
    />
  );
}

const GAMEMODES = [
  {
    title: "WERWOLF",
    description:
      "Finde die Werwölfe im Dorf und rette die Bewohner. Nutze deine Fähigkeiten weise, um die unschuldigen Dorfbewohner vor den Gefahren der Nacht zu beschützen und die versteckten Feinde zu enttarnen, bevor es zu spät ist und die Werwölfe die Überhand gewinnen.",
  },
  {
    title: "HÖHLE DER LÖWEN",
    description:
      "Präsentiere deine Idee vor der Runde und gewinne die Investoren für dich. Stelle dein innovatives Geschäftsmodell vor, verhandle hart und überzeuge die Löwen davon, dass dein Unternehmen das nächste große Ding auf dem Markt wird, um dir das nötige Kapital zu sichern.",
  },
] as const;

type LobbyPlayer = { name: string; tag: string; isHost: boolean };

function generateDefaultPlayerName(): string {
  const number = Math.floor(100 + Math.random() * 900);
  return `Player${number}`;
}

const DEFAULT_PLAYER_COLOR = "#6b7280";

function withAlpha(hex: string, opacityPercent: number): string {
  const alpha = Math.max(0, Math.min(100, opacityPercent));
  const alphaHex = Math.round((alpha / 100) * 255)
    .toString(16)
    .padStart(2, "0");
  return `${hex}${alphaHex}`;
}

function createPlayerFade(color: string, intensity: number, size: number): string {
  const strong = Math.max(8, Math.min(100, intensity));
  const medium = Math.max(6, Math.round(strong * 0.62));
  const light = Math.max(4, Math.round(strong * 0.34));
  const stop2 = Math.max(12, Math.round(size * 0.28));
  const stop3 = Math.max(24, Math.round(size * 0.58));
  const fadeEnd = Math.max(stop3 + 8, size);

  return `linear-gradient(135deg, ${withAlpha(color, strong)} 0%, ${withAlpha(color, medium)} ${stop2}%, ${withAlpha(color, light)} ${stop3}%, transparent ${fadeEnd}%)`;
}

const WEREWOLF_ROLES = [
  // Gut
  { short: "DB", name: "Dorfbewohner",  team: "gut" as const, count: 2, description: "Hat keine Spezialfähigkeit und muss tagsüber die Werwölfe entlarven." },
  { short: "SE", name: "Seher",         team: "gut" as const, count: 1, description: "Darf jede Nacht einen Spieler überprüfen und erfährt, ob er gut, böse oder neutral ist." },
  { short: "HX", name: "Hexe",          team: "gut" as const, count: 1, description: "Besitzt einen Heil- und einen Gifttrank und entscheidet nachts über deren Einsatz." },
  { short: "JG", name: "Jäger",         team: "gut" as const, count: 1, description: "Nimmt beim eigenen Ausscheiden sofort einen weiteren Spieler mit." },
  { short: "DK", name: "Doktor",        team: "gut" as const, count: 1, description: "Kann jede Nacht einen Spieler schützen und so einen Angriff verhindern." },
  { short: "AM", name: "Amor",          team: "gut" as const, count: 1, description: "Bestimmt zu Beginn zwei Verliebte, deren Schicksal miteinander verbunden ist." },
  { short: "MD", name: "Medium",        team: "gut" as const, count: 1, description: "Erhält Hinweise aus dem Jenseits und kann dem Dorf wichtige Informationen liefern." },
  { short: "BM", name: "Bürgermeister", team: "gut" as const, count: 1, description: "Seine Stimme zählt bei Abstimmungen doppelt und entscheidet Gleichstände." },
  { short: "GO", name: "Goethe",        team: "gut" as const, count: 0, description: "Die ausgewählte Person darf am nächsten Tag nur in Reimen sprechen." },
  { short: "DT", name: "Detektiv",      team: "gut" as const, count: 0, description: "Darf jede Nacht bei einem Spieler sehen, mit wem er interagiert hat, erhält aber 3 Spieler von denen einer stimmt." },
  // Böse
  { short: "WW", name: "Werwolf",       team: "böse" as const, count: 2, description: "Greift nachts gemeinsam an und versucht das Dorf unbemerkt zu kontrollieren." },
  // Neutral
  { short: "KJ", name: "Kopfgeldjäger", team: "neutral" as const, count: 0, description: "Kriegt jeden Tag ein neues Ziel und gewinnt nur, wenn dieses bestimmte Ziel ausscheidet." },
  { short: "TT", name: "Dorftrottel",   team: "neutral" as const, count: 0, description: "Muss am ersten Tag rausgevotet werden, um zu gewinnen, oder wird sonst zum Dorfbewohner." },
  { short: "SM", name: "Sandmann",      team: "neutral" as const, count: 0, description: "Kann eine Person zum Schlafen bringen. Diese kann am nächsten Tag nicht reden oder voten." },
  { short: "DI", name: "Dieb",          team: "neutral" as const, count: 0, description: "Stiehlt zu Beginn des Spiels eine der übrigen Rollen und übernimmt deren Rolle." },
] as const;

type Direction = "left" | "right";
type SlideState = "idle" | "start" | "go";
type JoinCodeState = "closed" | "opening" | "open" | "closing";
type ScreenState = "menu" | "menuLeaving" | "lobbyEntering" | "lobby";
type RoleName = (typeof WEREWOLF_ROLES)[number]["name"];

type RoleCountMap = Record<RoleName, number>;

function generateLobbyCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ";
  return Array.from({ length: 6 }, () => chars[Math.floor(Math.random() * chars.length)]).join("");
}

function calculateAutoRoles(playerCount: number): RoleCountMap {
  const counts = Object.fromEntries(WEREWOLF_ROLES.map((role) => [role.name, 0])) as RoleCountMap;
  
  if (playerCount < 4) {
    counts["Werwolf"] = 1;
    counts["Dorfbewohner"] = 2;
  } else if (playerCount === 4) {
    counts["Werwolf"] = 1;
    counts["Dorfbewohner"] = 3;
  } else {
    counts["Werwolf"] = 2;
    counts["Dorfbewohner"] = 3 + (playerCount - 5);
  }
  
  return counts;
}

const WerwolfBackground = ({ isActive }: { isActive: boolean }) => (
  <div
    className={`pointer-events-none absolute inset-0 z-0 transition-opacity duration-1000 ${
      isActive ? "opacity-100" : "opacity-0"
    }`}
  >
    <div className="absolute inset-0 bg-[url('/sky.png')] bg-cover bg-center" />
    <div className="absolute inset-0 overflow-hidden">
      <div className="absolute left-0 top-0 flex h-full w-[200vw] animate-[slideCloudsRight_140s_linear_infinite] opacity-40 mix-blend-screen">
        <div className="h-full w-[100vw] scale-x-[-1.1] scale-y-110 bg-[url('/clouds.png')] bg-cover bg-center" />
        <div className="h-full w-[100vw] scale-x-[-1.1] scale-y-110 bg-[url('/clouds.png')] bg-cover bg-center" />
      </div>
    </div>
    <div className="absolute inset-0 overflow-hidden">
      <div className="absolute left-0 top-0 flex h-full w-[200vw] animate-[slideCloudsRight_80s_linear_infinite] opacity-75 mix-blend-screen">
        <div className="h-full w-[100vw] bg-[url('/clouds.png')] bg-cover bg-center" />
        <div className="h-full w-[100vw] bg-[url('/clouds.png')] bg-cover bg-center" />
      </div>
    </div>
    <div className="absolute inset-0 bg-[url('/foreground.png')] bg-bottom bg-cover bg-no-repeat" />
  </div>
);

const GlassCard = ({ children, className = "" }: { children: ReactNode; className?: string }) => (
  <div
    className={`rounded-[1.75rem] border border-white/15 bg-white/[0.06] shadow-[0_8px_32px_rgba(0,0,0,0.35)] backdrop-blur-md ${className}`}
  >
    {children}
  </div>
);

export default function App() {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [previousIndex, setPreviousIndex] = useState<number | null>(null);
  const [isAnimating, setIsAnimating] = useState(false);
  const [direction, setDirection] = useState<Direction>("right");
  const [animationState, setAnimationState] = useState<SlideState>("idle");
  const [joinCodeState, setJoinCodeState] = useState<JoinCodeState>("closed");
  const [screenState, setScreenState] = useState<ScreenState>("menu");
  const [joinInput, setJoinInput] = useState("");
  const [codeCopied, setCodeCopied] = useState(false);
  const [lobbyCode, setLobbyCode] = useState("");
  const [isRolePickerOpen, setIsRolePickerOpen] = useState(false);
  const [selectedRoleDetail, setSelectedRoleDetail] = useState<RoleName | null>(null);
  const [lobbyPlayers, setLobbyPlayers] = useState<LobbyPlayer[]>([]);
  const [isHost, setIsHost] = useState(true);
  const [roleCounts, setRoleCounts] = useState<RoleCountMap>(() => calculateAutoRoles(1));
  
  const [isPlayerCardOpen, setIsPlayerCardOpen] = useState(false);
  const [playerName, setPlayerName] = useState(() => generateDefaultPlayerName());
  const [playerColor, setPlayerColor] = useState(DEFAULT_PLAYER_COLOR);
  const [playerFadeIntensity, setPlayerFadeIntensity] = useState(50);
  const [showMaxCharsWarning, setShowMaxCharsWarning] = useState(false);
  const [playerFrame, setPlayerFrame] = useState("none");
  const [playerImage, setPlayerImage] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const url = URL.createObjectURL(file);
      setPlayerImage(url);
    }
  };

  const startTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const endTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const joinCodeTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const screenTransitionTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lobbyEnterTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  const current = GAMEMODES[currentIndex];
  const previous = previousIndex !== null ? GAMEMODES[previousIndex] : null;
  const lobbyModeLabel = current.title === "WERWOLF" ? "Werwolf (Standard)" : current.title;
  const lobbyModeBadge = current.title === "WERWOLF" ? "WW" : current.title.slice(0, 2);
  const showMenu = screenState === "menu" || screenState === "menuLeaving";
  const showLobby = screenState === "lobbyEntering" || screenState === "lobby";
  const showDarkBackground = (showMenu && current.title === "WERWOLF") || showLobby;
  const activeRoles = WEREWOLF_ROLES.filter((role) => roleCounts[role.name] > 0);

  const goTo = (newIndex: number, dir: Direction) => {
    if (isAnimating || screenState !== "menu") return;
    setIsAnimating(true);
    setDirection(dir);
    setPreviousIndex(currentIndex);
    setCurrentIndex(newIndex);
    setAnimationState("start");
    startTimeout.current = setTimeout(() => setAnimationState("go"), 20);
    endTimeout.current = setTimeout(() => {
      setPreviousIndex(null);
      setAnimationState("idle");
      setIsAnimating(false);
    }, 470);
  };

  const next = () => goTo((currentIndex + 1) % GAMEMODES.length, "right");
  const prev = () => goTo((currentIndex - 1 + GAMEMODES.length) % GAMEMODES.length, "left");

  const toggleJoinCode = () => {
    if (screenState !== "menu") return;
    if (joinCodeTimeout.current) clearTimeout(joinCodeTimeout.current);

    if (joinCodeState === "closed") {
      setJoinCodeState("opening");
      joinCodeTimeout.current = setTimeout(() => setJoinCodeState("open"), 20);
    } else if (joinCodeState === "open") {
      setJoinCodeState("closing");
      joinCodeTimeout.current = setTimeout(() => {
        setJoinCodeState("closed");
        setJoinInput("");
      }, 350);
    }
  };

  const copyLobbyCode = () => {
    navigator.clipboard.writeText(lobbyCode).then(() => {
      setCodeCopied(true);
      setTimeout(() => setCodeCopied(false), 1500);
    });
  };

  const openLobby = () => {
    if (screenState !== "menu" || isAnimating) return;
    if (current.title !== "WERWOLF") return;

    if (joinCodeTimeout.current) clearTimeout(joinCodeTimeout.current);
    setJoinCodeState("closed");
    setJoinInput("");
    setCodeCopied(false);
    setIsRolePickerOpen(false);
    setLobbyCode(generateLobbyCode());
    setIsHost(true);
    setLobbyPlayers([{ name: playerName || "HOST", tag: "HOST", isHost: true }]);
    setRoleCounts(calculateAutoRoles(1));
    setScreenState("menuLeaving");

    screenTransitionTimeout.current = setTimeout(() => {
      setScreenState("lobbyEntering");
      lobbyEnterTimeout.current = setTimeout(() => setScreenState("lobby"), 20);
    }, 440);
  };

  const joinLobby = () => {
    if (screenState !== "menu" || isAnimating) return;
    if (joinInput.length !== 6) return;

    if (joinCodeTimeout.current) clearTimeout(joinCodeTimeout.current);
    setJoinCodeState("closed");
    setCodeCopied(false);
    setIsRolePickerOpen(false);
    setLobbyCode(joinInput);
    setJoinInput("");
    setIsHost(false);

    // Simulate joining: host + you
    const hostName = `Host${Math.floor(100 + Math.random() * 900)}`;
    setLobbyPlayers([
      { name: hostName, tag: "HOST", isHost: true },
      { name: playerName || "PLAYER", tag: "JOINED", isHost: false },
    ]);
    setRoleCounts(calculateAutoRoles(2));
    setScreenState("menuLeaving");

    screenTransitionTimeout.current = setTimeout(() => {
      setScreenState("lobbyEntering");
      lobbyEnterTimeout.current = setTimeout(() => setScreenState("lobby"), 20);
    }, 440);
  };

  const changeRoleCount = (roleName: RoleName, delta: number) => {
    setRoleCounts((prev) => ({
      ...prev,
      [roleName]: Math.max(0, prev[roleName] + delta),
    }));
  };

  useEffect(
    () => () => {
      [startTimeout, endTimeout, joinCodeTimeout, screenTransitionTimeout, lobbyEnterTimeout].forEach(
        (ref) => ref.current && clearTimeout(ref.current),
      );
    },
    [],
  );

  const oldItemStyle = (): CSSProperties =>
    animationState === "start"
      ? { transform: "translateX(0)", opacity: 1, transition: "none" }
      : animationState === "go"
        ? {
            transform: `translateX(${direction === "right" ? "-115%" : "115%"})`,
            opacity: 0,
            transition: "transform 420ms cubic-bezier(0.4,0,0.2,1), opacity 420ms ease",
          }
        : { transform: "translateX(0)", opacity: 1 };

  const newItemStyle = (): CSSProperties =>
    animationState === "start"
      ? {
          transform: `translateX(${direction === "right" ? "115%" : "-115%"})`,
          opacity: 0,
          transition: "none",
        }
      : animationState === "go"
        ? {
            transform: "translateX(0)",
            opacity: 1,
            transition: "transform 420ms cubic-bezier(0.22,1,0.36,1), opacity 420ms ease",
          }
        : { transform: "translateX(0)", opacity: 1 };

  const joinCodeStyle = (): CSSProperties => {
    if (joinCodeState === "opening") {
      return { transform: "translateX(-100vw)", opacity: 0, transition: "none" };
    }

    if (joinCodeState === "closing") {
      return {
        transform: "translateX(-100vw)",
        opacity: 0,
        transition: "transform 350ms cubic-bezier(0.4,0,0.2,1), opacity 350ms ease",
      };
    }

    if (joinCodeState === "open") {
      return {
        transform: "translateX(0)",
        opacity: 1,
        transition: "transform 350ms cubic-bezier(0.22,1,0.36,1), opacity 350ms ease",
      };
    }

    return {};
  };

  const menuLeftStyle = (): CSSProperties =>
    screenState === "menuLeaving"
      ? {
          transform: "translateX(-110vw)",
          opacity: 0,
          transition: "transform 440ms cubic-bezier(0.4,0,0.2,1), opacity 300ms ease",
        }
      : { transform: "translateX(0)", opacity: 1 };

  const menuRightStyle = (): CSSProperties =>
    screenState === "menuLeaving"
      ? {
          transform: "translateX(110vw)",
          opacity: 0,
          transition: "transform 440ms cubic-bezier(0.4,0,0.2,1), opacity 300ms ease",
        }
      : { transform: "translateX(0)", opacity: 1 };

  const lobbyScreenStyle = (): CSSProperties => {
    if (screenState === "lobbyEntering") {
      return { transform: "translateY(110%)", opacity: 0, transition: "none" };
    }

    if (screenState === "lobby") {
      return {
        transform: "translateY(0)",
        opacity: 1,
        transition: "transform 520ms cubic-bezier(0.22,1,0.36,1), opacity 520ms ease",
      };
    }

    return {};
  };

  return (
    <div
      className={`relative min-h-screen w-full overflow-hidden transition-colors duration-700 ${
        showDarkBackground ? "bg-[#0b1220] text-white" : "bg-white text-black"
      }`}
    >
      <WerwolfBackground isActive={showDarkBackground} />

      {showMenu && (
        <>
          <div
            className="relative z-10 flex min-h-screen flex-col px-4 py-3 sm:px-6 sm:py-4 md:px-8 md:py-5"
            style={menuLeftStyle()}
          >
            <div className="relative flex flex-col pt-0.5">
              <p className="text-[1.4rem] font-black uppercase tracking-wide sm:text-[1.6rem]">
                SPIELMODUS {currentIndex + 1}/{GAMEMODES.length}
              </p>
              <div className="relative mt-0.5 min-h-[14rem] -translate-y-2 overflow-hidden sm:min-h-[16rem] md:min-h-[18rem]">
                {previous && animationState !== "idle" && (
                  <div className="absolute inset-0" style={oldItemStyle()}>
                    <h1 className="overflow-visible whitespace-nowrap pt-1 text-[clamp(4rem,8vw,8rem)] font-black uppercase leading-none tracking-tight">
                      {previous.title}
                    </h1>
                    <div
                      className={`mt-2 h-[4px] w-full max-w-[57rem] bg-gradient-to-r to-transparent ${
                        showDarkBackground ? "from-white" : "from-black"
                      }`}
                    />
                    <p className="mt-3 w-[66vw] text-base font-semibold sm:text-lg">
                      {previous.description}
                    </p>
                  </div>
                )}
                <div
                  className={animationState !== "idle" ? "absolute inset-0" : ""}
                  style={animationState !== "idle" ? newItemStyle() : {}}
                >
                  <h1 className="overflow-visible whitespace-nowrap pt-1 text-[clamp(4rem,8vw,8rem)] font-black uppercase leading-none tracking-tight">
                    {current.title}
                  </h1>
                  <div
                    className={`mt-2 h-[4px] w-full max-w-[57rem] bg-gradient-to-r to-transparent ${
                      showDarkBackground ? "from-white" : "from-black"
                    }`}
                  />
                  <p className="mt-3 w-[66vw] text-base font-semibold sm:text-lg">{current.description}</p>
                </div>
              </div>
            </div>

            <div className="mt-auto mb-4 flex flex-col gap-2">
              <button 
                onClick={() => setIsPlayerCardOpen(true)}
                className="w-fit text-left text-[1.75rem] font-bold uppercase transition-all duration-200 hover:translate-x-3 hover:text-neutral-400 sm:text-[2.1rem]"
              >
                Spielerkarte
              </button>
              <button className="w-fit text-left text-[1.75rem] font-bold uppercase transition-all duration-200 hover:translate-x-3 hover:text-neutral-400 sm:text-[2.1rem]">
                Statistiken
              </button>
              <button className="w-fit text-left text-[1.75rem] font-bold uppercase transition-all duration-200 hover:translate-x-3 hover:text-neutral-400 sm:text-[2.1rem]">
                Einstellungen
              </button>
            </div>
          </div>

          <button
            onClick={prev}
            className="absolute left-1 top-[42%] z-20 -translate-y-1/2 p-3 transition-all duration-200 hover:-translate-x-1 hover:scale-110 hover:text-neutral-400 sm:left-2 md:left-3"
            aria-label="Vorheriger Gamemode"
            style={menuLeftStyle()}
          >
            <ChevronLeft size={72} strokeWidth={1.5} />
          </button>

          <button
            onClick={next}
            className="absolute right-1 top-[42%] z-20 -translate-y-1/2 p-3 transition-all duration-200 hover:translate-x-1 hover:scale-110 hover:text-neutral-400 sm:right-2 md:right-3"
            aria-label="Nächster Gamemode"
            style={menuRightStyle()}
          >
            <ChevronRight size={72} strokeWidth={1.5} />
          </button>

          <div
            className="absolute left-4 top-[calc(42%+120px)] z-20 flex flex-col gap-3 sm:left-6 md:left-8"
            style={menuLeftStyle()}
          >
            <button
              onClick={openLobby}
              className={`w-fit text-left text-[1.75rem] font-bold uppercase transition-all duration-200 sm:text-[2.1rem] ${
                current.title === "WERWOLF"
                  ? "hover:translate-x-3 hover:text-neutral-400"
                  : "cursor-not-allowed opacity-30"
              }`}
            >
              Lobby erstellen
            </button>
            <div className="flex w-fit flex-col">
              <button
                onClick={toggleJoinCode}
                className="w-fit text-left text-[1.75rem] font-bold uppercase transition-all duration-200 hover:translate-x-3 hover:text-neutral-400 sm:text-[2.1rem]"
              >
                Lobby beitreten
              </button>
              {joinCodeState !== "closed" && (
                <div
                  className="mt-4 flex items-end justify-between border-b-2 border-current pb-1"
                  style={joinCodeStyle()}
                >
                  <input
                    type="text"
                    value={joinInput}
                    onChange={(e) =>
                      setJoinInput(e.target.value.toUpperCase().replace(/[^A-Z]/g, "").slice(0, 6))
                    }
                    placeholder="LOBBY-CODE"
                    maxLength={6}
                    className="w-full bg-transparent text-[1.4rem] font-medium tracking-widest outline-none placeholder:text-neutral-400 sm:text-[1.6rem]"
                    autoFocus
                  />
                  <button 
                    onClick={joinLobby}
                    className="ml-4 shrink-0 text-[1.4rem] font-bold uppercase transition-all hover:text-neutral-400 sm:text-[1.6rem]"
                  >
                    Beitreten
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* ═══ PLAYER CARD POPUP ════════════════════════════════ */}
          {isPlayerCardOpen && (
            <div
              className="absolute inset-0 z-50 flex items-center justify-center bg-[#030712]/85 px-4 py-6 backdrop-blur-lg"
              onClick={() => setIsPlayerCardOpen(false)}
            >
              <div className="flex w-full max-w-[95vw] items-center justify-center gap-8" onClick={(e) => e.stopPropagation()}>
                {/* ─── Options Box (scrollable) ─── */}
                <div className="custom-scroll flex max-h-[85vh] shrink-0 flex-col overflow-y-auto rounded-[2rem] border border-white/10 bg-[#0c1525]/95 p-6 shadow-[0_18px_80px_rgba(0,0,0,0.6)] backdrop-blur-2xl sm:p-8" style={{ width: "780px" }}>
                  <div className="flex shrink-0 items-center justify-between gap-4 border-b border-white/10 pb-3">
                    <div>
                      <p className="text-[0.65rem] font-black uppercase tracking-[0.3em] text-white/45">Profil anpassen</p>
                      <h2 className="mt-1 text-[1.5rem] font-black uppercase text-white">Spielerkarte</h2>
                    </div>
                    <button
                      onClick={() => setIsPlayerCardOpen(false)}
                      className="group flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-white/10 text-white/50 transition-all duration-200 hover:border-white/30 hover:bg-white/10 hover:text-white"
                    >
                      <X size={20} className="transition-transform duration-200 group-hover:rotate-90" />
                    </button>
                  </div>

                  <div className="mt-5 flex flex-col gap-5">
                    {/* Name */}
                    <div>
                      <div className="mb-1.5 flex items-center justify-between">
                        <label className="block text-xs font-black uppercase tracking-[0.2em] text-white/60">
                          User:
                        </label>
                        {showMaxCharsWarning && (
                          <span className="text-[0.65rem] font-bold uppercase tracking-wider text-red-400 animate-pulse">
                            (Max. Zeichen erreicht)
                          </span>
                        )}
                      </div>
                      <input
                        type="text"
                        maxLength={12}
                        value={playerName}
                        onKeyDown={(e) => {
                          // Allow backspace, delete, arrows, etc.
                          if (e.key === 'Backspace' || e.key === 'Delete' || e.key.includes('Arrow')) return;
                          
                          if (playerName.length >= 12 && e.key.length === 1) {
                            setShowMaxCharsWarning(true);
                            setTimeout(() => setShowMaxCharsWarning(false), 2000);
                          }
                        }}
                        onChange={(e) => setPlayerName(e.target.value.replace(/[^a-zA-Z0-9 ]/g, ""))}
                        className="w-full rounded-[0.9rem] border border-white/20 bg-white/5 px-3 py-2.5 text-base font-bold text-white outline-none transition-all focus:border-white/40 focus:bg-white/10"
                        placeholder="Dein Name"
                      />
                    </div>

                    {/* Farbe */}
                    <div>
                      <label className="mb-1.5 block text-xs font-black uppercase tracking-[0.2em] text-white/60">Farbe:</label>
                      <div className="grid grid-cols-[8.5rem_1fr] gap-4 rounded-[1rem] border border-white/10 bg-white/[0.03] p-3.5">
                        <div className="flex flex-col justify-center gap-2">
                          <div className="flex items-center gap-3">
                            <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-full border-2 border-white/20">
                              <input
                                type="color"
                                value={playerColor}
                                onChange={(e) => setPlayerColor(e.target.value)}
                                className="absolute -inset-2 h-[150%] w-[150%] cursor-pointer border-none bg-transparent"
                              />
                            </div>
                            <span className="font-mono text-[0.72rem] font-bold text-white/45">{playerColor.toUpperCase()}</span>
                          </div>
                        </div>

                        <div className="flex flex-col justify-center gap-1.5">
                          <div className="flex items-center justify-between text-[0.68rem] font-black uppercase tracking-[0.18em] text-white/55">
                            <span>Intensität</span>
                            <span className="text-white/85">{playerFadeIntensity}%</span>
                          </div>
                          <input
                            type="range"
                            min="0"
                            max="100"
                            value={playerFadeIntensity}
                            onChange={(e) => setPlayerFadeIntensity(Number(e.target.value))}
                            className="card-slider"
                          />
                        </div>
                      </div>
                    </div>

                    {/* Profilbild */}
                    <div>
                      <label className="mb-1.5 block text-xs font-black uppercase tracking-[0.2em] text-white/60">Profilbild:</label>
                      <input type="file" ref={fileInputRef} onChange={handleImageUpload} className="hidden" accept="image/*" />
                      <div className="flex items-center gap-3">
                        <button
                          onClick={() => fileInputRef.current?.click()}
                          className="rounded-[0.9rem] border border-white/20 bg-white/5 px-4 py-2.5 text-xs font-bold uppercase tracking-[0.1em] text-white transition-all hover:bg-white/10"
                        >
                          Bild hochladen
                        </button>
                        {playerImage && (
                          <button
                            onClick={() => setPlayerImage(null)}
                            className="flex h-10 w-10 items-center justify-center rounded-[0.9rem] border border-red-500/30 bg-red-500/10 text-red-400 transition-all hover:border-red-500/50 hover:bg-red-500/20"
                          >
                            <Trash2 size={16} />
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Rahmen */}
                    <div>
                      <label className="mb-1.5 block text-xs font-black uppercase tracking-[0.2em] text-white/60">
                        Spielerrahmen wählen
                      </label>
                      <div className="grid grid-cols-2 gap-4">
                        {[
                          { id: "none", name: "Kein Rahmen" },
                          { id: "frame1", name: "Rahmen 1" },
                          { id: "frame2", name: "Rahmen 2" },
                          { id: "frame3", name: "Rahmen 3" },
                          { id: "frame4", name: "Rahmen 4" },
                          { id: "frame5", name: "Rahmen 5" },
                        ].map((frame) => (
                          <button
                            key={frame.id}
                            onClick={() => setPlayerFrame(frame.id)}
                            className={`flex flex-col items-center justify-center overflow-hidden rounded-[1.4rem] border transition-all ${
                              playerFrame === frame.id
                                ? "border-white/60 bg-white/15 ring-1 ring-white/30"
                                : "border-white/15 bg-white/5 hover:border-white/30 hover:bg-white/10"
                            }`}
                            style={{ width: "351.5px", height: "200.3px" }}
                          >
                            {frame.id !== "none" ? (
                              <img
                                src={`/frames/${frame.id}.png`}
                                alt={frame.name}
                                className="h-full w-full object-contain p-2 opacity-70"
                                onError={(e) => {
                                  (e.target as HTMLImageElement).style.display = "none";
                                  (e.target as HTMLImageElement).parentElement!.querySelector("span")!.style.display = "block";
                                }}
                              />
                            ) : null}
                            <span
                              className={`text-[0.65rem] font-bold uppercase tracking-[0.12em] ${frame.id !== "none" ? "hidden" : ""} ${
                                playerFrame === frame.id ? "text-white" : "text-white/40"
                              }`}
                            >
                              {frame.name}
                            </span>
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>

                {/* ─── Preview Card (centered vertically) ─── */}
                <div className="hidden shrink-0 items-center justify-center md:flex">
                  <div 
                    className="relative flex flex-col items-center justify-center overflow-hidden rounded-[2rem] border border-white/15 bg-white/[0.06] text-center backdrop-blur-sm"
                    style={{ width: "703px", height: "400.6px" }}
                  >
                    {/* Color fade – diagonal sweep */}
                    {playerColor !== DEFAULT_PLAYER_COLOR && (
                      <div
                        className="pointer-events-none absolute inset-0"
                        style={{
                          background: createPlayerFade(playerColor, playerFadeIntensity, 70),
                        }}
                      />
                    )}

                    <div className="relative z-10 flex h-40 w-40 items-center justify-center overflow-hidden rounded-full text-5xl font-black uppercase text-white drop-shadow-lg">
                      {playerImage ? (
                        <img src={playerImage} alt="Profile" className="h-full w-full object-cover" />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center bg-white/10">
                          {playerName.slice(0, 1) || "?"}
                        </div>
                      )}
                    </div>

                    <p className="relative z-10 mt-8 break-all text-center text-[3rem] font-black uppercase leading-none text-white drop-shadow-lg">
                      {playerName || "NAME"}
                    </p>
                    <p className="relative z-10 mt-3 text-sm font-bold uppercase tracking-[0.4em] text-white">
                      Punkte: 0
                    </p>

                    {/* Walking Cat Frame in Preview */}
                    {playerFrame === "frame1" && <WalkingCat cardWidth={703} />}
                  </div>
                </div>
              </div>
            </div>
          )}
        </>
      )}

      {showLobby && (
        <div
          className="absolute inset-0 z-20 px-4 py-4 text-white sm:px-6 sm:py-6 md:px-8 md:py-8"
          style={lobbyScreenStyle()}
        >
          <div className="mx-auto flex h-full w-full max-w-[96rem] flex-col">
            <div className="grid h-full min-h-0 grid-cols-1 gap-4 xl:grid-cols-[minmax(0,2.4fr)_minmax(22rem,1fr)]">
              <div className="flex min-h-0 flex-col gap-4">
                <GlassCard className="relative px-5 py-5 sm:px-6 sm:py-6">
                  <p className="text-sm font-black uppercase tracking-[0.32em] text-white/50">Lobbycode</p>
                  <p className="mt-3 font-mono text-[clamp(2.3rem,6vw,4.8rem)] font-black uppercase tracking-[0.28em] text-white">
                    {lobbyCode}
                  </p>
                  <button
                    onClick={copyLobbyCode}
                    className="absolute right-4 top-4 flex items-center gap-2 rounded-[1rem] border border-white/30 bg-white/10 px-3 py-2 text-sm font-bold uppercase tracking-wide text-white backdrop-blur-sm transition-all duration-200 hover:-translate-y-0.5 hover:bg-white/20 sm:right-5 sm:top-5"
                  >
                    {codeCopied ? <Check size={18} /> : <Copy size={18} />}
                    {codeCopied ? "Kopiert" : "Kopieren"}
                  </button>
                </GlassCard>

                <GlassCard className="flex min-h-0 flex-1 flex-col p-3 sm:p-4">
                  <div className="custom-scroll grid auto-rows-[minmax(11rem,1fr)] grid-cols-1 gap-3 overflow-y-auto md:grid-cols-2 2xl:grid-cols-3">
                    {lobbyPlayers.map((player) => {
                      const pIsHost = player.isHost;
                      const finalName = pIsHost ? playerName || "NAME" : player.name;
                      return (
                        <div
                          key={player.name}
                          className="relative flex min-h-[11rem] flex-col items-center justify-center overflow-hidden rounded-[1.4rem] border border-white/15 bg-white/[0.06] px-4 py-5 text-center backdrop-blur-sm"
                        >
                          {/* Gradient Fade diagonal for Host */}
                          {pIsHost && playerColor !== DEFAULT_PLAYER_COLOR && (
                            <div 
                              className="pointer-events-none absolute inset-0"
                              style={{
                                background: createPlayerFade(playerColor, playerFadeIntensity, 70)
                              }}
                            />
                          )}

                          <div className="relative z-10 flex h-20 w-20 items-center justify-center overflow-hidden rounded-full text-xl font-black uppercase text-white drop-shadow-md">
                            {pIsHost && playerImage ? (
                              <img src={playerImage} alt="Profile" className="h-full w-full object-cover" />
                            ) : (
                              <div className="flex h-full w-full items-center justify-center bg-white/10">
                                {finalName.slice(0, 1) || "?"}
                              </div>
                            )}
                          </div>

                          {/* Walking Cat Frame */}
                          {pIsHost && playerFrame === "frame1" && <WalkingCat cardWidth={280} />}
                          
                          <p className="relative z-10 mt-4 break-all text-[1.6rem] font-black uppercase leading-none text-white drop-shadow-md sm:text-[1.9rem]">
                            {finalName}
                          </p>
                          {pIsHost && (
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
                  <p className="text-xs font-black uppercase tracking-[0.28em] text-white/50">Spielmodus</p>
                  <div className="mt-3 flex items-center gap-4 rounded-[1.3rem] border border-white/15 bg-white/[0.06] px-3 py-3">
                    <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-[1rem] border border-white/30 text-xl font-black uppercase text-white">
                      {lobbyModeBadge}
                    </div>
                    <div>
                      <p className="text-[1.75rem] font-black uppercase leading-tight text-white">{lobbyModeLabel}</p>
                      <p className="mt-1 text-sm font-semibold uppercase tracking-[0.2em] text-white/50">
                        Privatlobby · {lobbyPlayers.length} Spieler verbunden
                      </p>
                    </div>
                  </div>
                </GlassCard>

                <GlassCard className="flex min-h-0 flex-1 flex-col p-4">
                  <p className="shrink-0 text-xs font-black uppercase tracking-[0.28em] text-white/50">
                    Rollen für diese Runde
                  </p>

                  <div className="custom-scroll mt-4 flex-1 space-y-2 overflow-y-auto pr-1">
                    {activeRoles.length > 0 ? (
                      activeRoles.map((role) => (
                        <button
                          key={role.name}
                          onClick={() => setSelectedRoleDetail(role.name)}
                          className="flex w-full items-center justify-between rounded-[1rem] border border-white/15 bg-white/5 px-3 py-2 text-left transition-all duration-150 hover:border-white/30 hover:bg-white/10"
                        >
                          <div className="flex items-center gap-3">
                            <div className="flex h-9 w-9 shrink-0 items-center justify-center">
                              <RoleIcon name={role.name} />
                            </div>
                            <span className="text-[1.05rem] font-bold uppercase text-white">{role.name}</span>
                          </div>
                          <span className="text-[1.1rem] font-black text-white">{roleCounts[role.name]}</span>
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
                      onClick={() => setIsRolePickerOpen(true)}
                      className="mt-4 rounded-[1rem] border border-white/30 bg-white/10 px-4 py-3 text-sm font-black uppercase tracking-[0.18em] text-white transition-all duration-200 hover:bg-white/20"
                    >
                      Rollen auswählen
                    </button>
                  )}
                </GlassCard>

                <GlassCard className="p-4">
                  <p className="text-xs font-black uppercase tracking-[0.28em] text-white/50">Sonstige Regeln</p>
                  <p className="mt-3 text-sm font-semibold text-white/30">Keine besonderen Regeln festgelegt.</p>
                </GlassCard>

                {isHost ? (
                  <button className="rounded-[1.5rem] border border-white/30 bg-white/15 px-5 py-4 text-[1.25rem] font-black uppercase tracking-[0.16em] text-white backdrop-blur-sm transition-all duration-200 hover:-translate-y-1 hover:bg-white hover:text-black">
                    Spiel starten
                  </button>
                ) : (
                  <div className="rounded-[1.5rem] border border-white/10 bg-white/5 px-5 py-4 text-center text-sm font-bold uppercase tracking-[0.16em] text-white/40">
                    Warte auf Host…
                  </div>
                )}
              </aside>
            </div>
          </div>

          {selectedRoleDetail && (() => {
            const role = WEREWOLF_ROLES.find((r) => r.name === selectedRoleDetail)!;
            const teamLabel = role.team === "gut" ? "Gut" : role.team === "böse" ? "Böse" : "Neutral";
            const teamColor =
              role.team === "gut"
                ? "text-green-400"
                : role.team === "böse"
                  ? "text-red-400"
                  : "text-[#8ba4d4]";
            const iconBg =
              role.team === "gut"
                ? "border-green-400/40 bg-green-400/10"
                : role.team === "böse"
                  ? "border-red-400/40 bg-red-400/10"
                  : "border-[#6382be]/40 bg-[#6382be]/10";

            return (
              <div
                className="absolute inset-0 z-50 flex items-center justify-center bg-[#030712]/80 px-4 py-6 backdrop-blur-md"
                onClick={() => setSelectedRoleDetail(null)}
              >
                <div
                  className="w-full max-w-[44rem] rounded-[2rem] border border-white/15 bg-[#0c1525]/95 p-6 shadow-[0_18px_80px_rgba(0,0,0,0.6)] backdrop-blur-2xl sm:p-8"
                  onClick={(e) => e.stopPropagation()}
                >
                  {/* Top: Icon + Name + Meta */}
                  <div className="flex items-start gap-5">
                    <div className={`flex h-28 w-28 shrink-0 items-center justify-center rounded-[1.2rem] p-2 ${iconBg}`}>
                      <RoleIcon name={role.name} />
                    </div>
                    <div className="flex flex-col justify-center">
                      <h2 className="text-[2.2rem] font-black uppercase leading-none text-white sm:text-[2.8rem]">
                        {role.name}
                      </h2>
                      <p className="mt-2.5 text-sm font-bold uppercase tracking-[0.2em]">
                        <span className="text-white/40">Team: </span>
                        <span className={teamColor}>{teamLabel}</span>
                      </p>
                    </div>
                  </div>

                  {/* Divider */}
                  <div className="my-6 h-[1px] w-full bg-gradient-to-r from-transparent via-white/20 to-transparent" />

                  {/* Beschreibung */}
                  <div>
                    <p className="text-xs font-black uppercase tracking-[0.28em] text-white/40">Beschreibung</p>
                    <p className="mt-3 text-[1rem] font-medium leading-7 text-white/75">
                      {role.description}
                    </p>
                  </div>

                  {/* Divider */}
                  <div className="my-6 h-[1px] w-full bg-gradient-to-r from-transparent via-white/20 to-transparent" />

                  {/* Gewinnkondition */}
                  <div>
                    <p className="text-xs font-black uppercase tracking-[0.28em] text-white/40">Gewinnkondition</p>
                    <p className="mt-3 text-[1rem] font-medium leading-7 text-white/50">
                      {role.team === "gut"
                        ? "Alle Werwölfe müssen eliminiert werden."
                        : role.team === "böse"
                          ? "Alle Dorfbewohner müssen eliminiert werden."
                          : role.name === "Dorftrottel"
                            ? "Muss am ersten Tag rausgevotet werden."
                            : role.name === "Kopfgeldjäger"
                              ? "Das tägliche Ziel muss ausscheiden."
                              : "Eigene Gewinnbedingung erfüllen."}
                    </p>
                  </div>

                  {/* Close button */}
                  <button
                    onClick={() => setSelectedRoleDetail(null)}
                    className="mt-8 w-full rounded-[1.2rem] border border-white/20 bg-white/10 py-3 text-sm font-black uppercase tracking-[0.2em] text-white transition-all duration-200 hover:bg-white/20"
                  >
                    Schließen
                  </button>
                </div>
              </div>
            );
          })()}

          {isRolePickerOpen && (
            <div
              className="absolute inset-0 z-40 flex items-center justify-center bg-[#030712]/85 px-4 py-6 backdrop-blur-lg"
              onClick={() => setIsRolePickerOpen(false)}
            >
              <div
                className="flex h-[min(90vh,58rem)] w-full max-w-[84rem] flex-col rounded-[2rem] p-2 sm:p-4"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="flex shrink-0 items-center justify-between gap-4 pb-4">
                  <div>
                    <p className="text-xs font-black uppercase tracking-[0.3em] text-white/45">Rollen auswählen</p>
                    <h2 className="mt-2 text-[1.8rem] font-black uppercase text-white sm:text-[2.2rem]">
                      Rollen-Konfiguration
                    </h2>
                  </div>
                  <button
                    onClick={() => setIsRolePickerOpen(false)}
                    className="group flex h-12 w-12 shrink-0 items-center justify-center rounded-full border border-white/10 bg-transparent text-white/50 transition-all duration-200 hover:border-white/30 hover:bg-white/10 hover:text-white"
                    aria-label="Popup schließen"
                  >
                    <X size={22} className="transition-transform duration-200 group-hover:rotate-90" />
                  </button>
                </div>

                <div className="custom-scroll mt-4 min-h-0 flex-1 overflow-y-auto pr-1">
                  {(["gut", "böse", "neutral"] as const).map((team, teamIdx) => {
                    const teamRoles = WEREWOLF_ROLES.filter((r) => r.team === team);
                    const label = team === "gut" ? "Gute Rollen" : team === "böse" ? "Böse Rollen" : "Neutrale Rollen";
                    const fadeColor =
                      team === "gut"
                        ? "rgba(34,197,94,0.7)"
                        : team === "böse"
                          ? "rgba(239,68,68,0.7)"
                          : "rgba(99,130,190,0.7)";
                    const cardBorder =
                      team === "gut"
                        ? "border-green-400/30 bg-green-400/[0.09]"
                        : team === "böse"
                          ? "border-red-400/30 bg-red-400/[0.09]"
                          : "border-[#6382be]/30 bg-[#6382be]/[0.09]";
                    const iconBorder =
                      team === "gut"
                        ? "border-green-400/40 bg-green-400/10"
                        : team === "böse"
                          ? "border-red-400/40 bg-red-400/10"
                          : "border-[#6382be]/40 bg-[#6382be]/10";

                    return (
                      <div key={team} className={teamIdx > 0 ? "mt-5" : ""}>
                        {/* Fade-divider */}
                        <div className="mb-3 flex items-center gap-0">
                          <div
                            className="h-[1.5px] flex-1"
                            style={{
                              background: `linear-gradient(to right, transparent, ${fadeColor} 40%, ${fadeColor} 60%, transparent)`,
                            }}
                          />
                          <span className="mx-3 shrink-0 text-[0.7rem] font-black uppercase tracking-[0.25em]"
                            style={{ color: fadeColor }}>
                            {label}
                          </span>
                          <div
                            className="h-[1.5px] flex-1"
                            style={{
                              background: `linear-gradient(to left, transparent, ${fadeColor} 40%, ${fadeColor} 60%, transparent)`,
                            }}
                          />
                        </div>

                        {/* Role cards grid */}
                        <div className="grid grid-cols-1 gap-x-3 gap-y-2 sm:grid-cols-2 xl:grid-cols-3">
                          {teamRoles.map((role) => (
                            <div
                              key={role.name}
                              className={`group relative z-0 flex h-[5.4rem] items-center gap-4 rounded-[1.2rem] border px-4 backdrop-blur-sm hover:z-50 ${cardBorder}`}
                            >
                              {/* Icon */}
                              <div className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-[0.9rem] p-2 ${iconBorder}`}>
                                <RoleIcon name={role.name} />
                              </div>

                              {/* Name + controls */}
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
                                    {roleCounts[role.name]}
                                  </span>
                                  <button
                                    onClick={() => changeRoleCount(role.name, -1)}
                                    disabled={roleCounts[role.name] === 0}
                                    className="text-white/60 transition-all hover:text-white disabled:opacity-20"
                                  >
                                    <Minus size={18} />
                                  </button>
                                </div>
                              </div>

                              {/* Info icon + tooltip */}
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
