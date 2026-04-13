import type { Context } from "hono";
import { createDb } from "../lib/db";
import { createAuth } from "../lib/auth";

/**
 * Middleware that enforces authenticated session for any route.
 * Attaches verified user session to context via c.set("session") and c.set("user").
 * 
 * Usage in routes:
 *   router.get("/protected", requireSession(), async (c) => {
 *     const user = c.get("user");
 *     // proceed with authenticated user
 *   });
 */
export function requireSession() {
  return async (c: Context, next: any) => {
    const db = createDb(c.env);
    const auth = createAuth(db, c.env);

    const session = await auth.api.getSession({ headers: c.req.raw.headers });
    if (!session?.user) {
      return c.json({ error: "Unauthorized", message: "Authentication required" }, 401);
    }

    // Attach session and user to context for use in route handlers
    c.set("session", session);
    c.set("user", session.user);

    await next();
  };
}
