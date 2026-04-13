# Phase 3: Ad-Supported Monetization Implementation Plan

> **Status:** Planning | **Target:** April-May 2026 | **Estimated effort:** 4-6 weeks full-time

---

## Overview

Phase 3 introduces a VAST-based ad tier to monetize the free-tier user base while preserving creator payouts through transparent ad revenue attribution. This document breaks down the work into four sequential milestones.

**Success Criteria:**
- Free users see 1 ad per 10-minute window (non-intrusive)
- Ad revenue tracked per creator in Neon
- Monthly earnings report includes ad revenue breakdown
- Creator dashboard displays ad impressions + estimated revenue
- No impact on Citizen tier experience (ad-free)

---

## Data Model: Ad Events

### Schema Changes

**New table:**

```sql
CREATE TABLE ad_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  video_id UUID NOT NULL REFERENCES videos(id) ON DELETE CASCADE,
  creator_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  ad_network TEXT NOT NULL, -- 'google_ima', 'custom_vast', 'placeholder' for MVP
  estimated_revenue_cents INT DEFAULT 0, -- CPM-based calculation
  impression_at TIMESTAMP WITH TIMEZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIMEZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIMEZONE DEFAULT NOW()
);

CREATE INDEX idx_ad_events_creator_at ON ad_events(creator_id, impression_at DESC);
CREATE INDEX idx_ad_events_video_at ON ad_events(video_id, impression_at DESC);
CREATE INDEX idx_ad_events_impression_at ON ad_events(impression_at DESC);
```

**Earnings table update:**

```sql
ALTER TABLE earnings 
ADD COLUMN ad_event_id UUID REFERENCES ad_events(id),
ADD COLUMN IF NOT EXISTS source TEXT DEFAULT 'stripe'; -- 'stripe' | 'platform_ad'
```

**User table update (Phase 3c):**

```sql
ALTER TABLE users 
ADD COLUMN last_ad_served_at TIMESTAMP WITH TIMEZONE,
ADD COLUMN ad_frequency_limit_ms INT DEFAULT 600000; -- 10 minutes
```

### Migration file: `packages/db/src/migrations/0003_phase3_ad_events.sql`

```sql
-- Phase 3: Ad Events & Monetization

CREATE TABLE IF NOT EXISTS ad_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  video_id UUID NOT NULL REFERENCES videos(id) ON DELETE CASCADE,
  creator_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  ad_network TEXT NOT NULL DEFAULT 'placeholder',
  estimated_revenue_cents INT DEFAULT 0,
  impression_at TIMESTAMP WITH TIMEZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIMEZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIMEZONE DEFAULT NOW()
);

CREATE INDEX idx_ad_events_creator_at ON ad_events(creator_id, impression_at DESC);
CREATE INDEX idx_ad_events_video_at ON ad_events(video_id, impression_at DESC);
CREATE INDEX idx_ad_events_impression_at ON ad_events(impression_at DESC);

ALTER TABLE earnings 
ADD COLUMN IF NOT EXISTS ad_event_id UUID REFERENCES ad_events(id),
ADD COLUMN IF NOT EXISTS source TEXT DEFAULT 'stripe';

ALTER TABLE users 
ADD COLUMN IF NOT EXISTS last_ad_served_at TIMESTAMP WITH TIMEZONE,
ADD COLUMN IF NOT EXISTS ad_frequency_limit_ms INT DEFAULT 600000;
```

---

## Milestone 3a: MVP Ad Event Logging (Week 1-2)

### Goal
Get ad impressions logged to the database from the frontend. Create a non-blocking asynchronous logging pipeline.

### Work Items

#### 1. Update Drizzle Schema
**File:** `packages/db/src/schema/ads.ts` (NEW)

