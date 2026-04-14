# Phase 3 Implementation Roadmap (4-5 weeks to GA)

**Owner:** Engineering Lead  
**Timeline:** April 15 - May 15, 2026  
**Success Criteria:** All 3 tiers functional, ads monetizing, error recovery solid, monitoring in place

---

## Week 1: Foundation + VIP (8 days)

### 1.1 Async Error Recovery (2 days) — BLOCKER
**Owner:** Backend eng | **PR Target:** weekend

This prevents data loss in rare edge cases.

#### Tasks

**1.1.1 Fix Chat Message Persistence**
- **File:** [apps/worker/src/durable-objects/VideoRoom.ts:277-310](apps/worker/src/durable-objects/VideoRoom.ts#L277-L310)
- **Current Code:**
  ```typescript
  void (async () => {
    try {
      await db.insert(chatMessages).values({ ... });
    } catch (err) {
      console.error("Failed to persist chat:", err);
    }
  })();
  ```
- **Change To:** Add exponential backoff retry
  ```typescript
  async function persistChatWithRetry(msg: StoredChatMessage, maxRetries = 3) {
    for (let i = 0; i < maxRetries; i++) {
      try {
        await db.insert(chatMessages).values({
          id: msg.id,
          videoId: msg.videoId,
          userId: msg.userId,
          content: msg.content,
          type: msg.type,
          isDeleted: msg.isDeleted,
          createdAt: msg.createdAt,
        });
        return;
      } catch (err) {
        console.error(`Chat persist attempt ${i+1}/${maxRetries}:`, err);
        if (i < maxRetries - 1) await new Promise(r => setTimeout(r, 100 * (i + 1)));
      }
    }
    console.error("Chat persistence failed after 3 retries; message lost");
    // TODO: Send to dead letter queue (Durable Objects as queue)
  }
  ```
- **Call Site:** Replace `void (async () => { ... })()` with await or fire-and-forget with retry

**1.1.2 Apply Same Pattern to Polls & Poll Votes**
- **Files:** 
  - Poll create: [VideoRoom.ts:391-402](apps/worker/src/durable-objects/VideoRoom.ts#L391-L402)
  - Poll vote: [VideoRoom.ts:488-502](apps/worker/src/durable-objects/VideoRoom.ts#L488-L502)
- **Change:** Extract to `persistPollWithRetry()` and `persistPollVoteWithRetry()`

**Verification:**
- [ ] Manually test chat message send on laggy network
- [ ] Verify message appears in UI even if DB write fails initially

---

### 1.2 VIP Tier Checkout Routing (1.5 days) — BLOCKER
**Owner:** Backend eng

VIP users need a checkout flow distinct from Citizen.

#### Tasks

**1.2.1 Modify Subscription Endpoint to Support Tier Selection**
- **File:** [apps/worker/src/routes/stripe.ts:143-188](apps/worker/src/routes/stripe.ts#L143-L188)
- **Current Signature:**
  ```typescript
  const body = await c.req.json<{
    creatorId: string;
    plan: "monthly" | "annual";
    priceId: string;
  }>();
  ```
- **New Signature:**
  ```typescript
  const body = await c.req.json<{
    creatorId: string;
    tier: "citizen" | "vip";  // NEW
    plan: "monthly" | "annual";
    priceId: string;
  }>();
  ```
- **Change Validation Logic:**
  ```typescript
  const expectedPriceId =
    body.tier === "vip"
      ? (body.plan === "annual" ? undefined : c.env.STRIPE_VIP_MONTHLY_PRICE)  // TODO: add STRIPE_VIP_ANNUAL_PRICE env var
      : (body.plan === "annual" ? c.env.STRIPE_CITIZEN_ANNUAL_PRICE : c.env.STRIPE_CITIZEN_MONTHLY_PRICE);
  ```
- **Metadata Update:**
  ```typescript
  metadata: {
    subscriberId: session.user.id,
    creatorId: body.creatorId,
    plan: body.plan,
    tier: body.tier,  // NEW
  },
  ```

**1.2.2 Add STRIPE_VIP_ANNUAL_PRICE Env Var**
- **File:** [apps/worker/src/types.ts](apps/worker/src/types.ts)
- **Add:**
  ```typescript
  STRIPE_VIP_ANNUAL_PRICE?: string;
  ```
- **File:** [apps/worker/wrangler.toml](apps/worker/wrangler.toml)
- **Add:**
  ```toml
  STRIPE_VIP_ANNUAL_PRICE = ""
  ```
- **File:** [apps/worker/.dev.vars.example](apps/worker/.dev.vars.example)
- **Add:**
  ```
  STRIPE_VIP_ANNUAL_PRICE=price_xxxx
  ```

**1.2.3 Update Webhook Handler to Recognize VIP Subscriptions**
- **File:** [apps/worker/src/routes/webhooks.ts:171-230](apps/worker/src/routes/webhooks.ts#L171-L230)
- **Current Code:**
  ```typescript
  async function refreshUserMembershipState(...) {
    await syncUserMembershipStatus(db, subscriberId, {
      userTier: "citizen",  // ← hardcoded
      subscriptionStatus: "active",
    });
  }
  ```
- **Change To:**
  ```typescript
  async function refreshUserMembershipState(
    db: ReturnType<typeof createDb>,
    subscriberId: string,
    fallbackStatus: "active" | "canceled" | "past_due",
    tier: "citizen" | "vip" = "citizen",  // NEW
  ): Promise<void> {
    const [activeSubscription] = await db
      .select({ id: subscriptions.id })
      .from(subscriptions)
      .where(
        and(
          eq(subscriptions.subscriberId, subscriberId),
          eq(subscriptions.status, "active"),
        ),
      )
      .limit(1);

    if (activeSubscription) {
      await syncUserMembershipStatus(db, subscriberId, {
        userTier: tier,  // ← use parameter
        subscriptionStatus: "active",
      });
      return;
    }
    // ... rest of function
  }
  ```
- **Call Site Update:**
  ```typescript
  const { subscriberId, creatorId, plan, tier } = sub.metadata ?? {};  // add tier
  // ...
  if (existing) {
    // ... update subscription
  } else {
    // ... insert subscription
  }
  // Pass tier to refresh function
  await refreshUserMembershipState(db, subscriberId, status, (tier as "citizen" | "vip") ?? "citizen");
  ```

**Verification:**
- [ ] Create VIP checkout session with tier="vip"
- [ ] Webhook processes subscription correctly
- [ ] User's userTier becomes "vip" in database
- [ ] User sees VIP badge in chat

---

### 1.3 Structured Logging Foundation (1.5 days)
**Owner:** Backend eng

This enables critical monitoring for Phase 3 launch.

#### Tasks

**1.3.1 Install Logging Library**
```bash
cd apps/worker
pnpm add pino pino-http
```

**1.3.2 Add Logging Middleware**
- **File:** Create [apps/worker/src/middleware/logging.ts](apps/worker/src/middleware/logging.ts) (NEW)
  ```typescript
  import { createMiddleware } from "hono/factory";
  import type { Env } from "../types";
  import crypto from "crypto";

  export const createLoggingMiddleware = createMiddleware<{ Bindings: Env }>(async (c, next) => {
    const requestId = c.req.header("x-request-id") || crypto.randomUUID();
    const start = Date.now();
    
    c.set("requestId", requestId);
    
    await next();
    
    const duration = Date.now() - start;
    console.log(JSON.stringify({
      level: "info",
      requestId,
      method: c.req.method,
      path: c.req.path,
      status: c.res.status,
      durationMs: duration,
      timestamp: new Date().toISOString(),
    }));
  });
  ```

**1.3.3 Integrate Into App**
- **File:** [apps/worker/src/index.ts](apps/worker/src/index.ts)
- **Add After Line 30:**
  ```typescript
  app.use("*", createLoggingMiddleware());
  ```

**1.3.4 Add Error Logging to Critical Routes**
- **File:** [apps/worker/src/routes/webhooks.ts](apps/worker/src/routes/webhooks.ts)
- **Add at Error Points:**
  ```typescript
  catch (err) {
    const requestId = c.get("requestId");
    console.error(JSON.stringify({
      level: "error",
      requestId,
      error: err instanceof Error ? err.message : String(err),
      path: "/api/webhooks/stripe",
      eventType: event.type,
      timestamp: new Date().toISOString(),
    }));
    return c.json({ error: "Processing failed" }, 500);
  }
  ```

**Verification:**
- [ ] Run worker locally; see structured logs in console
- [ ] Each log has requestId, timestamp, level

---

## Week 2: Ad Integration + Earnings (10 days)

### 2.1 VideoPlayer VAST Integration (3 days) — BLOCKER
**Owner:** Frontend eng + Backend eng

Connects ad serving to user experience.

#### Tasks

**2.1.1 Install Google IMA SDK**
```bash
cd apps/web
pnpm add @google/ima
```

**2.1.2 Update VideoPlayer Component**
- **File:** [apps/web/src/components/VideoPlayer.tsx](apps/web/src/components/VideoPlayer.tsx)
- **Changes:**
  ```typescript
  "use client";

  import { useRef, useEffect } from "react";
  import { useVideoPlayer } from "@/hooks/useVideoPlayer";
  import { useVideoPlayback } from "./VideoPlaybackContext";
  import { logAdImpression } from "@/lib/api";
  import { cn } from "@/lib/utils";
  import google from "@google/ima";  // NEW

  export function VideoPlayer({
    streamVideoId,
    title,
    creatorId,
    showAds = false,
    playbackUrl,
    customerSubdomain,
    className,
  }: VideoPlayerProps) {
    const iframeRef = useRef<HTMLIFrameElement>(null);
    const adsContainerRef = useRef<HTMLDivElement>(null);  // NEW
    const adsLoader = useRef<google.ima.AdsLoader | null>(null);  // NEW
    // ... existing code ...

    // NEW: Initialize Google IMA on mount
    useEffect(() => {
      if (!showAds || !adsContainerRef.current) return;

      const loader = new google.ima.AdsLoader(adsContainerRef.current);
      adsLoader.current = loader;

      loader.addEventListener(
        google.ima.AdsManagerLoadedEvent.Type.ADS_MANAGER_LOADED,
        () => {
          logAdImpression(streamVideoId, creatorId || "", "google_ima", 0);
        }
      );

      loader.addEventListener(google.ima.AdErrorEvent.Type.AD_ERROR, (error) => {
        console.error("Ad error:", error.getError());
      });

      return () => {
        loader.destroy();
      };
    }, [showAds, streamVideoId, creatorId]);

    // ... rest of component
    return (
      <div className="...">
        {showAds && (
          <div
            ref={adsContainerRef}
            className="absolute inset-0"
            style={{ display: "none" }}
          />
        )}
        <iframe ref={iframeRef} ... />
        {/* ... controls ... */}
      </div>
    );
  }
  ```

**2.1.3 Test Ad Playback**
- [ ] Set showAds=true for free-tier user
- [ ] Ad renders in player
- [ ] Impression logged to console
- [ ] Ad impression records in DB: `SELECT * FROM ad_events ORDER BY created_at DESC LIMIT 1`

---

### 2.2 Earnings Attribution from Ads (2 days)
**Owner:** Backend eng

Maps ad impressions to creator earnings.

#### Tasks

**2.2.1 Create Cron Job or Scheduled Worker to Aggregate Ad Revenue**
- **File:** Create [apps/worker/src/routes/cron.ts](apps/worker/src/routes/cron.ts) (NEW)
  ```typescript
  import { Hono } from "hono";
  import { eq, gte, sum } from "drizzle-orm";
  import type { Env } from "../types";
  import { createDb } from "../lib/db";
  import { adEvents, earnings } from "@nichestream/db";

  const cronRouter = new Hono<{ Bindings: Env }>();

  /**
   * POST /api/cron/aggregate-ad-revenue
   * Called via Cloudflare Cron Trigger daily to roll up ad impressions into earnings.
   * Requires CRON_SECRET header for security.
   */
  cronRouter.post("/aggregate-ad-revenue", async (c) => {
    const secret = c.req.header("x-cron-secret");
    if (!secret || secret !== c.env.CRON_SECRET) {
      return c.json({ error: "Unauthorized" }, 401);
    }

    const db = createDb(c.env);

    try {
      // Get ad events from last 24 hours grouped by creator
      const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);
      
      const adRevenue = await db
        .select({
          creatorId: adEvents.creatorId,
          totalRevenueCents: sum(adEvents.estimatedRevenueCents),
        })
        .from(adEvents)
        .where(gte(adEvents.impressionAt, yesterday))
        .groupBy(adEvents.creatorId);

      // Insert earnings records for each creator
      for (const { creatorId, totalRevenueCents } of adRevenue) {
        if (!totalRevenueCents || totalRevenueCents <= 0) continue;

        const platformFeeCents = Math.floor(totalRevenueCents * 0.2);
        const netAmountCents = totalRevenueCents - platformFeeCents;

        await db.insert(earnings).values({
          creatorId,
          videoId: null,
          type: "ad_revenue",  // NOTE: Need to add this to earningTypeEnum
          grossAmountCents: totalRevenueCents,
          platformFeeCents,
          netAmountCents,
          status: "pending",
        }).catch(err => console.error(`Failed to insert earnings for ${creatorId}:`, err));
      }

      return c.json({ processed: adRevenue.length });
    } catch (err) {
      console.error("Cron aggregation failed:", err);
      return c.json({ error: "Failed to aggregate" }, 500);
    }
  });

  export { cronRouter as cronRoutes };
  ```

**2.2.2 Add "ad_revenue" to Earnings Table Enum**
- **File:** [packages/db/src/schema/earnings.ts](packages/db/src/schema/earnings.ts)
- **Change:**
  ```typescript
  export const earningTypeEnum = pgEnum("earning_type", [
    "subscription_share",
    "unlock_purchase",
    "tip",
    "ad_revenue",  // NEW
  ]);
  ```
- **Migration:**
  ```bash
  pnpm db:generate
  pnpm db:migrate
  ```

**2.2.3 Mount Cron Route**
- **File:** [apps/worker/src/index.ts](apps/worker/src/index.ts)
- **Add:**
  ```typescript
  import { cronRouter } from "./routes/cron";
  // ...
  app.route("/api/cron", cronRouter);
  ```

**2.2.4 Configure Cloudflare Cron Trigger**
- **File:** [apps/worker/wrangler.toml](apps/worker/wrangler.toml)
- **Add:**
  ```toml
  [triggers]
  crons = ["0 0 * * *"]  # Daily at midnight UTC
  ```
- **Add to Environment:**
  ```toml
  [env.production.vars]
  CRON_SECRET = "secret-key-here"  # Set via GitHub Secret
  ```

**Verification:**
- [ ] Create ad_events manually in DB
- [ ] Call POST /api/cron/aggregate-ad-revenue manually
- [ ] Verify earnings records created with type="ad_revenue"

---

### 2.3 Earnings Distribution for Platform Subscriptions (2 days) — DESIGN BLOCKER
**Owner:** Product lead + Backend eng

Algorithms for splitting $1/month across multiple creators.

#### Tasks

**2.3.1 Choose Distribution Model**

**Option A: Weighted Engagement (Recommended)**
- Formula: `creator_share = creator_engagement_weight / total_platform_weight`
- Weights: watch_minutes + (chat_msgs × 2) + (poll_votes × 1.5)
- Pros: Incentivizes interactivity; fair
- Cons: More complex; requires historical data aggregation

**Option B: Direct Subscriptions Only**
- Each user subscribes to creator(s) directly
- Creator gets 100% of their subscriber's $1/month
- Pros: Simple; fair; aligned with current Stripe setup
- Cons: No "platform subscription" concept; less discovery

**Option C: Proportional Watch Time**
- Formula: `creator_share = creator_watch_minutes / total_platform_watch_minutes`
- Pros: Simple; data-driven
- Cons: May not incentivize interaction

**Decision Required:** Choose A, B, or C based on business strategy.

**Assuming Choice A (Weighted Engagement):**

**2.3.2 Create Engagement Aggregation Job**
- **File:** Create [apps/worker/src/lib/engagement.ts](apps/worker/src/lib/engagement.ts) (NEW)
  ```typescript
  import { gte, sum, sql } from "drizzle-orm";
  import { chatMessages, pollVotes, interactions } from "@nichestream/db";
  import type { DrizzleClient } from "./db";

  export async function getCreatorEngagementWeights(
    db: DrizzleClient,
    periodStart: Date,
  ): Promise<Record<string, number>> {
    // Total engagement points per creator from chat & polls in period
    const engagement = await db
      .select({
        creatorId: interactions.creatorId,  // Assume interactions table tracks this
        totalWeight: sql<number>`
          COALESCE(SUM(chat_weight), 0) * 1 +
          COALESCE(SUM(poll_weight), 0) * 1.5
        `,
      })
      .from(interactions)
      .where(gte(interactions.createdAt, periodStart))
      .groupBy(interactions.creatorId);

    const weights: Record<string, number> = {};
    for (const row of engagement) {
      weights[row.creatorId] = row.totalWeight || 1;  // Floor of 1 if no engagement
    }
    return weights;
  }

  export function computeCreatorShare(
    creatorWeight: number,
    totalWeight: number,
  ): number {
    if (totalWeight === 0) return 0;
    return creatorWeight / totalWeight;
  }
  ```

**2.3.3 Create Monthly Distribution Cron**
- **File:** Create [apps/worker/src/routes/payout.ts](apps/worker/src/routes/payout.ts) (NEW)
  ```typescript
  import { Hono } from "hono";
  import { eq, sql } from "drizzle-orm";
  import type { Env } from "../types";
  import { createDb } from "../lib/db";
  import { earnings, subscriptions, users } from "@nichestream/db";
  import { getCreatorEngagementWeights, computeCreatorShare } from "../lib/engagement";

  const payoutRouter = new Hono<{ Bindings: Env }>();

  /**
   * POST /api/payout/distribute-monthly
   * Called on 1st of each month to distribute platform subscription revenue to creators.
   */
  payoutRouter.post("/distribute-monthly", async (c) => {
    const secret = c.req.header("x-cron-secret");
    if (!secret || secret !== c.env.CRON_SECRET) {
      return c.json({ error: "Unauthorized" }, 401);
    }

    const db = createDb(c.env);
    const platformFeePercent = Number(c.env.PLATFORM_FEE_PERCENT ?? 20);

    try {
      // Compute subscription revenue for last month
      const lastMonth = new Date();
      lastMonth.setMonth(lastMonth.getMonth() - 1);
      lastMonth.setDate(1);
      lastMonth.setHours(0, 0, 0, 0);

      const [{ totalRevenue }] = await db
        .select({
          totalRevenue: sum(earnings.grossAmountCents),
        })
        .from(earnings)
        .where(
          and(
            eq(earnings.type, "subscription_share"),
            gte(earnings.createdAt, lastMonth),
          ),
        );

      if (!totalRevenue || totalRevenue <= 0) {
        return c.json({ processed: 0, message: "No revenue to distribute" });
      }

      // Get creator engagement weights
      const weights = await getCreatorEngagementWeights(db, lastMonth);
      const totalWeight = Object.values(weights).reduce((a, b) => a + b, 0);

      // Distribute to each creator
      const creators = Object.keys(weights);
      for (const creatorId of creators) {
        const share = computeCreatorShare(weights[creatorId], totalWeight);
        const creatorGrossAmount = Math.round(totalRevenue * share);
        const platformFee = Math.round(creatorGrossAmount * platformFeePercent / 100);
        const netAmount = creatorGrossAmount - platformFee;

        await db.insert(earnings).values({
          creatorId,
          videoId: null,
          type: "subscription_share",
          grossAmountCents: creatorGrossAmount,
          platformFeeCents: platformFee,
          netAmountCents: netAmount,
          status: "pending",
        });
      }

      return c.json({ processed: creators.length, totalDistributed: totalRevenue });
    } catch (err) {
      console.error("Monthly distribution failed:", err);
      return c.json({ error: "Failed to distribute" }, 500);
    }
  });

  export { payoutRouter as payoutRoutes };
  ```

**2.3.4 Mount Payout Route & Configure Cron**
- **File:** [apps/worker/src/index.ts](apps/worker/src/index.ts)
- **Add:** `app.route("/api/payout", payoutRouter);`
- **File:** [apps/worker/wrangler.toml](apps/worker/wrangler.toml)
- **Update crons:**
  ```toml
  [triggers]
  crons = ["0 0 * * *", "0 0 1 * *"]  # Daily + 1st of month
  ```

**Verification:**
- [ ] Compute engagement weights for creators
- [ ] Distribute revenue proportionally
- [ ] Verify earnings records created with creator split

---

### 2.4 Update Types for Ad Revenue (0.5 days)
**Owner:** Backend eng

Ensures type safety across codebase.

#### Tasks

**2.4.1 Update Earning Types**
- **File:** [packages/types/src/index.ts](packages/types/src/index.ts)
- **Change:**
  ```typescript
  export type EarningType = "subscription_share" | "unlock_purchase" | "tip" | "ad_revenue";
  ```

**Verification:**
- [ ] `pnpm typecheck` passes

---

## Week 3: Testing + Hardening (8 days)

### 3.1 Integration Tests for Payment Flow (3 days)
**Owner:** QA eng

Verifies end-to-end subscription → webhook → earnings path.

#### Tasks

**3.1.1 Set Up Test Environment**
```bash
cd apps/worker
pnpm add --save-dev vitest stripe-mock
```

**3.1.2 Write Subscription Flow Test**
- **File:** Create [apps/worker/test/subscription.test.ts](apps/worker/test/subscription.test.ts) (NEW)
  ```typescript
  import { describe, it, expect, beforeAll } from "vitest";
  import Stripe from "stripe";

  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || "", {
    apiVersion: "2022-11-15",
  });

  describe("Subscription Flow", () => {
    let customerId: string;
    let priceId = process.env.STRIPE_CITIZEN_MONTHLY_PRICE || "";

    it("should create a checkout session", async () => {
      const session = await stripe.checkout.sessions.create({
        mode: "subscription",
        payment_method_types: ["card"],
        line_items: [{ price: priceId, quantity: 1 }],
        success_url: "http://localhost:3000/success",
        cancel_url: "http://localhost:3000/cancel",
      });

      expect(session.id).toBeDefined();
      expect(session.url).toContain("stripe.com");
    });

    it("should process subscription webhook correctly", async () => {
      // Create a mock subscription event
      const event = {
        type: "customer.subscription.created",
        data: {
          object: {
            id: "sub_test_123",
            customer: customerId,
            status: "active",
            current_period_end: Math.floor(Date.now() / 1000) + 30 * 24 * 60 * 60,
            items: {
              data: [{
                price: { unit_amount: 100, recurring: { interval: "month" } },
                quantity: 1,
              }],
            },
            metadata: {
              subscriberId: "user_123",
              creatorId: "creator_123",
              plan: "monthly",
            },
          },
        },
      };

      // Verify webhook handler processes correctly
      // (Mock database to check insert calls)
      expect(event.data.object.metadata.subscriberId).toBeDefined();
    });
  });
  ```

**3.1.3 Test Ad Logging**
- **File:** Create [apps/worker/test/ads.test.ts](apps/worker/test/ads.test.ts) (NEW)
  ```typescript
  import { describe, it, expect } from "vitest";

  describe("Ad Logging", () => {
    it("should accept ad event and log impression", async () => {
      const response = await fetch("http://localhost:8787/api/ads/log-event", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          videoId: "video_123",
          creatorId: "creator_123",
          adNetwork: "placeholder",
          estimatedRevenueCents: 5,
        }),
      });

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.logged).toBe(true);
    });
  });
  ```

**3.1.4 Run Tests**
```bash
pnpm test
```

---

### 3.2 Load Testing Dashboard Analytics (2 days)
**Owner:** DevOps/QA

Ensure dashboard doesn't timeout under load.

#### Tasks

**3.2.1 Load Test with K6**
```bash
pnpm add --save-dev k6
```

**3.2.2 Create Load Test Script**
- **File:** Create [test/load-dashboard.js](test/load-dashboard.js) (NEW)
  ```javascript
  import http from "k6/http";
  import { check, sleep } from "k6";

  export const options = {
    vus: 10,
    duration: "30s",
  };

  export default function () {
    const url = "http://localhost:8787/api/dashboard/analytics";
    const params = {
      headers: {
        Authorization: `Bearer ${__ENV.AUTH_TOKEN}`,
      },
    };

    const res = http.get(url, params);
    check(res, {
      "status is 200": (r) => r.status === 200,
      "response time < 5s": (r) => r.timings.duration < 5000,
    });
    sleep(1);
  }
  ```

**3.2.3 Run Load Test**
```bash
k6 run test/load-dashboard.js
```

**Expected Results:**
- P95 latency < 5 seconds
- 0% error rate
- If fails, implement [Issue 3.1](#issue-31-dashboard-analytics-fires-10-concurrent-http-calls) concurrency limiting

---

### 3.3 VIP User E2E Test (1.5 days)
**Owner:** QA

Full flow: signup → trial → VIP upgrade → message in chat.

#### Tasks

**3.3.1 Manual Test Script**
1. Sign up with new email
2. Navigate to /pricing
3. Click "VIP" checkout
4. Complete Stripe payment
5. Verify userTier = "vip" in DB
6. Connect WebSocket; send chat message
7. Verify message shows VIP badge
8. Verify chat rate limit is 500ms (not 1000ms)

**3.3.2 Automation (Playwright)**
- **File:** Create [test/vip-flow.spec.ts](test/vip-flow.spec.ts) (NEW)
  ```typescript
  import { test, expect } from "@playwright/test";

  test("VIP subscription flow", async ({ page }) => {
    // Navigate to signup
    await page.goto("http://localhost:3000/sign-up");
    
    // Fill form
    await page.fill('[name="email"]', `test-${Date.now()}@example.com`);
    await page.fill('[name="password"]', "TestPassword123!");
    await page.click('button[type="submit"]');
    
    // Should see trial banner
    await page.goto("http://localhost:3000/pricing");
    await expect(page.getByText("14-day Citizen trial")).toBeVisible();
    
    // Click VIP
    await page.click('button:has-text("VIP")');
    
    // Complete Stripe payment (test card)
    await page.fill('[placeholder="Card number"]', "4242 4242 4242 4242");
    await page.fill('[placeholder="MM/YY"]', "12/25");
    await page.fill('[placeholder="CVC"]', "123");
    await page.click('button[type="submit"]');
    
    // Should redirect to success
    await expect(page).toHaveURL(/subscription=success/);
  });
  ```

**3.3.3 Run Tests**
```bash
pnpm exec playwright test
```

---

### 3.4 Chat Persistence Under Network Latency (1 day)
**Owner:** QA

Verify retry logic works.

#### Tasks

**3.4.1 Monkey-Patch DB with Failure Simulation**
- Temporarily modify [VideoRoom.ts](apps/worker/src/durable-objects/VideoRoom.ts) to simulate DB failure 1st attempt
- Send chat message; verify it retries and persists
- Restore original code

**3.4.2 Network Throttle Test (Chrome DevTools)**
- Open watch page
- Set DevTools to "Slow 3G"
- Send chat message
- Verify message appears in UI within 5 seconds
- Check DB for persisted record

**Verification:**
- [ ] Chat message synced even on slow network
- [ ] No user-facing errors
- [ ] DB record created after retry

---

## Week 4: Monitoring + Deployment (5 days)

### 4.1 Set Up Alerting (1.5 days)
**Owner:** DevOps

Critical for production stability.

#### Tasks

**4.1.1 Integrate Axiom or Datadog**

**Option: Axiom (Recommended for Cloudflare)**
```bash
cd apps/worker
pnpm add @axiomhq/sdk
```

**4.1.2 Add Alert Triggers**
- Payment webhook failure rate > 1%
- Worker error rate > 0.1%
- DB query latency P95 > 2s
- Ad revenue < expected (daily)

**4.1.3 Slack Integration**
- Webhook for critical alerts
- Channel: #nichestream-alerts

---

### 4.2 Staging Deployment (1 day)
**Owner:** DevOps

Dry run before production.

#### Tasks

**4.2.1 Create Staging Branch**
```bash
git checkout -b staging
git merge main
```

**4.2.2 Deploy to Staging**
```bash
cd apps/worker
ENVIRONMENT=staging pnpm exec wrangler deploy

cd ../web
ENVIRONMENT=staging pnpm build:pages
pnpm exec wrangler pages deploy dist
```

**4.2.3 Run Smoke Tests in Staging**
```bash
export API_URL=https://staging-worker.workers.dev
pnpm test test/smoke.ts
```

**Verification:**
- [ ] Pages loads
- [ ] Auth flow works
- [ ] Payment checkout works (test mode)
- [ ] Chat connects and messages persist

---

### 4.3 Performance Benchmarking (1.5 days)
**Owner:** DevOps

Establish baselines.

#### Tasks

**4.3.1 Benchmark Against Alerts**
- API response time: p50 < 200ms, p95 < 1s
- Worker startup: < 50ms
- DB query: p95 < 500ms
- Real-time message latency: < 100ms

**4.3.2 Test Max Concurrent Users**
- 100 users watching same video simultaneously
- Chat message throughput: 10 msg/sec
- Poll update broadcast: <50ms latency

---

### 4.4 Production Cutover Planning (1 day)
**Owner:** Product lead + DevOps

Strategy for go-live.

#### Tasks

**4.4.1 Communication Plan**
- Announce to creators: "VIP tier launching May 15"
- Beta community: "New features rolling out"
- Support team training on VIP features

**4.4.2 Monitoring Dashboard**
- Real-time dashboard for key metrics:
  - Active users
  - Subscription count
  - Revenue today
  - Error rate
  - API latency

**4.4.3 Rollback Plan**
- If critical issues post-launch:
  1. Disable VIP checkout (set price to null)
  2. Revert ad logging if causing errors
  3. Roll back Worker version
  4. Notify creators + community

---

## Definition of Done

### Phase 3a (VIP + Ads Foundation) — May 1
- [ ] VIP checkout routing implemented
- [ ] VIP webhook handler working
- [ ] Chat persistence retry logic complete
- [ ] Structured logging in place

### Phase 3b (Full Integration) — May 8
- [ ] Google IMA ad playing in VideoPlayer
- [ ] Ad revenue aggregation job working
- [ ] Earnings distribution algorithm live
- [ ] All integration tests passing
- [ ] Load tests pass (p95 < 5s)

### Phase 3c (Production Ready) — May 15
- [ ] Staging deployment stable for 48 hours
- [ ] Alerts configured + tested
- [ ] Smoke tests all pass
- [ ] Rollback procedure documented & tested
- [ ] Creator comms ready
- [ ] Support team trained

---

## Success Metrics (Post-Launch)

| Metric | Target | Monitoring |
|--------|--------|------------|
| Conversion (Free → Citizen) | 2-5% | Cohort analysis |
| Conversion (Citizen → VIP) | 1-3% | Stripe dashboard |
| Ad RPM (Revenue Per Mille) | $0.50-2.00 | Axiom dashboard |
| Chat reliability (persistence success rate) | 99.5% | Axiom alerts |
| Webhook success rate | 99%+ | Axiom alerts |
| API p95 latency | < 1s | Axiom dashboard |

---

## Owner Assignments

| Component | Owner | Review |
|-----------|-------|--------|
| Async error recovery | Backend eng #1 | Arch lead |
| VIP checkout | Backend eng #1 | Product |
| Ad integration | Frontend eng | Backend lead |
| Earnings distribution | Backend eng #2 | Product |
| Monitoring setup | DevOps | Lead eng |
| Testing | QA | Lead eng |
| Staging deploy | DevOps | Tech lead |

---

## Timeline Summary

```
Week 1: Foundation (Error recovery, VIP routing, logging)
Week 2: Integration (Ad UI, earnings sync, distribution logic)
Week 3: Testing & Hardening (Integration tests, load tests, E2E)
Week 4: Launch (Monitoring, staging, rollback plan)

Deploy to production: May 15, 2026
```

---

**Prepared by:** Auditor  
**Last Updated:** April 13, 2026  
**Next Review:** Weekly standups during Phase 3
