import { defineConfig } from "@neon/config/v1";

export default defineConfig({
  // Declare your Neon services here
  auth: true,
  aiGateway: true,
  functions: {
    // Slug = permanenter Name der Function (URL + CLI). "gamemaster" hostet die
    // AI-Game-Master-Endpunkte, die die App (Browser, mit Neon-Auth-JWT) aufruft.
    gamemaster: { name: "AI Game Master", source: "./functions/gamemaster.ts" },
  },
  buckets: {
    // "private" is the default; use "public_read" for anonymous reads
    // Profilbilder liegen unter `avatars/<player-id>/…`; ausgeliefert werden sie
    // über die eigene Route /api/lobby/avatar (Signatur bleibt serverseitig).
    assets: { access: "private" },
  },
  // Branch policy: per-branch tuning
  branch: (branch) => {
    if (branch.isDefault) {
      // Default branch: no overrides, uses project defaults
      return {};
    }
    if (!branch.exists) {
      // New non-default branches: auto-expire
      // Run `neon checkout <name>` to create a new branch with these settings
      return { ttl: "7d" };
    }
    // Existing branch: no changes
    return {};
  },
});
