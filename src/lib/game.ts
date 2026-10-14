export interface Role {
  short: string;
  name: string;
  team: "gut" | "böse" | "neutral";
  description: string;
}

export const ROLES: Role[] = [
  { short: "DB", name: "Dorfbewohner", team: "gut", description: "Hat keine Spezialfähigkeit und muss tagsüber die Werwölfe entlarven." },
  { short: "SE", name: "Seher", team: "gut", description: "Darf jede Nacht einen Spieler überprüfen und erfährt, ob er gut, böse oder neutral ist." },
  { short: "HX", name: "Hexe", team: "gut", description: "Besitzt einen Heil- und einen Gifttrank und entscheidet nachts über deren Einsatz." },
  { short: "JG", name: "Jäger", team: "gut", description: "Nimmt beim eigenen Ausscheiden sofort einen weiteren Spieler mit." },
  { short: "DK", name: "Doktor", team: "gut", description: "Kann jede Nacht einen Spieler schützen und so einen Angriff verhindern." },
  { short: "AM", name: "Amor", team: "gut", description: "Bestimmt zu Beginn zwei Verliebte, deren Schicksal miteinander verbunden ist." },
  { short: "MD", name: "Medium", team: "gut", description: "Erhält Hinweise aus dem Jenseits und kann dem Dorf wichtige Informationen liefern." },
  { short: "BM", name: "Bürgermeister", team: "gut", description: "Seine Stimme zählt bei Abstimmungen doppelt und entscheidet Gleichstände." },
  { short: "GO", name: "Goethe", team: "gut", description: "Die ausgewählte Person darf am nächsten Tag nur in Reimen sprechen." },
  { short: "DT", name: "Detektiv", team: "gut", description: "Darf jede Nacht bei einem Spieler sehen, mit wem er interagiert hat, erhält aber 3 Spieler von denen einer stimmt." },
  { short: "WW", name: "Werwolf", team: "böse", description: "Greift nachts gemeinsam an und versucht das Dorf unbemerkt zu kontrollieren." },
  { short: "KJ", name: "Kopfgeldjäger", team: "neutral", description: "Kriegt jeden Tag ein neues Ziel und gewinnt nur, wenn dieses bestimmte Ziel ausscheidet." },
  { short: "TT", name: "Dorftrottel", team: "neutral", description: "Muss am ersten Tag rausgevotet werden, um zu gewinnen, oder wird sonst zum Dorfbewohner." },
  { short: "SM", name: "Sandmann", team: "neutral", description: "Kann eine Person zum Schlafen bringen. Diese kann am nächsten Tag nicht reden oder voten." },
  { short: "DI", name: "Dieb", team: "neutral", description: "Stiehlt zu Beginn des Spiels eine der übrigen Rollen und übernimmt deren Rolle." },
];

export interface GameMode {
  title: string;
  description: string;
}

export const MODES: GameMode[] = [
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
];

export const DEFAULT_COLOR = "#6b7280";

export function randomName(): string {
  return `Player${Math.floor(100 + Math.random() * 900)}`;
}

export function defaultRoleCounts(): Record<string, number> {
  const counts = Object.fromEntries(ROLES.map((r) => [r.name, 0]));
  counts.Werwolf = 1;
  counts.Dorfbewohner = 2;
  return counts;
}

/** Appends an alpha channel (0-100 percent) to a hex color. */
export function withAlpha(hex: string, alphaPct: number): string {
  const clamped = Math.max(0, Math.min(100, alphaPct));
  const alpha = Math.round((clamped / 100) * 255)
    .toString(16)
    .padStart(2, "0");
  return `${hex}${alpha}`;
}

/** Diagonal colour wash used on player cards (135deg fade). */
export function colorWash(color: string, intensity: number, size: number): string {
  const strong = Math.max(8, Math.min(100, intensity));
  const mid = Math.max(6, Math.round(strong * 0.62));
  const weak = Math.max(4, Math.round(strong * 0.34));
  const stop1 = Math.max(12, Math.round(size * 0.28));
  const stop2 = Math.max(24, Math.round(size * 0.58));
  const end = Math.max(stop2 + 8, size);
  return `linear-gradient(135deg, ${withAlpha(color, strong)} 0%, ${withAlpha(
    color,
    mid,
  )} ${stop1}%, ${withAlpha(color, weak)} ${stop2}%, transparent ${end}%)`;
}

export function winCondition(role: Role): string {
  if (role.team === "gut") return "Alle Werwölfe müssen eliminiert werden.";
  if (role.team === "böse") return "Alle Dorfbewohner müssen eliminiert werden.";
  if (role.name === "Dorftrottel") return "Muss am ersten Tag rausgevotet werden.";
  if (role.name === "Kopfgeldjäger") return "Das tägliche Ziel muss ausscheiden.";
  return "Eigene Gewinnbedingung erfüllen.";
}

export interface PlayerProfile {
  name: string;
  color: string;
  fadeIntensity: number;
  frame: string;
  image: string | null;
}

export interface LobbyPlayer extends PlayerProfile {
  id: string;
  isHost: boolean;
}

/** Vom AI Game Master (Neon Function `gamemaster`) erzeugter Text. */
export interface LobbyNarration {
  kind: string;
  text: string;
  model: string | null;
  createdAt: string;
}

export interface LobbyState {
  code: string;
  players: LobbyPlayer[];
  roleCounts: Record<string, number>;
  gameStarted: boolean;
  /** Neuester Game-Master-Text – für alle Spieler sichtbar. */
  narration: LobbyNarration | null;
}
