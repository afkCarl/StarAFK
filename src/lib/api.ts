import { NextResponse } from "next/server";

import { noteDbFailure, noteDbSuccess } from "@/db";

/** Antworten der Lobby-API dürfen nie gecacht werden (Live-Zustand!). */
export const NO_STORE_HEADERS = {
  "Cache-Control": "no-store, max-age=0",
} as const;

export function json(
  body: unknown,
  status = 200,
  headers?: Record<string, string>,
): NextResponse {
  return NextResponse.json(body, {
    status,
    headers: { ...NO_STORE_HEADERS, ...headers },
  });
}

export async function readJson(request: Request): Promise<Record<string, unknown>> {
  try {
    const body: unknown = await request.json();
    return typeof body === "object" && body !== null
      ? (body as Record<string, unknown>)
      : {};
  } catch {
    return {};
  }
}

type RouteHandler = (request: Request) => Promise<Response>;

/**
 * Einheitlicher Rahmen für alle API-Routen: loggt Fehler, meldet sie der
 * selbstheilenden Datenbank-Verbindung (siehe src/db/index.ts) und antwortet
 * im Fehlerfall mit einem klaren JSON statt mit einer HTML-Fehlerseite.
 */
export function route(label: string, handler: RouteHandler): RouteHandler {
  return async (request: Request) => {
    try {
      const response = await handler(request);
      if (response.status < 500) noteDbSuccess();
      return response;
    } catch (error) {
      noteDbFailure(error);
      console.error(`[api] ${label} failed`, error);
      return json({ ok: false, reason: "server" }, 500);
    }
  };
}
