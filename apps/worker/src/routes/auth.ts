import { Hono } from "hono";
import type { Env } from "../types";
import { createAuth } from "../lib/auth";
import { createDb } from "../lib/db";

const auth = new Hono<{ Bindings: Env }>();

/**
 * Delegate all /api/auth/* requests to BetterAuth.
 * BetterAuth handles sign-in, sign-up, sign-out, session, and OAuth flows.
 */
auth.all("/*", async (c) => {
  const db = createDb(c.env);
  const authInstance = createAuth(db, c.env);
  return authInstance.handler(c.req.raw);
});

export { auth as authRoutes };
