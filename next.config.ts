import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Datenbank-Treiber nicht bundlen (stehen in node_modules und werden zur
  // Laufzeit von Node geladen) – wichtig für eingebettetes PGlite und `pg`.
  serverExternalPackages: ["@electric-sql/pglite", "pg"],
  // `next dev` blockt sonst Cross-Origin-Anfragen von Preview-Hosts
  // (Arena-Vorschau: https://<port>-<sandbox>.e2b.app).
  // Wichtig: Next.js versteht hier nur `*.domain` als Platzhalter. Die
  // Vite-Schreibweise `.e2b.app` (mit Punkt vorne) passt auf KEINE Subdomain –
  // dann blockt Next 16 den HMR-WebSocket der Vorschau, die Seite wird nie
  // hydriert und bleibt dauerhaft auf „Laden…“ stehen.
  allowedDevOrigins: ["*.e2b.app", "localhost", "127.0.0.1"],

  /**
   * Das HTML-Dokument darf nicht „frisch“ zwischengespeichert werden.
   *
   * Next liefert die vorgerenderte Startseite mit `Cache-Control:
   * s-maxage=31536000` aus. Die JS-Dateien, auf die dieses HTML verweist,
   * heißen aber nach JEDEM Deploy anders. Bekommt ein Browser (oder ein
   * CDN/Proxy davor) nach einem Deploy das alte HTML aus dem Cache, lädt die
   * Seite zwar sichtbar, findet ihre Chunks nicht mehr und bleibt ohne
   * Interaktivität: „Lobby erstellen“ tut dann einfach nichts. Mit `no-cache`
   * muss jede Antwort erst geprüft werden (ETag → 304, kostet kaum etwas).
   */
  async headers() {
    return [
      {
        source: "/",
        headers: [{ key: "Cache-Control", value: "no-cache, must-revalidate" }],
      },
    ];
  },
};

export default nextConfig;
