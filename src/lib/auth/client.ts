"use client";

import { createAuthClient } from "@neondatabase/auth/next";

/**
 * Browser-Client für Neon Auth. `createAuthClient()` bekommt bewusst KEINE
 * Argumente: Der Client spricht mit der same-origin Route `/api/auth/*`, die
 * unser Route-Handler (`src/app/api/auth/[...path]/route.ts`) an den
 * Managed-Auth-Server des Branches weiterreicht. Dadurch braucht der Browser
 * weder die Auth-URL noch Secrets.
 */
export const authClient = createAuthClient();
