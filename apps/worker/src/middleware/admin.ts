import { eq } from "drizzle-orm";
import { createDb } from "../lib/db";
import { createAuth } from "../lib/auth";
import { users } from "@nichestream/db";

/**
 * Middleware that enforces admin-only access.
 * Attaches verified admin role to context.var.adminUser.
 */
export function requireAdmin() {
  return async (c: any, next: any) => {
    const db = createDb(c.env);
    const auth = createAuth(db, c.env);

    const session = await auth.api.getSession({ headers: c.req.raw.headers });
    if (!session?.user) {
      return c.json({ error: "Unauthorized", message: "Authentication required" }, 401);
    }

    const [user] = await db
      .select({ role: users.role, id: users.id })
      .from(users)
      .where(eq(users.id, session.user.id))
      .limit(1);

    if (!user || user.role !== "admin") {
      return c.json({ error: "Forbidden", message: "Admin access required" }, 403);
    }

    // Attach admin user to context for route handlers
    c.set("adminUser", user);
    return next();
  };
}
