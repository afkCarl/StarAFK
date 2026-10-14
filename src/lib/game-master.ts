/**
 * AI Game Master – App-Seite.
 *
 * Die Texte erzeugt die Neon Function `gamemaster` (siehe `functions/gamemaster.ts`
 * und `neon.ts`): Sie läuft neben der Datenbank, nutzt das Neon AI Gateway und
 * prüft das Neon-Auth-JWT des Aufrufers. `neon deploy` schreibt ihre öffentliche
 * URL als `NEON_FUNCTION_GAMEMASTER_BASE_URL` in `.env.local`.
 *
 * Der Browser ruft die Function direkt auf (Bearer-JWT), nicht über den
 * Next.js-Server – so hängt kein App-Host-Limit dazwischen.
 */
export const GAME_MASTER_URL =
  process.env.NEON_FUNCTION_GAMEMASTER_BASE_URL?.replace(/\/+$/, "") ?? null;

/** AI Gateway ist auf der App-Seite nur für Statusanzeigen von Interesse. */
export const aiGatewayConfigured = Boolean(
  process.env.NEON_AI_GATEWAY_BASE_URL && process.env.NEON_AI_GATEWAY_TOKEN,
);

export const gameMasterEnabled = Boolean(GAME_MASTER_URL);

export type NarrationKind = "intro" | "night" | "recap";

export const NARRATION_LABELS: Record<NarrationKind, string> = {
  intro: "Rollen-Intro",
  night: "Nacht einläuten",
  recap: "Lage zusammenfassen",
};
