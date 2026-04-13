import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import { secureHeaders } from "hono/secure-headers";
import type { Env } from "./types";
import { authRoutes } from "./routes/auth";
import { videoRoutes } from "./routes/videos";
import { channelRoutes } from "./routes/channels";
import { playlistRoutes } from "./routes/playlists";
import { stripeRoutes } from "./routes/stripe";
import { webhookRoutes } from "./routes/webhooks";
import { moderationRoutes } from "./routes/moderation";
import { VideoRoom } from "./durable-objects/VideoRoom";
import { UserPresence } from "./durable-objects/UserPresence";
import { createDb } from "./lib/db";
import { createAuth } from "./lib/auth";
import { getVideoAnalytics } from "./lib/stream";
import { videos, earnings } from "@nichestream/db";
import { eq, desc, and, gte } from "drizzle-orm";

// Re-export Durable Object classes so Wrangler can bind them
export { VideoRoom, UserPresence };

const app = new Hono<{ Bindings: Env }>();

// ─── Global Middleware ────────────────────────────────────────────────────────

app.use("*", logger());
app.use("*", secureHeaders());
app.use(
  "/api/*",
  cors({
    origin: (origin) => origin ?? "*",
    allowMethods: ["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
    allowHeaders: ["Content-Type", "Authorization", "stripe-signature"],
    credentials: true,
    maxAge: 86400,
  }),
);

// ─── Health Check ─────────────────────────────────────────────────────────────

app.get("/health", (c) => c.json({ status: "ok", ts: Date.now() }));

// ─── Auth Routes ──────────────────────────────────────────────────────────────

app.route("/api/auth", authRoutes);

// ─── Video Routes ─────────────────────────────────────────────────────────────

app.route("/api/videos", videoRoutes);

// ─── Channel Routes ───────────────────────────────────────────────────────────

app.route("/api/channels", channelRoutes);

// ─── Playlist Routes ──────────────────────────────────────────────────────────

app.route("/api/playlists", playlistRoutes);

// ─── Stripe Routes ────────────────────────────────────────────────────────────

app.route("/api/stripe", stripeRoutes);

// ─── Webhook Routes ───────────────────────────────────────────────────────────

app.route("/api/webhooks", webhookRoutes);

// ─── Moderation Routes ────────────────────────────────────────────────────────

app.route("/api/moderation", moderationRoutes);

// ─── WebSocket: upgrade to VideoRoom Durable Object ──────────────────────────

/**
 * GET /api/ws/:videoId
 * Upgrades the connection to a WebSocket and forwards it to the
 * VideoRoom Durable Object for the given video ID.
 */
app.get("/api/ws/:videoId", async (c) => {
  const videoId = c.req.param("videoId");

  if (c.req.header("Upgrade")?.toLowerCase() !== "websocket") {
    return c.json({ error: "Expected WebSocket upgrade" }, 426);
  }

  const id = c.env.VIDEO_ROOM.idFromName(videoId);
  const stub = c.env.VIDEO_ROOM.get(id);

  // Forward with search params (userId, username, avatarUrl)
  return stub.fetch(c.req.raw);
});

// ─── Dashboard: earnings summary ──────────────────────────────────────────────

/**
 * GET /api/dashboard/earnings
 * Returns a 30-day earnings summary for the authenticated creator.
 */
app.get("/api/dashboard/earnings", async (c) => {
  const db = createDb(c.env);
  const auth = createAuth(db, c.env);

  const session = await auth.api.getSession({ headers: c.req.raw.headers });
  if (!session?.user) {
    return c.json({ error: "Unauthorized", message: "Authentication required" }, 401);
  }

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

// ─── Dashboard: video analytics ───────────────────────────────────────────────

/**
 * GET /api/dashboard/analytics
 * Returns analytics for the creator's videos using Cloudflare Stream API.
 */
app.get("/api/dashboard/analytics", async (c) => {
  const db = createDb(c.env);
  const auth = createAuth(db, c.env);

  const session = await auth.api.getSession({ headers: c.req.raw.headers });
  if (!session?.user) {
    return c.json({ error: "Unauthorized", message: "Authentication required" }, 401);
  }

  try {
    const creatorVideos = await db
      .select({
        id: videos.id,
        cloudflareStreamId: videos.cloudflareStreamId,
        title: videos.title,
        viewsCount: videos.viewsCount,
      })
      .from(videos)
      .where(eq(videos.creatorId, session.user.id))
      .orderBy(desc(videos.createdAt))
      .limit(10);

    const analyticsPromises = creatorVideos.map(async (v) => {
      try {
        const analytics = await getVideoAnalytics(c.env, v.cloudflareStreamId);
        return { videoId: v.id, title: v.title, ...analytics };
      } catch {
        return { videoId: v.id, title: v.title, views: v.viewsCount, watchTimeMinutes: 0 };
      }
    });

    const recentVideos = await Promise.all(analyticsPromises);

    return c.json({
      totalViews: recentVideos.reduce((sum, v) => sum + v.views, 0),
      totalWatchTimeMinutes: recentVideos.reduce((sum, v) => sum + v.watchTimeMinutes, 0),
      recentVideos,
    });
  } catch (err) {
    console.error("GET /api/dashboard/analytics error:", err);
    return c.json({ error: "InternalError", message: "Failed to fetch analytics" }, 500);
  }
});

// ─── 404 Fallback ─────────────────────────────────────────────────────────────

app.notFound((c) =>
  c.json({ error: "NotFound", message: `Route ${c.req.method} ${c.req.path} not found` }, 404),
);

app.onError((err, c) => {
  console.error("Unhandled error:", err);
  return c.json({ error: "InternalError", message: "An unexpected error occurred" }, 500);
});

export default app;
