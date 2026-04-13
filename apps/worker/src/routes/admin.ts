import { Hono } from "hono";
import { eq } from "drizzle-orm";
import type { Env } from "../types";
import { createDb } from "../lib/db";
import { requireAdmin } from "../middleware/admin";
import { users } from "@nichestream/db";

const adminRouter = new Hono<{ Bindings: Env }>();

/**
 * POST /admin/verify-creator
 * Admin endpoint to verify a creator as BlerdArt community member.
 * Requires admin role. Updates blerdart_verified flag on user.
 */
adminRouter.post("/verify-creator", requireAdmin(), async (c) => {
  const db = createDb(c.env);
  
  const body = await c.req.json<{ userId: string }>();
  
  if (!body.userId) {
    return c.json({ error: "BadRequest", message: "userId required" }, 400);
  }

  try {
    // Update user verification status
    const [updated] = await db
      .update(users)
      .set({ blerdartVerified: true })
      .where(eq(users.id, body.userId))
      .returning();

    if (!updated) {
      return c.json({ error: "NotFound", message: "User not found" }, 404);
    }

    return c.json({
      success: true,
      message: `${updated.displayName} verified as BlerdArt creator`,
      user: {
        id: updated.id,
        username: updated.username,
        blerdartVerified: updated.blerdartVerified,
      },
    });
  } catch (err) {
    console.error("POST /admin/verify-creator error:", err);
    return c.json(
      { error: "InternalError", message: "Failed to verify creator" },
      500
    );
  }
});

/**
 * DELETE /admin/verify-creator/:userId
 * Admin endpoint to revoke BlerdArt verification.
 */
adminRouter.delete("/verify-creator/:userId", requireAdmin(), async (c) => {
  const db = createDb(c.env);
  
  const userId = c.req.param("userId");

  try {
    const [updated] = await db
      .update(users)
      .set({ blerdartVerified: false })
      .where(eq(users.id, userId))
      .returning();

    if (!updated) {
      return c.json({ error: "NotFound", message: "User not found" }, 404);
    }

    return c.json({
      success: true,
      message: `${updated.displayName} verification revoked`,
    });
  } catch (err) {
    console.error("DELETE /admin/verify-creator error:", err);
    return c.json(
      { error: "InternalError", message: "Failed to revoke verification" },
      500
    );
  }
});

export default adminRouter;
