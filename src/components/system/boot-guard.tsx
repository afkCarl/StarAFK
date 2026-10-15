"use client";

import { useEffect } from "react";

/** Schlüssel für den einmaligen automatischen Neulade-Versuch (siehe layout.tsx). */
const BOOT_RELOAD_KEY = "starafk-boot-reload";
/** Schlüssel für den Neulade-Versuch nach einem Chunk-Ladefehler. */
const CHUNK_RELOAD_KEY = "starafk-chunk-reload";

function reloadOnce(key: string): boolean {
  try {
    if (sessionStorage.getItem(key) === "1") return false;
    sessionStorage.setItem(key, "1");
  } catch {
    /* Privater Modus – dann eben ohne Schutz vor einer zweiten Runde. */
  }
  window.location.reload();
  return true;
}

/**
 * Start-Wächter der App.
 *
 * Zwei Aufgaben, beide gegen dasselbe Fehlerbild: Die Seite ist sichtbar
 * (serverseitig gerendert), aber die Buttons reagieren nicht, weil der
 * Client-Code fehlt.
 *
 * 1. **Bereitschaft markieren**: `data-app-ready="1"` am <html>-Element. Das
 *    inline Watchdog-Skript in `layout.tsx` (läuft auch dann, wenn KEIN Chunk
 *    geladen werden konnte) prüft darauf und lädt die Seite einmal neu bzw.
 *    zeigt eine Meldung mit „Neu laden“-Button.
 * 2. **Chunk-Ladefehler abfangen**: Nach einem Deploy heißen die JS-Dateien
 *    anders. Ein noch offener Tab (oder ein zwischengespeicherter HTML-Stand)
 *    verlangt dann Dateien, die es nicht mehr gibt – React hängt mitten im
 *    Laden fest und die Oberfläche wirkt „tot“. Ein gezielter Neulade-Versuch
 *    holt genau dann den aktuellen Stand.
 */
export function BootGuard() {
  useEffect(() => {
    document.documentElement.setAttribute("data-app-ready", "1");
    // Erfolgreich gestartet: Den Zähler für den automatischen Neustart
    // zurücksetzen, damit ein späterer Fehler wieder einmal heilen darf.
    try {
      sessionStorage.removeItem(BOOT_RELOAD_KEY);
      sessionStorage.removeItem(CHUNK_RELOAD_KEY);
    } catch {
      /* egal */
    }

    const onResourceError = (event: Event) => {
      const target = event.target as
        | { tagName?: string; src?: string; href?: string }
        | null;
      if (!target || typeof target.tagName !== "string") return;
      const tag = target.tagName.toUpperCase();
      if (tag !== "SCRIPT" && tag !== "LINK") return;
      const url = target.src ?? target.href ?? "";
      // Nur fehlgeschlagene Next.js-Chunks neu laden lassen, nicht z. B. ein
      // kaputtes Rollen-Icon.
      if (!url.includes("/_next/")) return;
      reloadOnce(CHUNK_RELOAD_KEY);
    };

    const onRejection = (event: PromiseRejectionEvent) => {
      const reason = event.reason as { name?: string; message?: string } | null;
      const message = `${reason?.name ?? ""} ${reason?.message ?? String(event.reason ?? "")}`;
      if (/ChunkLoadError|Loading chunk [\w~.-]+ failed|Failed to fetch dynamically imported module/i.test(message)) {
        reloadOnce(CHUNK_RELOAD_KEY);
      }
    };

    // `true` (Capture-Phase): Fehler beim Laden von <script>/<link> bubble’n
    // nicht – nur so bekommt man sie überhaupt mit.
    window.addEventListener("error", onResourceError, true);
    window.addEventListener("unhandledrejection", onRejection);
    return () => {
      window.removeEventListener("error", onResourceError, true);
      window.removeEventListener("unhandledrejection", onRejection);
    };
  }, []);

  return null;
}

/**
 * Inline-Skript (OHNE eigenes Chunk) für den Fall, dass gar kein Client-Code
 * ankommt. Bewusst als String in `layout.tsx` eingebunden: Ein eigener
 * JS-Bundle würde zusammen mit den anderen Chunks fehlen – genau dann, wenn
 * der Wächter gebraucht wird.
 */
export const BOOT_WATCHDOG_SCRIPT = `(function () {
  var KEY = "starafk-boot-reload";
  var LIMIT_MS = 12000;
  function isReady() {
    return document.documentElement.getAttribute("data-app-ready") === "1";
  }
  function showBanner(text) {
    if (document.getElementById("starafk-boot-banner")) return;
    var bar = document.createElement("div");
    bar.id = "starafk-boot-banner";
    bar.setAttribute("role", "alert");
    bar.style.cssText =
      "position:fixed;left:0;right:0;bottom:0;z-index:2147483000;display:flex;" +
      "flex-wrap:wrap;gap:12px;align-items:center;justify-content:center;" +
      "padding:12px 16px;background:#450a0a;color:#fee2e2;text-align:center;" +
      "font:600 14px/1.4 system-ui,-apple-system,Segoe UI,sans-serif";
    var message = document.createElement("span");
    message.textContent = text;
    var button = document.createElement("button");
    button.type = "button";
    button.textContent = "Neu laden";
    button.style.cssText =
      "border:1px solid #fca5a5;border-radius:10px;background:#7f1d1d;color:#fff;" +
      "padding:6px 12px;font:700 13px system-ui,sans-serif;cursor:pointer";
    button.onclick = function () {
      window.location.reload();
    };
    bar.appendChild(message);
    bar.appendChild(button);
    (document.body || document.documentElement).appendChild(bar);
  }
  setTimeout(function () {
    if (isReady()) return;
    var retried = false;
    try {
      retried = sessionStorage.getItem(KEY) === "1";
      if (!retried) sessionStorage.setItem(KEY, "1");
    } catch (error) {
      retried = false;
    }
    if (!retried) {
      window.location.reload();
      return;
    }
    showBanner(
      "Die Seite konnte nicht vollständig geladen werden – die Buttons " +
        "reagieren sonst nicht. Bitte einmal neu laden."
    );
  }, LIMIT_MS);
})();`;