```typescript
import { index, pgTable, text, timestamp, uuid, integer } from "drizzle-orm/pg-core";

export const adEvents = pgTable(
  "ad_events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    videoId: uuid("video_id").notNull(),
    creatorId: uuid("creator_id").notNull(),
    adNetwork: text("ad_network").notNull().default("placeholder"),
    estimatedRevenueCents: integer("estimated_revenue_cents").default(0),
    impressionAt: timestamp("impression_at", { withTimezone: true }).defaultNow(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    creatorAtIdx: index("idx_ad_events_creator_at").on(table.creatorId, table.impressionAt),
    videoAtIdx: index("idx_ad_events_video_at").on(table.videoId, table.impressionAt),
    impressionAtIdx: index("idx_ad_events_impression_at").on(table.impressionAt),
  })
);

export type AdEvent = typeof adEvents.$inferSelect;
```

#### 2. Export from Schema Index
**File:** `packages/db/src/schema/index.ts`

```typescript
export * from "./ads";
```

#### 3. Run Migration
```bash
pnpm db:generate
DATABASE_URL="..." pnpm db:migrate
```

#### 4. Create Worker Endpoint
**File:** `apps/worker/src/routes/ads.ts` (NEW)

```typescript
import { Hono } from "hono";
import type { Env } from "../types";
import { createDb } from "../lib/db";

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
 *   estimatedRevenueCents: number,
 * }
 */
router.post("/log-event", async (c) => {
  const db = createDb(c.env);
  const body = await c.req.json<{
    videoId: string;
    creatorId: string;
    adNetwork: string;
    estimatedRevenueCents?: number;
  }>();

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
});

export default router;
```

#### 5. Wire into Worker Index
**File:** `apps/worker/src/index.ts`

```typescript
import adsRouter from "./routes/ads";

app.route("/api/ads", adsRouter);
```

#### 6. Frontend: Send Ad Impression
**File:** `apps/web/src/lib/api.ts`

```typescript
export async function logAdImpression(
  videoId: string,
  creatorId: string,
  adNetwork: string = "placeholder",
  estimatedRevenueCents: number = 0
) {
  return fetch("/api/ads/log-event", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      videoId,
      creatorId,
      adNetwork,
      estimatedRevenueCents,
    }),
  }).catch((err) => console.error("Ad logging failed:", err));
}
```

#### 7. VideoPlayer Integration
**File:** `apps/web/src/components/VideoPlayer.tsx`

Add logging on render if `showAds === true`:

```typescript
import { logAdImpression } from "@/lib/api";

export function VideoPlayer({
  video,
  showAds,
  ...props
}: VideoPlayerProps) {
  useEffect(() => {
    if (showAds && video) {
      // Log impression after a short delay to ensure component stability
      const timer = setTimeout(() => {
        logAdImpression(video.id, video.creatorId);
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [showAds, video?.id, video?.creatorId]);

  return (
    // ... existing iframe + props
  );
}
```

#### 8. Tests
- [ ] Unit: `adEvents` table inserts correctly
- [ ] Integration: `POST /api/ads/log-event` saves to DB
- [ ] E2E: VideoPlayer with `showAds=true` fires ad impression after 1s

### Deliverables
- `ad_events` table in Neon (indexed on creator_id, video_id, impression_at)
- `/api/ads/log-event` endpoint (fire-and-forget, non-blocking)
- VideoPlayer calls `logAdImpression` when `showAds === true`
- All ad impressions persisted to database

---

## Milestone 3b: Creator Earnings Attribution (Week 3)

### Goal
Link ad impressions to creator earnings. Monthly job calculates ad revenue per creator.

### Work Items

#### 1. Create Ad Revenue Attribution SQL

**File:** `packages/db/sql/monthly-ad-revenue-attribution.sql`

