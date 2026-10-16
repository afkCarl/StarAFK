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
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          {
            key: "Permissions-Policy",
            value: "microphone=*",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
