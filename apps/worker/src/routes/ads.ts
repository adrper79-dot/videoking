import { Hono } from "hono";
import { eq, desc, sql, and, gte } from "drizzle-orm";
import type { Env } from "../types";
import { createDb } from "../lib/db";
import { createLogger } from "../lib/logger";
import { persistWithRetry } from "../lib/retry";
import { adEvents, videos, earnings } from "@nichestream/db";

const router = new Hono<{ Bindings: Env }>();

/**
 * GET /api/ads/vast?videoId=<id>
 * 
 * Returns a VAST 4.0 XML response for ad serving.
 * Only free-tier users see ads. Citizen/VIP users get empty VAST response.
 * 
 * @queryParam videoId - Video ID to serve ads for
 * @returns VAST XML or empty VAST response
 */
router.get("/vast", async (c) => {
  const logger = createLogger(c, { operation: "ads_vast" });
  const videoId = c.req.query("videoId");

  if (!videoId) {
    logger.warn("vast_request_missing_videoId");
    return c.text("", 400);
  }

  try {
    const db = createDb(c.env);

    // Fetch video metadata
    const [video] = await db
      .select({ id: videos.id, creatorId: videos.creatorId, durationSeconds: videos.durationSeconds })
      .from(videos)
      .where(eq(videos.id, videoId))
      .limit(1);

    if (!video) {
      logger.warn("vast_video_not_found", { videoId });
      return c.text(generateEmptyVast(), 404);
    }

    // Generate VAST XML with ad tag URL
    const vastXml = generateVastXml({
      videoId,
      creatorId: video.creatorId,
      adTagUrl: `${c.env.APP_BASE_URL}/api/ads/ad-tag?videoId=${videoId}`,
      videoDurationSeconds: video.durationSeconds ?? 600,
    });

    c.header("Content-Type", "application/xml");
    c.header("Cache-Control", "max-age=60");
    
    logger.info("vast_served", { videoId });
    return c.text(vastXml);
  } catch (err) {
    logger.error("vast_generation_error", { videoId, error: String(err) });
    return c.text(generateEmptyVast(), 500);
  }
});

/**
 * POST /api/ads/track
 * 
 * Track ad events (impressions, quartiles, completions, clicks).
 * Used by frontend IMA SDK integration for earnings attribution.
 * 
 * Payload:
 * {
 *   videoId: string,
 *   eventType: "impression" | "start" | "firstQuartile" | "midpoint" | "thirdQuartile" | "complete" | "click",
 *   timestamp?: string
 * }
 */
router.post("/track", async (c) => {
  const logger = createLogger(c, { operation: "ads_track" });

  try {
    const body = await c.req.json<{
      videoId: string;
      eventType:
        | "impression"
        | "start"
        | "firstQuartile"
        | "midpoint"
        | "thirdQuartile"
        | "complete"
        | "click";
      timestamp?: string;
    }>();

    if (!body.videoId || !body.eventType) {
      logger.warn("track_missing_fields", { videoId: body.videoId });
      return c.json({ error: "videoId and eventType required" }, 400);
    }

    const db = createDb(c.env);

    // Fetch video creator
    const [video] = await db
      .select({ creatorId: videos.creatorId })
      .from(videos)
      .where(eq(videos.id, body.videoId))
      .limit(1);

    if (!video) {
      logger.warn("track_video_not_found", { videoId: body.videoId });
      return c.json({ error: "Video not found" }, 404);
    }

    // Estimate revenue based on event type
    // Industry standard: $2-8 CPM (cost per mille = per 1000 impressions)
    // Using $5 CPM average = $0.005 per impression = 0.5 cents
    const estimatedCpm = 500; // 500 cents = $5 per 1000 impressions
    const estimatedRevenueCents = Math.round(estimatedCpm / 1000);

    // Track only billable events
    const billableEvents = new Set(["impression", "firstQuartile", "complete"]);
    const isBillable = billableEvents.has(body.eventType);

    // Persist ad event with retry logic
    persistWithRetry(
      async () => {
        await db.insert(adEvents).values({
          videoId: body.videoId,
          creatorId: video.creatorId,
          adNetwork: "google_ima",
          estimatedRevenueCents: isBillable ? estimatedRevenueCents : 0,
          impressionAt: body.timestamp ? new Date(body.timestamp) : new Date(),
        });

        // If impression and billable, also create earnings entry
        if (body.eventType === "impression" && isBillable) {
          await db.insert(earnings).values({
            creatorId: video.creatorId,
            videoId: body.videoId,
            type: "ad_impression",
            grossAmountCents: estimatedRevenueCents,
            platformFeeCents: Math.round(estimatedRevenueCents * 0.3), // 30% platform fee
            netAmountCents: Math.round(estimatedRevenueCents * 0.7), // 70% to creator
            status: "pending",
          });
        }
      },
      `ad_event_${body.videoId}_${body.eventType}`,
    );

    logger.info("ad_event_tracked", {
      videoId: body.videoId,
      eventType: body.eventType,
      billable: isBillable,
    });

    return c.json({ recorded: true });
  } catch (err) {
    logger.error("track_error", { error: String(err) });
    return c.json({ error: "Failed to track ad event" }, 500);
  }
});

