import { Hono } from "hono";
import { eq, desc, and, gte } from "drizzle-orm";
import type { Env } from "../types";
import { createDb } from "../lib/db";
import { createAuth } from "../lib/auth";
import { moderationReports, users, videos } from "@nichestream/db";

const moderationRouter = new Hono<{ Bindings: Env }>();

/**
 * POST /api/moderation/report
 * Submit a content report for a video or chat message.
 */
moderationRouter.post("/report", async (c) => {
  const db = createDb(c.env);
  const auth = createAuth(db, c.env);

  const session = await auth.api.getSession({ headers: c.req.raw.headers });
  if (!session?.user) {
    return c.json({ error: "Unauthorized", message: "Authentication required" }, 401);
  }

  try {
    const body = await c.req.json<{
      contentType: "video" | "chat_message";
      contentId: string;
      reason: string;
    }>();

    if (!body.contentType || !body.contentId || !body.reason?.trim()) {
      return c.json({ error: "ValidationError", message: "All fields required" }, 400);
    }

    const [report] = await db
      .insert(moderationReports)
      .values({
        reporterId: session.user.id,
        contentType: body.contentType,
        contentId: body.contentId,
        reason: body.reason.trim().slice(0, 1000),
      })
      .returning();

    return c.json(report, 201);
  } catch (err) {
    console.error("POST /api/moderation/report error:", err);
    return c.json({ error: "InternalError", message: "Failed to submit report" }, 500);
  }
});

/**
 * GET /api/moderation/reports
 * Admin-only: List pending moderation reports.
 */
moderationRouter.get("/reports", async (c) => {
  const db = createDb(c.env);
  const auth = createAuth(db, c.env);

  const session = await auth.api.getSession({ headers: c.req.raw.headers });
  if (!session?.user) {
    return c.json({ error: "Unauthorized", message: "Authentication required" }, 401);
  }

  // Check admin role
  const [user] = await db
    .select({ role: users.role })
    .from(users)
    .where(eq(users.id, session.user.id))
    .limit(1);

  if (!user || user.role !== "admin") {
    return c.json({ error: "Forbidden", message: "Admin access required" }, 403);
  }

  try {
    const reports = await db
      .select()
      .from(moderationReports)
      .where(eq(moderationReports.status, "pending"))
      .orderBy(desc(moderationReports.createdAt))
      .limit(50);

    return c.json(reports);
  } catch (err) {
    console.error("GET /api/moderation/reports error:", err);
    return c.json({ error: "InternalError", message: "Failed to fetch reports" }, 500);
  }
});

/**
 * PATCH /api/moderation/reports/:id
 * Admin-only: Resolve or dismiss a report.
 */
moderationRouter.patch("/reports/:id", async (c) => {
  const db = createDb(c.env);
  const auth = createAuth(db, c.env);
  const reportId = c.req.param("id");

  const session = await auth.api.getSession({ headers: c.req.raw.headers });
  if (!session?.user) {
    return c.json({ error: "Unauthorized", message: "Authentication required" }, 401);
  }

  const [user] = await db
    .select({ role: users.role })
    .from(users)
    .where(eq(users.id, session.user.id))
    .limit(1);

  if (!user || user.role !== "admin") {
    return c.json({ error: "Forbidden", message: "Admin access required" }, 403);
  }

  try {
    const body = await c.req.json<{
      status: "resolved" | "dismissed";
      notes?: string;
    }>();

    const [updated] = await db
      .update(moderationReports)
      .set({
        status: body.status,
        notes: body.notes?.trim() ?? null,
        resolvedAt: new Date(),
      })
      .where(eq(moderationReports.id, reportId))
      .returning();

    if (!updated) {
      return c.json({ error: "NotFound", message: "Report not found" }, 404);
    }

    // If resolved on a video, soft-delete it
    if (updated.status === "resolved" && updated.contentType === "video") {
      await db
        .update(videos)
        .set({ status: "deleted" })
        .where(eq(videos.id, updated.contentId));
    }

    return c.json(updated);
  } catch (err) {
    console.error("PATCH /api/moderation/reports/:id error:", err);
    return c.json({ error: "InternalError", message: "Failed to update report" }, 500);
  }
});

/** GET /api/moderation/dashboard/earnings - Creator earnings summary */
moderationRouter.get("/dashboard/earnings", async (c) => {
  const db = createDb(c.env);
  const auth = createAuth(db, c.env);

  const session = await auth.api.getSession({ headers: c.req.raw.headers });
  if (!session?.user) {
    return c.json({ error: "Unauthorized", message: "Authentication required" }, 401);
  }

  const { earnings } = await import("@nichestream/db");

  try {
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

    const allEarnings = await db
      .select()
      .from(earnings)
      .where(
        and(
          eq(earnings.creatorId, session.user.id),
          gte(earnings.createdAt, thirtyDaysAgo),
        ),
      )
      .orderBy(desc(earnings.createdAt));

    const summary = allEarnings.reduce(
      (acc, e) => {
        acc.totalGrossCents += e.grossAmountCents;
        acc.totalNetCents += e.netAmountCents;
        if (e.status === "pending") acc.pendingCents += e.netAmountCents;
        if (e.status === "transferred") acc.transferredCents += e.netAmountCents;
        if (e.type === "subscription_share")
          acc.breakdown.subscriptionShareCents += e.netAmountCents;
        if (e.type === "unlock_purchase")
          acc.breakdown.unlockPurchaseCents += e.netAmountCents;
        if (e.type === "tip") acc.breakdown.tipCents += e.netAmountCents;
        return acc;
      },
      {
        totalGrossCents: 0,
        totalNetCents: 0,
        pendingCents: 0,
        transferredCents: 0,
        breakdown: {
          subscriptionShareCents: 0,
          unlockPurchaseCents: 0,
          tipCents: 0,
        },
      },
    );

    return c.json({ summary, recent: allEarnings.slice(0, 20) });
  } catch (err) {
    console.error("GET /api/dashboard/earnings error:", err);
    return c.json({ error: "InternalError", message: "Failed to fetch earnings" }, 500);
  }
});

export { moderationRouter as moderationRoutes };