```sql
-- Phase 3b: Monthly ad revenue attribution by engagement weight
-- Run on first day of each month (or ad-hoc) via Worker scheduled action

WITH monthly_ads AS (
  SELECT 
    creator_id,
    COUNT(*) as total_impressions,
    SUM(estimated_revenue_cents) as total_ad_revenue_cents,
    DATE_TRUNC('month', impression_at) as month
  FROM ad_events
  WHERE impression_at >= DATE_TRUNC('month', NOW() - INTERVAL '1 month')
    AND impression_at < DATE_TRUNC('month', NOW())
  GROUP BY creator_id, DATE_TRUNC('month', impression_at)
),
creator_engagement AS (
  SELECT 
    creator_id,
    SUM(CASE WHEN type = 'subscription' THEN 1 ELSE 0 END) as sub_count,
    SUM(CASE WHEN type = 'platform_ad' THEN 1 ELSE 0 END) as ad_count,
    SUM(COALESCE(net_amount_cents, 0)) as total_net_cents
  FROM earnings
  WHERE created_at >= DATE_TRUNC('month', NOW() - INTERVAL '1 month')
    AND created_at < DATE_TRUNC('month', NOW())
  GROUP BY creator_id
)
INSERT INTO earnings (
  creator_id,
  video_id,
  gross_amount_cents,
  platform_fee_cents,
  net_amount_cents,
  type,
  source,
  ad_event_id,
  currency,
  created_at
)
SELECT 
  ma.creator_id,
  NULL as video_id, -- aggregate, not video-specific
  ma.total_ad_revenue_cents as gross,
  (ma.total_ad_revenue_cents * 0.20)::INT as platform_fee, -- 20% platform fee
  (ma.total_ad_revenue_cents * 0.80)::INT as net,
  'platform_ad' as type,
  'ad_network' as source,
  NULL as ad_event_id, -- aggregated, not tied to single event
  'usd' as currency,
  NOW() as created_at
FROM monthly_ads ma
WHERE ma.total_ad_revenue_cents > 0
  AND NOT EXISTS (
    -- Idempotency: check if already recorded for this month/creator
    SELECT 1 FROM earnings
    WHERE creator_id = ma.creator_id
      AND type = 'platform_ad'
      AND source = 'ad_network'
      AND created_at >= ma.month
      AND created_at < ma.month + INTERVAL '1 month'
  );
```

#### 2. Create Worker Endpoint for Attribution Job

**File:** `apps/worker/src/routes/admin.ts` (extend or create)

```typescript
router.post("/admin/run-ad-attribution", async (c) => {
  // Verify admin token
  const session = await createAuth(db, c.env).api.getSession(request);
  if (!session?.user || session.user.role !== "admin") {
    return c.json({ error: "Unauthorized" }, 403);
  }

  const db = createDb(c.env);
  
  try {
    const result = await db.execute(sql`
      -- Insert monthly ad revenue for all creators
      WITH monthly_ads AS (
        SELECT 
          creator_id,
          COUNT(*) as total_impressions,
          SUM(estimated_revenue_cents) as total_ad_revenue_cents
        FROM ad_events
        WHERE impression_at >= DATE_TRUNC('month', NOW() - INTERVAL '1 month')
          AND impression_at < DATE_TRUNC('month', NOW())
        GROUP BY creator_id
      )
      INSERT INTO earnings (creator_id, gross_amount_cents, platform_fee_cents, net_amount_cents, type, source)
      SELECT 
        creator_id,
        total_ad_revenue_cents,
        (total_ad_revenue_cents * 0.20)::INT,
        (total_ad_revenue_cents * 0.80)::INT,
        'platform_ad',
        'ad_network'
      FROM monthly_ads
      WHERE total_ad_revenue_cents > 0
      ON CONFLICT DO NOTHING
    `);

    return c.json({ 
      success: true, 
      message: "Ad revenue attributed for current month",
      rowsInserted: result.rows.length 
    });
  } catch (err) {
    console.error("Ad attribution failed:", err);
    return c.json({ error: "Attribution job failed" }, 500);
  }
});
```

#### 3. Add to Dashboard Earnings Endpoint
**File:** `apps/worker/src/index.ts`

Extend `GET /api/dashboard/analytics/:creatorId` to include ad revenue breakdown:

