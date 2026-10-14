import { auth } from "@/lib/auth/server";
import { json } from "@/lib/api";

export const dynamic = "force-dynamic";

/**
 * Proxy für Neon Auth: `/api/auth/*` → Managed-Auth-Server des Branches.
 * Der Browser-Client (`createAuthClient()`) spricht ausschließlich mit dieser
 * same-origin Route (Sign-in, Sign-up, Session, Sign-out, JWT).
 */
const handler = auth?.handler();

async function notConfigured(): Promise<Response> {
  return json({ ok: false, reason: "auth_disabled" }, 503);
}

export const GET = handler?.GET ?? notConfigured;
export const POST = handler?.POST ?? notConfigured;
export const PUT = handler?.PUT ?? notConfigured;
export const DELETE = handler?.DELETE ?? notConfigured;
export const PATCH = handler?.PATCH ?? notConfigured;
