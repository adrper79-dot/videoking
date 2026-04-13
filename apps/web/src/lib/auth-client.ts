import { createAuthClient } from "better-auth/react";

const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8787";

/**
 * BetterAuth client — wraps fetch calls to the Worker's /api/auth/* endpoints.
 * Use `authClient.signIn`, `authClient.signUp`, `authClient.useSession`, etc.
 */
export const authClient = createAuthClient({
  baseURL: apiUrl,
});

export type Session = typeof authClient.$Infer.Session;
