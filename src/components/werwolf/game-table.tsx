"use client";

import { LogOut } from "lucide-react";
import type { ReactNode } from "react";

import { WalkingCat } from "@/components/werwolf/walking-cat";
import {
  DEFAULT_COLOR,
  SEAT_COUNT,
  colorWash,
  type LobbyPlayer,
} from "@/lib/game";

/**
 * Spieltisch – Sitzordnung nach Skizze:
 *
 *   [ 1 ]  [11]    [ HOST ]    [12]  [ 2 ]
 *   [ 3 ]                      [ 4 ]
 *   [ 5 ]                      [ 6 ]
 *   [ 7 ]                      [ 8 ]
 *   [ 9 ]                      [10 ]
 *
 * Alle Angaben in Prozent der Spielfläche. Die Plätze werden in der
 * Beitrittsreihenfolge besetzt (1, 2, 3, …), d. h. links und rechts wachsen
 * immer im Wechsel – die Anordnung bleibt damit für jede Spielerzahl
 * symmetrisch und füllt sich von oben nach unten.
 */
interface SeatBox {
  left: number;
  top: number;
  width: number;
  height: number;
}

const SIDE_LEFT = 1;
const SIDE_RIGHT = 82;
const SIDE_WIDTH = 17;
const ROW_HEIGHT = 18.6;
const ROW_GAP = 1.2;
const ROW_TOP = Array.from({ length: 5 }, (_, row) => 1 + row * (ROW_HEIGHT + ROW_GAP));
const TOP_ROW_LEFT = 19.5;
const TOP_ROW_RIGHT = 63.5;

const HOST_BOX: SeatBox = { left: 39.5, top: 1, width: 21, height: 26 };

/** Platz 1 bis 12 (Index 0–11). Ungerade Plätze links, gerade rechts. */
export const SEAT_LAYOUT: SeatBox[] = [
  ...ROW_TOP.flatMap((top) => [
    { left: SIDE_LEFT, top, width: SIDE_WIDTH, height: ROW_HEIGHT },
    { left: SIDE_RIGHT, top, width: SIDE_WIDTH, height: ROW_HEIGHT },
  ]),
  { left: TOP_ROW_LEFT, top: 1, width: SIDE_WIDTH, height: ROW_HEIGHT },
  { left: TOP_ROW_RIGHT, top: 1, width: SIDE_WIDTH, height: ROW_HEIGHT },
];

export interface GameTableProps {
  /** Teilnehmer inklusive Host; der eigene Eintrag ist bereits aufgelöst. */
  players: LobbyPlayer[];
  /** Spieler-ID, der gerade spricht (grüner Leuchtrand). */
  speakingId: string | null;
  isHost: boolean;
  busy: boolean;
  onBackToLobby: () => void;
  onLeave: () => void;
}

