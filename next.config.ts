import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Datenbank-Treiber nicht bundlen (stehen in node_modules und werden zur
  // Laufzeit von Node geladen) – wichtig für eingebettetes PGlite und `pg`.
  serverExternalPackages: ["@electric-sql/pglite", "pg"],
  // `next dev` blockt sonst Cross-Origin-Anfragen von Preview-Hosts.
  allowedDevOrigins: [".e2b.app", "localhost", "127.0.0.1"],
};

export default nextConfig;