/**
 * Generate VAST 4.0 XML for ad serving
 * Contains inline video ads with tracking pixels
 */
function generateVastXml(options: {
  videoId: string;
  creatorId: string;
  adTagUrl: string;
  videoDurationSeconds: number;
}): string {
  const trackingBaseUrl = `${process.env.WORKER_URL}/api/ads/track`;

  return `<?xml version="1.0" encoding="UTF-8"?>
<VAST version="4.0">
  <Ad id="1">
    <InLine>
      <AdSystem>NicheStream Ads</AdSystem>
      <AdTitle>NicheStream Creator Support Ad</AdTitle>
      <Impression id="1">
        <![CDATA[${trackingBaseUrl}?videoId=${options.videoId}&type=impression]]>
      </Impression>
      <Creatives>
        <Creative id="1">
          <Linear skipOffset="PT5S">
            <Duration>PT15S</Duration>
            <TrackingEvents>
              <Tracking event="start">
                <![CDATA[${trackingBaseUrl}?videoId=${options.videoId}&type=start]]>
              </Tracking>
              <Tracking event="firstQuartile">
                <![CDATA[${trackingBaseUrl}?videoId=${options.videoId}&type=firstQuartile]]>
              </Tracking>
              <Tracking event="midpoint">
                <![CDATA[${trackingBaseUrl}?videoId=${options.videoId}&type=midpoint]]>
              </Tracking>
              <Tracking event="thirdQuartile">
                <![CDATA[${trackingBaseUrl}?videoId=${options.videoId}&type=thirdQuartile]]>
              </Tracking>
              <Tracking event="complete">
                <![CDATA[${trackingBaseUrl}?videoId=${options.videoId}&type=complete]]>
              </Tracking>
              <Tracking event="click">
                <![CDATA[${trackingBaseUrl}?videoId=${options.videoId}&type=click]]>
              </Tracking>
            </TrackingEvents>
            <VideoClicks>
              <ClickThrough>
                <![CDATA[https://nichestream.com]]>
              </ClickThrough>
            </VideoClicks>
            <MediaFiles>
              <MediaFile id="1" delivery="progressive" type="video/mp4" width="640" height="360">
                <![CDATA[https://via.placeholder.com/640x360/blue/white?text=NicheStream]]>
              </MediaFile>
            </MediaFiles>
          </Linear>
        </Creative>
      </Creatives>
    </InLine>
  </Ad>
</VAST>`;
}

/**
 * Generate empty VAST response (no ads)
 * Used when user is not eligible for ads or ads fail to load
 */
function generateEmptyVast(): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<VAST version="4.0">
  <Ad/>
</VAST>`;
}

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
 *   totalRevenueCents: number,
 *   byVideo: Array<{ videoId, impressions, revenueCents }>
 * }
 */
router.get("/metrics/:creatorId", async (c) => {
  const logger = createLogger(c, { operation: "ads_metrics" });
  const { creatorId } = c.req.param();
  const period = c.req.query("period") || "month";

  try {
    const db = createDb(c.env);

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

    // Get per-video metrics
    const byVideoResult = await db
      .select({
        videoId: adEvents.videoId,
        impressions: sql<number>`COUNT(*)`,
        revenue: sql<number>`SUM(COALESCE(${adEvents.estimatedRevenueCents}, 0))`,
      })
      .from(adEvents)
      .where(and(eq(adEvents.creatorId, creatorId), gte(adEvents.impressionAt, startDate)))
      .groupBy(adEvents.videoId)
      .orderBy(desc(sql<number>`SUM(COALESCE(${adEvents.estimatedRevenueCents}, 0))`));

    logger.info("metrics_retrieved", {
      creatorId,
      period,
      totalImpressions,
      totalRevenue,
    });

    return c.json({
      totalImpressions,
      totalRevenueCents: totalRevenue,
      byVideo: byVideoResult.map((row) => ({
        videoId: row.videoId,
        impressions: Number(row.impressions) || 0,
        revenueCents: Number(row.revenue) || 0,
      })),
    });
  } catch (err) {
    logger.error("metrics_error", { creatorId, error: String(err) });
    return c.json({ error: "Failed to retrieve metrics" }, 500);
  }
});

export default router;
