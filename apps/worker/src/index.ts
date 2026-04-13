import { Hono } from "hono";
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
import adminRouter from "./routes/admin";
import eventsRouter from "./routes/events";
import assetsRouter from "./routes/assets";
import { VideoRoom } from "./durable-objects/VideoRoom";
import { UserPresence } from "./durable-objects/UserPresence";
import { createDb } from "./lib/db";
import { createAuth } from "./lib/auth";
import { getVideoAnalytics } from "./lib/stream";
import { videos, earnings } from "@nichestream/db";
import { subscriptions } from "@nichestream/db";
import { eq, desc, and, gte, count } from "drizzle-orm";

// Re-export Durable Object classes so Wrangler can bind them
export { VideoRoom, UserPresence };

const app = new Hono<{ Bindings: Env }>();

// ─── Global Middleware ────────────────────────────────────────────────────────

app.use("*", logger());
app.use("*", secureHeaders());

// CORS: explicit allowlist enforced per-request via env.APP_BASE_URL
app.use("/api/*", async (c, next) => {
  const origin = c.req.header("origin");
  const appBase = c.env.APP_BASE_URL ?? "http://localhost:3000";
  const allowed = new Set([appBase, "http://localhost:3000", "http://localhost:3001"]);

  if (origin) {
    if (!allowed.has(origin)) {
      if (c.req.method === "OPTIONS") {
        return new Response(null, { status: 204 });
      }
      return c.json({ error: "Forbidden", message: "Origin not allowed" }, 403);
    }
    c.header("Access-Control-Allow-Origin", origin);
    c.header("Access-Control-Allow-Credentials", "true");
    c.header("Access-Control-Allow-Methods", "GET, POST, PATCH, DELETE, OPTIONS");
    c.header("Access-Control-Allow-Headers", "Content-Type, Authorization, stripe-signature");
    c.header("Access-Control-Max-Age", "86400");

    if (c.req.method === "OPTIONS") {
      return new Response(null, { status: 204 });
    }
  }

  return next();
});

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
// ─── Admin Routes ─────────────────────────────────────────────────────────────

app.route("/api/admin", adminRouter);

// ─── Events Routes ────────────────────────────────────────────────────────────

app.route("/api/events", eventsRouter);

// ─── Assets Routes ────────────────────────────────────────────────────────────

app.route("/api/assets", assetsRouter);
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
 * 
 * NOTE: Currently fires up to 10 concurrent HTTP calls to Cloudflare Stream API.
 * Future optimization: batch requests or implement polling/caching strategy.
 * Not a blocking issue for single creator, but consider throttling for high-volume use.
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

    // Count active subscribers for this creator
    const [subCountRow] = await db
      .select({ value: count() })
      .from(subscriptions)
      .where(
        and(
          eq(subscriptions.creatorId, session.user.id),
          eq(subscriptions.status, "active"),
        ),
      );

    return c.json({
      totalViews: recentVideos.reduce((sum, v) => sum + v.views, 0),
      totalWatchTimeMinutes: recentVideos.reduce((sum, v) => sum + v.watchTimeMinutes, 0),
      subscriberCount: subCountRow?.value ?? 0,
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
