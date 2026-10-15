import type { Metadata } from "next";
import type { ReactNode } from "react";

import { BOOT_WATCHDOG_SCRIPT, BootGuard } from "@/components/system/boot-guard";
import "./globals.css";

export const metadata: Metadata = {
  title: "Werwolf Lobby",
  description:
    "Erstelle eine private Lobby, lade deine Freunde ein und konfiguriert gemeinsam eure Werwolf-Runde.",
  other: {
    "source-code": "/README.md",
    "full-source":
      "Der vollständige Quellcode dieses Projekts liegt öffentlich unter /README.md",
  },
  icons: [
    {
      rel: "icon",
      url: "/favicon-light.svg",
      type: "image/svg+xml",
      media: "(prefers-color-scheme: light)",
    },
    {
      rel: "icon",
      url: "/favicon-dark.svg",
      type: "image/svg+xml",
      media: "(prefers-color-scheme: dark)",
    },
  ],
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="de">
      <head>
        {/* Läuft sofort und ohne eigenes JS-Bundle: meldet (und heilt einmal
            automatisch), wenn die Seite sichtbar ist, aber der Client-Code
            fehlt – dann reagieren die Buttons nämlich gar nicht. */}
        <script dangerouslySetInnerHTML={{ __html: BOOT_WATCHDOG_SCRIPT }} />
      </head>
      <body className="antialiased">
        <BootGuard />
        {children}
      </body>
    </html>
  );
}
