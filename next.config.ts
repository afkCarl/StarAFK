import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Datenbank-Treiber nicht bundlen (stehen in node_modules und werden zur
  // Laufzeit von Node geladen) – wichtig für eingebettetes PGlite und `pg`.
  serverExternalPackages: ["@electric-sql/pglite", "pg"],
};

export default nextConfig;
