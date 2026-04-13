import { createAuthClient } from "better-auth/react";

/**
 * BetterAuth client — routes auth requests through Next.js proxy at /api/auth/*
 * which forwards to the Worker's actual auth endpoints.
 * This ensures cookies and other auth context work correctly in both dev and prod.
 */
export const authClient = createAuthClient({
  baseURL: "/api/auth", // Use Next.js proxy, not direct Worker URL
});

export type Session = typeof authClient.$Infer.Session;
