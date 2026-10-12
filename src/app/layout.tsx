import type { Metadata } from "next";
import type { ReactNode } from "react";
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
      <body className="antialiased">{children}</body>
    </html>
  );
}