```typescript
const earningsBreakdown = await db
  .select({
    type: earnings.type,
    source: earnings.source,
    totalGross: sql<number>`SUM(${earnings.grossAmountCents})`,
    totalNet: sql<number>`SUM(${earnings.netAmountCents})`,
  })
  .from(earnings)
  .where(eq(earnings.creatorId, creatorId))
  .groupBy(earnings.type, earnings.source);

return c.json({
  ...existingAnalytics,
  earningsBreakdown, // grouped by type ('subscription', 'platform_ad') + source
});
```

#### 4. Tests
- [ ] Monthly attribution SQL runs without errors
- [ ] Ad revenue correctly attributed to creators in earnings table
- [ ] Creator dashboard API returns breakdown by source

### Deliverables
- Monthly ad revenue attribution job (SQL + Worker endpoint)
- Dashboard earnings breakdown (subscriptions vs. ads)
- Idempotency check to prevent double-counting

---

## Milestone 3c: Frontend Dashboard Display (Week 4)

### Goal
Display ad impressions, revenue, and frequency capping UI for creators.

### Work Items

#### 1. Creator Dashboard: Ad Metrics Tab

**File:** `apps/web/src/app/dashboard/ad-metrics/page.tsx` (NEW)

```typescript
import { useState, useEffect } from "react";
import { api } from "@/lib/api";

export default function AdMetricsPage() {
  const [metrics, setMetrics] = useState<any>(null);
  const [period, setPeriod] = useState("month");

  useEffect(() => {
    (async () => {
      const data = await api.get(
        `/api/dashboard/ad-metrics?period=${period}`
      );
      setMetrics(data);
    })();
  }, [period]);

  return (
    <div className="p-6">
      <h1 className="text-3xl font-bold mb-6">Ad Revenue</h1>

      <div className="grid grid-cols-3 gap-4 mb-8">
        <div className="bg-slate-100 p-4 rounded">
          <div className="text-sm text-slate-600">Total Ad Impressions</div>
          <div className="text-3xl font-bold">
            {metrics?.totalImpressions?.toLocaleString() || 0}
          </div>
        </div>
        <div className="bg-slate-100 p-4 rounded">
          <div className="text-sm text-slate-600">Ad Revenue</div>
          <div className="text-3xl font-bold">
            ${(metrics?.totalAdRevenue / 100).toFixed(2) || 0}
          </div>
        </div>
        <div className="bg-slate-100 p-4 rounded">
          <div className="text-sm text-slate-600">AVG CPM</div>
          <div className="text-3xl font-bold">
            ${metrics?.avgCpm?.toFixed(2) || 0}
          </div>
        </div>
      </div>

      <div className="border rounded p-4">
        <h2 className="text-xl font-semibold mb-4">Revenue by Video</h2>
        <table className="w-full">
          <thead>
            <tr className="border-b">
              <th className="text-left py-2">Video</th>
              <th className="text-right">Impressions</th>
              <th className="text-right">Revenue</th>
            </tr>
          </thead>
          <tbody>
            {metrics?.byVideo?.map((row: any) => (
              <tr key={row.videoId} className="border-b hover:bg-slate-50">
                <td className="py-2">{row.videoTitle}</td>
                <td className="text-right">{row.impressions}</td>
                <td className="text-right">
                  ${(row.revenue / 100).toFixed(2)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
```

#### 2. Extend Dashboard Analytics Endpoint

**File:** `apps/worker/src/index.ts`

Add `GET /api/dashboard/ad-metrics`:

