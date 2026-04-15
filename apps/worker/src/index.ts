import { Hono } from "hono";
import { secureHeaders } from "hono/secure-headers";
import type { Env } from "./types";
import { getMissingEnvKeys } from "./types";
import { loggingMiddleware } from "./lib/logger";
import { authRoutes } from "./routes/auth";
import { videoRoutes } from "./routes/videos";
import { channelRoutes } from "./routes/channels";
import { playlistRoutes } from "./routes/playlists";
import { stripeRoutes } from "./routes/stripe";
import { webhookRoutes } from "./routes/webhooks";
import { moderationRoutes } from "./routes/moderation";
import { adminRoutes } from "./routes/admin";
import { eventsRoutes } from "./routes/events";
import { assetsRoutes } from "./routes/assets";
import { adRoutes } from "./routes/ads";
import { referralRoutes } from "./routes/referrals";
import { analyticsRoutes } from "./routes/analytics";
import { notificationRoutes } from "./routes/notifications";
import { emailRoutes } from "./routes/email";
import { searchRoutes } from "./routes/search";
import { VideoRoom } from "./durable-objects/VideoRoom";
import { UserPresence } from "./durable-objects/UserPresence";
import { createDb } from "./lib/db";
import { createAuth } from "./lib/auth";
import { createEmailService } from "./lib/email";
import { getVideoAnalytics } from "./lib/stream";
import { videos, earnings, users } from "@nichestream/db";
import { subscriptions } from "@nichestream/db";
import { eq, desc, and, gte, lte, count, isNotNull } from "drizzle-orm";

// Re-export Durable Object classes so Wrangler can bind them
export { VideoRoom, UserPresence };

const app = new Hono<{ Bindings: Env }>();

// ─── Global Middleware ────────────────────────────────────────────────────────

app.use("*", loggingMiddleware());
app.use("*", secureHeaders());

// Fail fast if required env vars are missing (catches misconfigured deployments)
app.use("*", async (c, next) => {
  const missing = getMissingEnvKeys(c.env);
  if (missing.length > 0) {
    console.error(`[CONFIG] Missing required environment variables: ${missing.join(", ")}`);
    return c.json(
      { error: "ServiceUnavailable", message: "Server is misconfigured. Contact support." },
      503,
    );
  }
  return next();
});

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

app.route("/api/admin", adminRoutes);

// ─── Events Routes ────────────────────────────────────────────────────────

app.route("/api/events", eventsRoutes);

// ─── Assets Routes ────────────────────────────────────────────────────────

app.route("/api/assets", assetsRoutes);
// ─── Ad Routes (Phase 3) ───────────────────────────────────────────────────

app.route("/api/ads", adRoutes);

// ─── Referrals Routes (Phase 4) ────────────────────────────────────────────

app.route("/api/referrals", referralRoutes);

// ─── Analytics Routes (Phase 4) ────────────────────────────────────────────

app.route("/api/admin/analytics", analyticsRoutes);
// ─── Notifications Routes (Phase 4) ────────────────────────────────────────────

app.route("/api/notifications", notificationRoutes);

// ─── Email Routes (Phase 4) ────────────────────────────────────────────────────

app.route("/api/email", emailRoutes);

// ─── Search Routes ────────────────────────────────────────────────────────────

app.route("/api/search", searchRoutes);

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

// ─── Scheduled Cron Handler ───────────────────────────────────────────────────

/**
 * Runs daily at 10:00 UTC (see wrangler.toml [[triggers]]).
 * Sends trial_ending emails to users whose trial expires in 1, 2, or 3 days
 * and who have opted into trial_alerts email notifications.
 */
async function handleScheduled(env: Env): Promise<void> {
  if (!env.ENABLE_EMAIL_NOTIFICATIONS) {
    console.log("[CRON] Email notifications disabled — skipping trial expiry check");
    return;
  }

  const db = createDb(env);
  const emailService = await createEmailService(env);

  const now = new Date();
  const windowStart = new Date(now.getTime() + 1 * 24 * 60 * 60 * 1000); // 1 day from now
  const windowEnd = new Date(now.getTime() + 4 * 24 * 60 * 60 * 1000);   // 4 days from now (exclusive)

  const expiringUsers = await db
    .select({
      id: users.id,
      email: users.email,
      displayName: users.displayName,
      trialEndsAt: users.trialEndsAt,
      emailPreferences: users.emailPreferences,
    })
    .from(users)
    .where(
      and(
        eq(users.subscriptionStatus, "trial"),
        isNotNull(users.trialEndsAt),
        gte(users.trialEndsAt, windowStart),
        lte(users.trialEndsAt, windowEnd),
      ),
    );

  console.log(`[CRON] Found ${expiringUsers.length} users with trials expiring in 1-3 days`);

  for (const user of expiringUsers) {
    if (!user.emailPreferences?.trial_alerts) continue;
    if (!user.trialEndsAt) continue;

    const msRemaining = user.trialEndsAt.getTime() - now.getTime();
    const daysRemaining = Math.ceil(msRemaining / (24 * 60 * 60 * 1000));

    try {
      await emailService.sendTrialEnding(user.email, daysRemaining, user.displayName);
      console.log(`[CRON] Sent trial_ending email to ${user.email} (${daysRemaining} days remaining)`);
    } catch (err) {
      console.error(`[CRON] Failed to send trial email to ${user.email}:`, err);
    }
  }
}

export default {
  fetch: app.fetch,
  async scheduled(_controller: ScheduledController, env: Env, ctx: ExecutionContext): Promise<void> {
    ctx.waitUntil(handleScheduled(env));
  },
};
