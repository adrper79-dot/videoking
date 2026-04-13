import { Hono } from "hono";
import { eq, desc, sql, and, gte } from "drizzle-orm";
import type { Env } from "../types";
import { createDb } from "../lib/db";
import { adEvents, videos } from "@nichestream/db";

const router = new Hono<{ Bindings: Env }>();

/**
 * POST /api/ads/log-event
 * Log a single ad impression. Non-blocking; fires asynchronously.
 *
 * Payload:
 * {
 *   videoId: string,
 *   creatorId: string,
 *   adNetwork: string, // 'google_ima', 'placeholder', etc
 *   estimatedRevenueCents?: number,
 * }
 *
 * Response:
 * { logged: true }
 */
router.post("/log-event", async (c) => {
  const db = createDb(c.env);

  try {
    const body = await c.req.json<{
      videoId: string;
      creatorId: string;
      adNetwork: string;
      estimatedRevenueCents?: number;
    }>();

    // Validate required fields
    if (!body.videoId || !body.creatorId || !body.adNetwork) {
      return c.json(
        { error: "Missing required fields: videoId, creatorId, adNetwork" },
        400
      );
    }

    // Fire and forget: insert without awaiting
    db.insert(adEvents)
      .values({
        videoId: body.videoId,
        creatorId: body.creatorId,
        adNetwork: body.adNetwork,
        estimatedRevenueCents: body.estimatedRevenueCents ?? 0,
      })
      .catch((err) => {
        console.error("Failed to log ad event:", err);
        // Silently fail; don't break user experience for logging
      });

    // Return immediately to not block the request
    return c.json({ logged: true });
  } catch (err) {
    console.error("Error in POST /api/ads/log-event:", err);
    return c.json({ error: "Failed to process ad event" }, 500);
  }
});

/**
 * GET /api/ads/metrics/:creatorId
 * Get ad metrics for a creator (aggregated by time period)
 *
 * Query params:
 * - period: 'day' | 'week' | 'month' | 'all' (default: 'month')
 *
 * Response:
 * {
 *   totalImpressions: number,
 *   totalRevenue: number (cents),
 *   avgCpm: number,
 *   byVideo: Array<{ videoId, videoTitle, impressions, revenue }>
 * }
 */
router.get("/metrics/:creatorId", async (c) => {
  const { creatorId } = c.req.param();
  const period = c.req.query("period") || "month";
  const db = createDb(c.env);

  try {
    // Build time filter based on period
    const now = new Date();
    let startDate = new Date();
    
    if (period === "day") {
      startDate.setDate(now.getDate() - 1);
    } else if (period === "week") {
      startDate.setDate(now.getDate() - 7);
    } else if (period === "month") {
      startDate.setMonth(now.getMonth() - 1);
    } else {
      // 'all' — use very old date
      startDate.setFullYear(2000);
    }

    // Get total metrics
    const totalsResult = await db
      .select({
        totalImpressions: sql<number>`COUNT(*)`,
        totalRevenue: sql<number>`SUM(COALESCE(${adEvents.estimatedRevenueCents}, 0))`,
      })
      .from(adEvents)
      .where(and(eq(adEvents.creatorId, creatorId), gte(adEvents.impressionAt, startDate)));

    const totals = totalsResult[0] || {
      totalImpressions: 0,
      totalRevenue: 0,
    };

    const totalImpressions = Number(totals.totalImpressions) || 0;
    const totalRevenue = Number(totals.totalRevenue) || 0;
    const avgCpm =
      totalImpressions > 0 ? (totalRevenue / (totalImpressions / 1000)) : 0;

    // Get metrics by video
    const byVideoResult = await db
      .select({
        videoId: adEvents.videoId,
        videoTitle: videos.title,
        impressions: sql<number>`COUNT(*)`,
        revenue: sql<number>`SUM(COALESCE(${adEvents.estimatedRevenueCents}, 0))`,
      })
      .from(adEvents)
      .leftJoin(videos, eq(adEvents.videoId, videos.id))
      .where(and(eq(adEvents.creatorId, creatorId), gte(adEvents.impressionAt, startDate)))
      .groupBy(adEvents.videoId, videos.title)
      .orderBy(desc(sql<number>`SUM(COALESCE(${adEvents.estimatedRevenueCents}, 0))`));

    const byVideo = byVideoResult.map((row) => ({
      videoId: row.videoId,
      videoTitle: row.videoTitle || "Unknown",
      impressions: Number(row.impressions),
      revenue: Number(row.revenue),
    }));

    return c.json({
      totalImpressions,
      totalRevenue,
      avgCpm: Math.round(avgCpm * 100) / 100,
      byVideo,
    });
  } catch (err) {
    console.error("Error in GET /api/ads/metrics:", err);
    return c.json({ error: "Failed to fetch ad metrics" }, 500);
  }
});

export default router;