```typescript
router.get("/dashboard/ad-metrics", async (c) => {
  const creatorId = c.req.query("creatorId");
  const period = c.req.query("period") || "month";
  const db = createDb(c.env);

  const timeFilter = period === "month"
    ? sql`impression_at >= DATE_TRUNC('month', NOW())`
    : sql`impression_at >= DATE_TRUNC('year', NOW())`;

  const byVideo = await db
    .select({
      videoId: adEvents.videoId,
      videoTitle: videos.title,
      impressions: sql<number>`COUNT(*)`,
      revenue: sql<number>`SUM(${adEvents.estimatedRevenueCents})`,
    })
    .from(adEvents)
    .leftJoin(videos, eq(adEvents.videoId, videos.id))
    .where(and(eq(adEvents.creatorId, creatorId), timeFilter))
    .groupBy(adEvents.videoId, videos.title);

  const totals = await db
    .select({
      impressions: sql<number>`COUNT(*)`,
      revenue: sql<number>`SUM(${adEvents.estimatedRevenueCents})`,
    })
    .from(adEvents)
    .where(and(eq(adEvents.creatorId, creatorId), timeFilter));

  const avgCpm = totals[0].impressions > 0
    ? (totals[0].revenue / (totals[0].impressions / 1000))
    : 0;

  return c.json({
    totalImpressions: totals[0].impressions,
    totalAdRevenue: totals[0].revenue,
    avgCpm,
    byVideo,
  });
});
```

#### 3. Frequency Capping UI

**File:** `apps/web/src/components/VideoPlayer.tsx` (update)

Show countdown timer when user hits ad frequency limit:

```typescript
const [lastAdServedAt, setLastAdServedAt] = useState<Date | null>(null);
const [adCooldownSeconds, setAdCooldownSeconds] = useState(0);

useEffect(() => {
  if (!lastAdServedAt) return;
  
  const remaining = Math.max(
    0,
    600 - Math.floor((Date.now() - lastAdServedAt.getTime()) / 1000)
  );
  
  if (remaining > 0) {
    setAdCooldownSeconds(remaining);
    const timer = setInterval(
      () => setAdCooldownSeconds((s) => Math.max(0, s - 1)),
      1000
    );
    return () => clearInterval(timer);
  }
}, [lastAdServedAt]);

return (
  <>
    {adCooldownSeconds > 0 && (
      <div className="bg-yellow-100 p-3 text-sm text-yellow-800">
        Next ad available in {adCooldownSeconds}s
      </div>
    )}
    {/* ... rest of player */}
  </>
);
```

#### 4. Tests
- [ ] Dashboard ad metrics page displays correctly
- [ ] Frequency capping UI shows countdown
- [ ] Ad revenue attributed per video

### Deliverables
- Creator dashboard ad metrics tab
- Video-level ad revenue breakdown
- Frequency capping countdown UI

---

## Milestone 3d: Ad Network Integration (Week 5)

### Goal
Replace placeholder ads with real VAST/IMA implementation.

### Work Items

#### 1. Google IMA SDK Integration

Add to `apps/web/next.config.ts`:

```typescript
/** @type {import('next').NextConfig} */
const nextConfig = {
  // ... existing config
  headers: () => [
    {
      source: "/watch/:videoId",
      headers: [
        {
          key: "Content-Security-Policy",
          value: "script-src 'self' 'unsafe-inline' imasdk.googleapis.com;",
        },
      ],
    },
  ],
};
```

#### 2. Wrapper Component for IMA

**File:** `apps/web/src/components/IMAPlayerWrapper.tsx` (NEW)

```typescript
import { useEffect, useRef } from "react";

export function IMAPlayerWrapper({
  videoUrl,
  adTagUrl,
  onAdLoad,
  onAdStart,
  onAdEnd,
}: {
  videoUrl: string;
  adTagUrl: string;
  onAdLoad: () => void;
  onAdStart: () => void;
  onAdEnd: () => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    // Load Google IMA SDK
    const script = document.createElement("script");
    script.src = "https://imasdk.googleapis.com/js/sdkloader/ima3.js";
    script.async = true;
    script.onload = () => {
      // Initialize IMA
      console.log("IMA SDK loaded");
      // TODO: Set up IMA ad loader and player wrapper
    };
    document.head.appendChild(script);

    return () => {
      document.head.removeChild(script);
    };
  }, []);

  return <div ref={containerRef} className="w-full h-full" />;
}
```

#### 3. Video Player Update

**File:** `apps/web/src/components/VideoPlayer.tsx`

