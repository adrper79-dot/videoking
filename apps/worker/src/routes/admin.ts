import { Hono } from "hono";
import { eq, ilike, or, desc, and } from "drizzle-orm";
import type { Env } from "../types";
import { createDb } from "../lib/db";
import { requireAdmin } from "../middleware/admin";
import { users } from "@nichestream/db";

const adminRouter = new Hono<{ Bindings: Env }>();

/**
 * GET /admin/creators
 * List all users with role=creator, with optional search by username/displayName.
 * Supports pagination via page + pageSize query params.
 */
adminRouter.get("/creators", requireAdmin(), async (c) => {
  const db = createDb(c.env);
  const rawQ = (c.req.query("q") ?? "").trim().slice(0, 200);
  const page = Math.max(1, parseInt(c.req.query("page") ?? "1", 10) || 1);
  const pageSize = Math.min(100, Math.max(1, parseInt(c.req.query("pageSize") ?? "50", 10) || 50));
  const offset = (page - 1) * pageSize;

  try {
    const whereConditions = [eq(users.role, "creator")];

    if (rawQ) {
      whereConditions.push(
        or(
          ilike(users.username, `%${rawQ}%`),
          ilike(users.displayName, `%${rawQ}%`),
        ) as ReturnType<typeof eq>,
      );
    }

    const results = await db
      .select({
        id: users.id,
        username: users.username,
        displayName: users.displayName,
        avatarUrl: users.avatarUrl,
        blerdartVerified: users.blerdartVerified,
        subscriptionStatus: users.subscriptionStatus,
        createdAt: users.createdAt,
      })
      .from(users)
      .where(and(...whereConditions))
      .orderBy(desc(users.createdAt))
      .limit(pageSize)
      .offset(offset);

    return c.json({ creators: results, page, pageSize });
  } catch (err) {
    console.error("GET /admin/creators error:", err);
    return c.json({ error: "InternalError", message: "Failed to fetch creators" }, 500);
  }
});

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
