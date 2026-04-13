import { Hono } from "hono";
import type { Env } from "../types";
import { createAuth } from "../lib/auth";
import { createDb } from "../lib/db";
import {
  activateTrialIfEligible,
  buildAuthEntitlements,
  buildGuestEntitlements,
  getUserEntitlements,
} from "../lib/entitlements";

const auth = new Hono<{ Bindings: Env }>();

auth.get("/entitlements", async (c) => {
  const db = createDb(c.env);
  const authInstance = createAuth(db, c.env);
  const session = await authInstance.api.getSession({ headers: c.req.raw.headers });

  if (!session?.user) {
    return c.json(buildGuestEntitlements(c.env));
  }

  const entitlements = await getUserEntitlements(db, session.user.id, c.env);
  return c.json(entitlements ?? buildGuestEntitlements(c.env));
});

auth.post("/trial/activate", async (c) => {
  const db = createDb(c.env);
  const authInstance = createAuth(db, c.env);
  const session = await authInstance.api.getSession({ headers: c.req.raw.headers });

  if (!session?.user) {
    return c.json({ error: "Unauthorized", message: "Authentication required" }, 401);
  }

  const user = await activateTrialIfEligible(db, session.user.id, c.env);
  if (!user) {
    return c.json({ error: "NotFound", message: "User not found" }, 404);
  }

  return c.json(buildAuthEntitlements(user, c.env));
});

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
