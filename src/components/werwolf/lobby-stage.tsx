"use client";

import type { CSSProperties } from "react";

import { WalkingCat } from "@/components/werwolf/walking-cat";
import {
  colorWash,
  DEFAULT_COLOR,
  type LobbyPlayer,
  type PlayerProfile,
} from "@/lib/game";

type SeatCardProps = {
  player: LobbyPlayer;
  profile: PlayerProfile;
  selfId: string | null;
  isSpeaking: boolean;
  seatNumber?: number;
  host?: boolean;
  mobile?: boolean;
};

function SeatCard({
  player,
  profile,
  selfId,
  isSpeaking,
  seatNumber,
  host = false,
  mobile = false,
}: SeatCardProps) {
  const isSelf = player.id === selfId;
  const displayPlayer = isSelf ? { ...player, ...profile } : player;
  const displayName = displayPlayer.name || "NAME";
  const displayImage = displayPlayer.image;
  const displayColor = displayPlayer.color;
  const displayIntensity = displayPlayer.fadeIntensity;
  const displayFrame = displayPlayer.frame;

  return (
    <article
      className={`lobby-player-card ${host ? "lobby-player-card--host" : ""} ${
        mobile ? "lobby-player-card--mobile" : ""
      } ${isSpeaking && isSelf ? "lobby-player-card--speaking" : ""}`}
      aria-label={host ? `${displayName}, Host` : `${displayName}, Spieler ${seatNumber ?? ""}`}
    >
      {displayColor && displayColor !== DEFAULT_COLOR && (
        <div
          className="lobby-player-card__wash"
          style={{ background: colorWash(displayColor, displayIntensity ?? 50, 70) }}
        />
      )}
      {!host && seatNumber !== undefined && (
        <span className="lobby-player-card__seat" aria-hidden="true">
          {String(seatNumber).padStart(2, "0")}
        </span>
      )}
      <div className="lobby-player-card__content">
        <div className="lobby-player-card__avatar">
          {displayImage ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={displayImage} alt={`${displayName} Profilbild`} />
          ) : (
            <span>{displayName.slice(0, 1)}</span>
          )}
        </div>
        <div className="lobby-player-card__identity">
          <p className="lobby-player-card__name">{displayName}</p>
          <p className="lobby-player-card__role">{host ? "Host" : "Spieler"}</p>
        </div>
      </div>
      {displayFrame === "frame1" && (
        <WalkingCat cardWidth={host ? 300 : mobile ? 250 : 220} />
      )}
    </article>
  );
}

export function LobbyStage({
  players,
  selfId,
  profile,
  isSpeaking,
}: {
  players: LobbyPlayer[];
  selfId: string | null;
  profile: PlayerProfile;
  isSpeaking: boolean;
}) {
  const hostPlayer = players.find((player) => player.isHost) ?? players[0] ?? null;
  const guestPlayers = hostPlayer
    ? players.filter((player) => player.id !== hostPlayer.id)
    : [];
  // The first ten guests alternate between the left and right edges (1, 3, 5…
  // on the left; 2, 4, 6… on the right). Guests eleven and twelve sit beside
  // the host, matching the 13-seat reference layout.
  const edgePlayers = guestPlayers.slice(0, 10);
  const leftPlayers = edgePlayers.filter((_, index) => index % 2 === 0);
  const rightPlayers = edgePlayers.filter((_, index) => index % 2 === 1);
  const topPlayers = guestPlayers.slice(10, 12);
  const leftStyle = { "--seat-count": Math.max(1, leftPlayers.length) } as CSSProperties;
  const rightStyle = { "--seat-count": Math.max(1, rightPlayers.length) } as CSSProperties;

  const cardProps = {
    profile,
    selfId,
    isSpeaking,
  };

  return (
    <>
      <section className="lobby-stage lobby-stage--desktop" aria-label="Spielerplätze">
        <div className="lobby-stage__side lobby-stage__side--left" style={leftStyle}>
          {leftPlayers.map((player, index) => (
            <SeatCard
              key={player.id}
              {...cardProps}
              player={player}
              seatNumber={index * 2 + 1}
            />
          ))}
        </div>
        <div className="lobby-stage__inner lobby-stage__inner--left">
          {topPlayers[0] && (
            <SeatCard {...cardProps} player={topPlayers[0]} seatNumber={11} />
          )}
        </div>
        <div className="lobby-stage__host">
          {hostPlayer ? (
            <SeatCard {...cardProps} player={hostPlayer} host />
          ) : (
            <div className="lobby-stage__empty-host">Host</div>
          )}
        </div>
        <div className="lobby-stage__inner lobby-stage__inner--right">
          {topPlayers[1] && (
            <SeatCard {...cardProps} player={topPlayers[1]} seatNumber={12} />
          )}
        </div>
        <div className="lobby-stage__side lobby-stage__side--right" style={rightStyle}>
          {rightPlayers.map((player, index) => (
            <SeatCard
              key={player.id}
              {...cardProps}
              player={player}
              seatNumber={index * 2 + 2}
            />
          ))}
        </div>
        {guestPlayers.length === 0 && (
          <div className="lobby-stage__empty-guests">
            Teile den Lobbycode und warte auf deine Mitspieler.
          </div>
        )}
      </section>

      <section className="lobby-stage lobby-stage--mobile" aria-label="Spielerplätze">
        {hostPlayer && (
          <div className="lobby-stage__mobile-host">
            <SeatCard {...cardProps} player={hostPlayer} host mobile />
          </div>
        )}
        {guestPlayers.length > 0 ? (
          <div className="lobby-stage__mobile-guests">
            {guestPlayers.map((player, index) => (
              <SeatCard
                key={player.id}
                {...cardProps}
                player={player}
                seatNumber={index + 1}
                mobile
              />
            ))}
          </div>
        ) : (
          <div className="lobby-stage__mobile-empty">
            Teile den Lobbycode und warte auf deine Mitspieler.
          </div>
        )}
      </section>
    </>
  );
}