export function GameTable({
  players,
  speakingId,
  isHost,
  busy,
  onBackToLobby,
  onLeave,
}: GameTableProps) {
  const host = players.find((player) => player.isHost) ?? null;
  const guests = players.filter((player) => !player.isHost).slice(0, SEAT_COUNT);

  return (
    <div className="absolute inset-0 z-20 overflow-hidden bg-[#1e40af] text-white">
      {host && (
        <Seat box={HOST_BOX}>
          <PlayerCard
            player={host}
            speaking={host.id === speakingId}
            label="Host"
          />
        </Seat>
      )}

      {SEAT_LAYOUT.map((box, index) => {
        const player = guests[index];
        return (
          <Seat key={`seat-${index}`} box={box} number={index + 1}>
            {player ? (
              <PlayerCard
                player={player}
                speaking={player.id === speakingId}
                label="Player"
              />
            ) : null}
          </Seat>
        );
      })}

      <div className="pointer-events-none absolute left-1/2 top-[52%] flex -translate-x-1/2 flex-col items-center text-center">
        <p className="text-[clamp(1.2rem,2.6vw,2.4rem)] font-black uppercase tracking-[0.24em] text-white">
          Spiel läuft
        </p>
        <p className="mt-2 text-xs font-bold uppercase tracking-[0.3em] text-white/60">
          {players.length} Teilnehmer
        </p>
      </div>

      <div className="absolute bottom-[2.5%] left-1/2 flex -translate-x-1/2 items-center gap-3">
        <button
          onClick={onLeave}
          className="flex items-center gap-2 rounded-[1rem] border border-white/25 bg-white/5 px-3 py-2 text-xs font-bold uppercase tracking-wide text-white/70 transition-all duration-200 hover:border-red-400/50 hover:bg-red-500/15 hover:text-red-100"
        >
          <LogOut size={16} />
          Lobby verlassen
        </button>
        {isHost && (
          <button
            onClick={onBackToLobby}
            disabled={busy}
            className="rounded-[1rem] border border-white/20 bg-white/5 px-4 py-2 text-xs font-bold uppercase tracking-[0.18em] text-white/70 transition-all duration-200 hover:bg-white/15 hover:text-white disabled:opacity-50"
          >
            Zurück zur Lobby
          </button>
        )}
      </div>
    </div>
  );
}

function Seat({
  box,
  number,
  children,
}: {
  box: SeatBox;
  number?: number;
  children?: ReactNode;
}) {
  return (
    <div
      className="absolute"
      style={{
        left: `${box.left}%`,
        top: `${box.top}%`,
        width: `${box.width}%`,
        height: `${box.height}%`,
      }}
    >
      {children ?? (
        <div className="flex h-full w-full items-center justify-center rounded-[1.4rem] border-2 border-dashed border-white/20 text-white/30">
          <span className="text-[clamp(0.9rem,2vw,1.6rem)] font-bold">{number}</span>
        </div>
      )}
    </div>
  );
}

function PlayerCard({
  player,
  speaking,
  label,
}: {
  player: LobbyPlayer;
  speaking: boolean;
  label: string;
}) {
  const displayName = player.name || "NAME";
  const hasColor = Boolean(player.color) && player.color !== DEFAULT_COLOR;

  return (
    <div
      className={`relative flex h-full w-full flex-col items-center justify-center overflow-hidden rounded-[1.4rem] border-2 bg-[#172033] px-3 py-3 text-center transition-all duration-150 ${
        speaking
          ? "border-[#4ade80] shadow-[0_0_20px_rgba(34,197,94,0.95),0_0_44px_rgba(34,197,94,0.55),inset_0_0_20px_rgba(34,197,94,0.4)] ring-2 ring-[#4ade80]"
          : "border-white/15"
      }`}
      style={{ containerType: "size" }}
    >
      {hasColor && (
        <div
          className="pointer-events-none absolute inset-0"
          style={{
            background: colorWash(player.color, player.fadeIntensity ?? 50, 70),
          }}
        />
      )}
      <div
        className="relative z-10 flex items-center justify-center overflow-hidden rounded-full text-[clamp(1rem,30cqmin,2.5rem)] font-black uppercase text-white drop-shadow-md"
        style={{ width: "38cqmin", height: "38cqmin" }}
      >
        {player.image ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={player.image} alt="Profile" className="h-full w-full object-cover" />
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-white/10">
            {displayName.slice(0, 1) || "?"}
          </div>
        )}
      </div>
      <p
        className="relative z-10 mt-[4cqmin] max-w-full break-all font-black uppercase leading-none text-white drop-shadow-md"
        style={{ fontSize: "clamp(0.8rem, 13cqmin, 2.2rem)" }}
      >
        {displayName}
      </p>
      <p
        className="relative z-10 mt-[2cqmin] font-bold uppercase tracking-[0.3em] text-white/50"
        style={{ fontSize: "clamp(0.45rem, 5.5cqmin, 0.8rem)" }}
      >
        {label}
      </p>
      {player.frame === "frame1" && <WalkingCat cardWidth={200} />}
    </div>
  );
}
