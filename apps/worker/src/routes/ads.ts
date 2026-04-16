import { Hono } from "hono";
import { eq, desc, sql, and, gte } from "drizzle-orm";
import type { Env } from "../types";
import { createDb } from "../lib/db";
import { createLogger } from "../lib/logger";
import { persistWithRetry } from "../lib/retry";
import { requireSession } from "../middleware/session";
import { adEvents, videos, earnings } from "@nichestream/db";

/** All valid VAST 4.0 ad event types tracked by NicheStream. */
const AD_EVENT_TYPES = [
  "impression",
  "start",
  "firstQuartile",
  "midpoint",
  "thirdQuartile",
  "complete",
  "click",
] as const;

type AdEventType = (typeof AD_EVENT_TYPES)[number];

const VALID_AD_EVENT_TYPES = new Set<string>(AD_EVENT_TYPES);

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
      workerBaseUrl: c.env.APP_BASE_URL,
      clickThroughUrl: c.env.AD_CLICK_THROUGH_URL ?? c.env.APP_BASE_URL,
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
 * Shared ad event tracking logic (used by both GET and POST handlers).
 * VAST 4.0 tracking pixels fire GET requests; IMA SDK integration uses POST.
 */
async function handleAdTrack(
  videoId: string,
  eventType: string,
  timestamp: string | undefined,
  c: Parameters<typeof createLogger>[0],
): Promise<Response> {
  const logger = createLogger(c, { operation: "ads_track" });

  if (!videoId || !eventType || !VALID_AD_EVENT_TYPES.has(eventType)) {
    logger.warn("track_missing_fields", { videoId, eventType });
    return Response.json({ error: "videoId and valid eventType required" }, { status: 400 });
  }

  const validatedEventType = eventType as AdEventType;
  const db = createDb(c.env);

  const [video] = await db
    .select({ creatorId: videos.creatorId })
    .from(videos)
    .where(eq(videos.id, videoId))
    .limit(1);

  if (!video) {
    logger.warn("track_video_not_found", { videoId });
    return Response.json({ error: "Video not found" }, { status: 404 });
  }

  const estimatedCpm = 500; // $5 per 1000 impressions
  const estimatedRevenueCents = Math.round(estimatedCpm / 1000);
  const billableEvents = new Set<AdEventType>(["impression", "firstQuartile", "complete"]);
  const isBillable = billableEvents.has(validatedEventType);

  persistWithRetry(
    async () => {
      const isImpression = validatedEventType === "impression" ? 1 : 0;
      const isClick = validatedEventType === "click" ? 1 : 0;
      const revenueCents = isBillable ? String(estimatedRevenueCents) : "0";

      await db.insert(adEvents).values({
        videoId,
        creatorId: video.creatorId,
        eventType: validatedEventType,
        impressions: isImpression,
        clicks: isClick,
        revenue: revenueCents,
        createdAt: timestamp ? new Date(timestamp) : new Date(),
      });

      if (validatedEventType === "impression" && isBillable) {
        await db.insert(earnings).values({
          creatorId: video.creatorId,
          videoId,
          type: "ad_impression",
          grossAmountCents: estimatedRevenueCents,
          platformFeeCents: Math.round(estimatedRevenueCents * 0.3),
          netAmountCents: Math.round(estimatedRevenueCents * 0.7),
          status: "pending",
        });
      }
    },
    `ad_event_${videoId}_${eventType}`,
  );

  logger.info("ad_event_tracked", { videoId, eventType, billable: isBillable });
  return Response.json({ recorded: true });
}

/**
 * POST /api/ads/track
 *
 * Track ad events from IMA SDK integration (JSON body).
 * Requires authentication to prevent earnings fraud.
 */
router.post("/track", requireSession(), async (c) => {
  try {
    const body = await c.req.json<{
      videoId: string;
      eventType: string;
      timestamp?: string;
    }>();
    return handleAdTrack(body.videoId, body.eventType, body.timestamp, c);
  } catch (err) {
    const logger = createLogger(c, { operation: "ads_track" });
    logger.error("track_error", { error: String(err) });
    return c.json({ error: "Failed to track ad event" }, 500);
  }
});

/**
 * GET /api/ads/track
 *
 * Track ad events fired by VAST 4.0 tracking pixels (GET requests from IMA SDK/browser).
 * Requires authentication to prevent earnings fraud.
 */
router.get("/track", requireSession(), async (c) => {
  try {
    const videoId = c.req.query("videoId") ?? "";
    const eventType = c.req.query("type") ?? "";
    const timestamp = c.req.query("timestamp");
    return handleAdTrack(videoId, eventType, timestamp, c);
  } catch (err) {
    const logger = createLogger(c, { operation: "ads_track" });
    logger.error("track_error", { error: String(err) });
    return c.json({ error: "Failed to track ad event" }, 500);
  }
});

/**
 * GET /api/ads/ad-tag
 *
 * Returns a redirect to the configured ad video asset.
 * Configured via AD_VIDEO_URL environment variable.
 */
router.get("/ad-tag", async (c) => {
  const adVideoUrl = c.env.AD_VIDEO_URL;
  if (!adVideoUrl) {
    // generateEmptyVast is a hoisted function declaration — available throughout the module.
    return c.text(generateEmptyVast(), 200, { "Content-Type": "application/xml" });
  }
  return c.redirect(adVideoUrl, 302);
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
  workerBaseUrl: string;
  clickThroughUrl: string;
}): string {
  const trackingBaseUrl = `${options.workerBaseUrl}/api/ads/track`;

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
                <![CDATA[${options.clickThroughUrl}]]>
              </ClickThrough>
            </VideoClicks>
            <MediaFiles>
              <MediaFile id="1" delivery="progressive" type="video/mp4" width="640" height="360">
                <![CDATA[${options.adTagUrl}]]>
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
router.get("/metrics/:creatorId", requireSession(), async (c) => {
  const logger = createLogger(c, { operation: "ads_metrics" });
  const { creatorId } = c.req.param();
  const period = c.req.query("period") || "month";

  // Only the creator themselves (or an admin) can view their metrics.
  // requireSession() has already set "user" on the context via c.set().
  const requestingUser = c.get("user") as { id: string; role?: string } | undefined;
  if (!requestingUser || (requestingUser.id !== creatorId && requestingUser.role !== "admin")) {
    return c.json({ error: "Forbidden", message: "Access denied" }, 403);
  }

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
        totalImpressions: sql<number>`SUM(COALESCE(${adEvents.impressions}, 0))`,
        totalRevenue: sql<number>`SUM(COALESCE(${adEvents.revenue}::numeric, 0))`,
      })
      .from(adEvents)
      .where(and(eq(adEvents.creatorId, creatorId), gte(adEvents.createdAt, startDate)));

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
        impressions: sql<number>`SUM(COALESCE(${adEvents.impressions}, 0))`,
        revenue: sql<number>`SUM(COALESCE(${adEvents.revenue}::numeric, 0))`,
      })
      .from(adEvents)
      .where(and(eq(adEvents.creatorId, creatorId), gte(adEvents.createdAt, startDate)))
      .groupBy(adEvents.videoId)
      .orderBy(desc(sql<number>`SUM(COALESCE(${adEvents.revenue}::numeric, 0))`));;

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

export { router as adRoutes };