```typescript
import { IMAPlayerWrapper } from "./IMAPlayerWrapper";

export function VideoPlayer({ video, showAds }: VideoPlayerProps) {
  const adTagUrl = showAds
    ? `https://ad-network.example.com/vast?videoId=${video.id}&creatorId=${video.creatorId}`
    : null;

  return showAds && adTagUrl ? (
    <IMAPlayerWrapper
      videoUrl={video.playbackUrl}
      adTagUrl={adTagUrl}
      onAdLoad={() => console.log("Ad loaded")}
      onAdStart={() => logAdImpression(video.id, video.creatorId, "google_ima")}
      onAdEnd={() => console.log("Ad ended")}
    />
  ) : (
    <iframe src={video.playbackUrl} {...props} />
  );
}
```

#### 4. Ad Network Partner Setup
- [ ] Request VAST tag from ad partner (Google IMA, Pub-Matic, etc.)
- [ ] Negotiate CPM rate ($2-5 for niche audiences)
- [ ] Configure ad frequency capping (1 ad per 10 min, 3 max per session)
- [ ] Set up ad revenue reporting webhook

#### 5. Tests
- [ ] IMA SDK loads successfully
- [ ] Ad tag fires via VAST protocol
- [ ] Revenue attribution matches ad partner reporting

### Deliverables
- Google IMA SDK integration
- VAST tag URL configuration
- Ad partner integration complete

---

## Rollout & Launch

### Pre-launch Validation

- [ ] All database indexes created
- [ ] Migration runs cleanly in staging
- [ ] Ad logging non-blocking (latency <10ms)
- [ ] Ad attribution job runs monthly without errors
- [ ] Creator earnings dashboard accurate
- [ ] E2E tests passing (all tiers)
- [ ] Ad frequency capping works (no more than N ads per user)

### Launch Phases

**Phase 3 Alpha (Internal):**
- Admins & team members only
- All free-tier users shown ads
- Validate metrics accuracy
- Monitor ad revenue CPM
- 1 week

**Phase 3 Beta (Gradual Rollout):**
- 25% of free users → ads
- Monitor CPM, fill rate, user retention
- Adjust ad frequency based on churn signals
- Partner with ad network for optimization
- Iterate CPM negotiation
- 2 weeks

**Phase 3 GA (General Availability):**
- All free users → ads
- Full dashboard visibility
- Creator payouts include ad revenue
- 1 week

### Post-Launch Monitoring

| Metric | Target | Alert Threshold |
|---|---|---|
| Ad fill rate | 80%+ | < 60% |
| Average CPM | $2-3 | < $1 |
| Free-to-Citizen conversion | > 2% | < 0.5% |
| Creator satisfaction | > 4/5 | < 3/5 |
| Churn (free tier) | < 5%/month | > 10% |

---

## Success Metrics (4 weeks post-launch)

| Metric | Target |
|---|---|
| Total ad impressions | 100k+ |
| Average CPM | $2.50 |
| Creator ad revenue | $1,500+ portfolio-wide |
| Citizen conversion (from free viewing ad) | 3%+ |
| Platform ad revenue | $400+ (after creator split) |
| Content creator satisfaction | 4.2/5 |

---

## Risk Mitigation

| Risk | Mitigation |
|---|---|
| Ad frequency too high → churn | Start with 1 per 10 min; monitor cohort retention weekly |
| Ugly ads degrade brand | Partner with high-quality networks only; avoid auto-play audio |
| CPM too low ($< 0.50) | Niche audience targeting; consider exclusive sponsor deals |
| Privacy issues | Use Cloudflare tracking (privacy-first); no third-party cookies unless opted-in |
| Creator backlash | Communicate in advance; provide dashboard transparency; 50% higher share for first 30 days |

---

## Next Steps

1. **This week:** Get approval on Phase 3 scope and timeline
2. **Parallel:** Start Milestone 3a (schema + logging endpoint)
3. **Week 2:** Complete Milestone 3b (earnings attribution)
4. **Week 3:** Complete Milestone 3c (dashboard display)
5. **Week 4:** Integrate real ad network (Milestone 3d)
6. **Week 5:** Launch internally and iterate
