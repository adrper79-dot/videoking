# Phase 5: Ad Monetization System Implementation

> **Status:** Implemented | **Date:** April 14, 2026 | **Commits:** c9edf1c, 10d17ec

## Overview

Phase 5 implements a complete ad monetization system for free-tier users. This system provides non-intrusive ads to maximize revenue while maintaining a premium ad-free experience for Citizen and VIP tier subscribers.

---

## Architecture

### Data Flow

```
Free-tier User watches video
    ↓
VideoPlayer with showAds=true renders
    ↓
VAST XML requested from GET /api/ads/vast?videoId={id}
    ↓
Frontend logs ad events via POST /api/ads/track
    ↓
ad_events table records impression
    ↓
earnings table auto-created with ad_impression type
    ↓
Creator sees ad impressions + revenue in dashboard
```

### Tier Logic

| Tier | `adFree` Flag | Behavior |
|------|---|---|
| Free | false | Sees ads (VAST XML loaded) |
| Citizen | true | Ad-free experience |
| VIP | true | Ad-free experience |
| Trial (Day 1-14) | true | Ad-free (trial = citizen tier) |

---

## Implementation Details

### 1. Database Schema (Phase 5)

#### New Table: `ad_events`
```sql
CREATE TABLE ad_events (
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
```

#### Updated: `users` Table
```sql
ALTER TABLE users ADD COLUMN last_ad_served_at TIMESTAMP WITH TIMEZONE;
ALTER TABLE users ADD COLUMN ad_frequency_limit_ms INT DEFAULT 600000; -- 10 minutes
```

#### Updated: `earnings` Table
```sql
ALTER TABLE earnings ADD COLUMN ad_event_id UUID REFERENCES ad_events(id);
ALTER TABLE earnings ADD COLUMN source TEXT DEFAULT 'stripe'; -- 'stripe' | 'platform_ad'
```

**Migration:** `packages/db/src/migrations/0004_smooth_vargas.sql`

### 2. Backend API Endpoints

**Base Route:** `/api/ads` (Hono Router)

#### a) VAST XML Generation
```
GET /api/ads/vast?videoId=<videoId>
```

Returns VAST 4.0 XML with:
- Inline video ad metadata
- Tracking pixels for impressions, quartiles, completion, clicks
- 15-second skippable ad format
- Click-through URL for promotion

**Response:** `application/xml` VAST 4.0 document
**Cache:** 60 seconds

#### b) Ad Event Tracking
```
POST /api/ads/track
Content-Type: application/json

{
  "videoId": "uuid",
  "eventType": "impression" | "start" | "firstQuartile" | "midpoint" | "thirdQuartile" | "complete" | "click",
  "timestamp": "ISO8601 optional"
}
```

**Logic:**
- Billable events: `impression`, `firstQuartile`, `complete`
- Non-billable events: `start`, `midpoint`, `thirdQuartile`, `click`
- Revenue: $5 CPM (cost per 1,000 impressions) = 0.5 cents per impression
- Automatic earnings creation: Platform fee 30%, creator share 70%
- Idempotent: Uses `persistWithRetry()` with unique key per event

**Response:**
```json
{ "recorded": true }
```

#### c) Creator Ad Metrics
```
GET /api/ads/metrics/<creatorId>?period=day|week|month|all
```

**Response:**
```json
{
  "totalImpressions": 1250,
  "totalRevenueCents": 625,
  "byVideo": [
    {
      "videoId": "uuid-1",
      "impressions": 500,
      "revenueCents": 250
    },
    {
      "videoId": "uuid-2",
      "impressions": 750,
      "revenueCents": 375
    }
  ]
}
```

### 3. Frontend Components

#### a) ClientVideoWatcher
**File:** `apps/web/src/components/ClientVideoWatcher.tsx`

Wraps `VideoPlayer` and determines ad eligibility:
```typescript
- Uses EntitlementsContext to check user tier
- Sets showAds={true} only if !entitlements.limits.adFree
- Passes all video props to VideoPlayer
```

#### b) VideoPlayer Updates
**File:** `apps/web/src/components/VideoPlayer.tsx`

**New Props:**
- `showAds?: boolean` — Enable ad tracking on mount

**Behavior:**
- On mount: Calls `logAdImpression(videoId, "impression")` if showAds=true
- Logs after 1s delay to ensure component stability
- Silent failure: Catches and logs errors to console

#### c) CreatorDashboard Enhancement
**File:** `apps/web/src/components/CreatorDashboard.tsx`

**New Metrics:**
- "Ad Impressions (30d)" — Total impressions from last month
- "Ad Revenue" — Estimated revenue from ad events in last month

**Data Fetch:**
```typescript
GET /api/ads/metrics/{creatorId}?period=month
```

Graceful degradation: If ad metrics fail to load, dashboard still shows other stats.

### 4. API Client Helper
**File:** `apps/web/src/lib/api.ts`

#### Helper Function
```typescript
export async function logAdImpression(
  videoId: string,
  eventType: string = "impression",
  timestamp?: string
): Promise<void>
```

**Endpoint:** `POST /api/ads/track`

---

## Revenue Model

### CPM Structure

| Metric | Value | Notes |
|--------|-------|-------|
| CPM | $5 per 1,000 impressions | Industry average; configurable |
| Per Impression | $0.005 (0.5 cents) | $5 ÷ 1,000 |
| Platform Fee | 30% | $0.0015 per impression |
| Creator Share | 70% | $0.0035 per impression |

### Earnings Attribution

Ad revenue is attributed to creators as:
1. Ad event recorded with `estimated_revenue_cents`
2. Earnings entry created with `type: "ad_impression"`
3. Platform fee (30%) deducted automatically
4. Creator receives 70% of impression revenue
5. Payout status: "pending" until monthly settlement

### Billable Events

Only certain ad events generate revenue:
- ✅ `impression` — Ad viewed
- ✅ `firstQuartile` — 25% of ad watched
- ✅ `complete` — 100% of ad watched
- ❌ `start`, `midpoint`, `thirdQuartile`, `click` — Non-billable

---

## Tier Gating Logic

### Entitlements Context

The `useEntitlements()` hook provides:
```typescript
limits: {
  chatRateLimitMs: number,
  canCreatePolls: boolean,
  canUseWatchParty: boolean,
  adFree: boolean  // ← determines ad eligibility
}
```

### Calculation

```typescript
isPaid = effectiveTier !== "free"  // true for citizen/vip or active trial
adFree = isPaid                     // true = no ads
```

### Components Using This

1. **ClientVideoWatcher** — Gates `showAds` based on `!adFree`
2. **InteractivityOverlay** — May modify ad behavior based on tier

---

## Deployment Checklist

### Prerequisites
- [ ] Ensure migration `0004_smooth_vargas.sql` has run on staging DB
- [ ] Verify `ad_events` table exists and indexed
- [ ] Check `users` table has `last_ad_served_at` and `ad_frequency_limit_ms` columns
- [ ] Verify `earnings` table has `ad_event_id` and `source` columns

### Smoke Tests

1. **Free User Ad Flow**
   ```bash
   curl -b "session=<free_user_session>" https://app.nichestream.com/watch/video-id
   # Should see VAST XML loaded in console
   ```

2. **Citizen User Ad Gating**
   ```bash
   curl -b "session=<citizen_user_session>" https://app.nichestream.com/api/auth/entitlements
   # Verify adFree: true in response
   ```

3. **Ad Event Logging**
   ```bash
   curl -X POST https://api.nichestream.com/api/ads/track \
     -H "Content-Type: application/json" \
     -d '{"videoId":"uuid","eventType":"impression"}'
   # Verify ad_events table has new record
   ```

4. **Creator Ad Metrics**
   ```bash
   curl https://api.nichestream.com/api/ads/metrics/creator-id?period=month
   # Should return JSON with totalImpressions > 0
   ```

### Monitoring

- **ad_events table** — Monitor for high impression events (indicates healthy ad serving)
- **earnings revenue_cents** — Track cumulative ad revenue over time
- **API latency** — GET /ads/vast should be <100ms, POST /ads/track should be <50ms (async)
- **Error logs** — Watch for "Ad logging failed" or "track_error" messages

---

## Future Enhancements

### Phase 5b: Frequency Capping
- Implement `users.last_ad_served_at` to prevent ad fatigue (10-min default cap)
- Frontend: Check last impression timestamp before showing next ad
- Backend: Validate frequency limits in POST /ads/track

### Phase 5c: Real Ad Network Integration
- Replace `ad_network: "placeholder"` with actual Google IMA SDK
- Integrate Google Ad Manager or Programmatic Demand Platform (PDP)
- Support VAST 4.0 wrapper ads for higher fill rates

### Phase 5d: Advanced Targeting
- Use `ad_preferences.personalizedAds` flag for ad personalization
- Store advertiser segments in new `ad_configs` table
- Implement cohort-based audience selling

### Phase 5e: Payout Integration
- Link ad revenue to monthly payout runs via `earnings.source = 'platform_ad'`
- Include ad revenue in creator earnings reports
- Support payout via Stripe Connect

---

## Files Modified / Created

| File | Type | Change |
|------|------|--------|
| `packages/db/src/schema/ads.ts` | Schema | ✅ Already existed, verified correct |
| `packages/db/src/schema/users.ts` | Schema | Updated with ad frequency tracking |
| `packages/db/src/migrations/0004_smooth_vargas.sql` | Migration | New: Add ad frequency columns |
| `apps/worker/src/routes/ads.ts` | API | ✅ Already existed with full implementation |
| `apps/worker/src/index.ts` | Main | ✅ Already wired: `app.route("/api/ads", adsRouter)` |
| `apps/web/src/lib/api.ts` | Helper | Updated: `logAdImpression()` to use /track endpoint |
| `apps/web/src/components/VideoPlayer.tsx` | Component | Updated: `showAds` prop, ad logging on mount |
| `apps/web/src/components/ClientVideoWatcher.tsx` | Component | New: Ad eligibility gating by tier |
| `apps/web/src/app/watch/[videoId]/page.tsx` | Page | Updated: Use `ClientVideoWatcher` |
| `apps/web/src/components/CreatorDashboard.tsx` | Component | Enhanced: Ad metrics display |

---

## Commits

| Hash | Message | Date |
|------|---------|------|
| `10d17ec` | feat: Phase 5 - Ad monetization foundation | Apr 14 |
| `c9edf1c` | feat: Add ad metrics to creator dashboard | Apr 14 |

---

## Testing Guide

### Unit Tests (Manual)

1. **Tier Check** — Free user should trigger showAds
   ```typescript
   const entitlements = buildGuestEntitlements(env);
   expect(entitlements.limits.adFree).toBe(false); // Free user sees ads
   ```

2. **Entitlements** — Citizen user should not see ads
   ```typescript
   const entitlements = buildAuthEntitlements(citizenUser, env);
   expect(entitlements.limits.adFree).toBe(true); // Paid user no ads
   ```

### E2E Tests (Manual)

1. **Sign up free user** → Watch video → Verify VAST XML loads
2. **Upgrade to Citizen** → Watch same video → Verify no ad loading
3. **Check dashboard** → Verify "Ad Impressions" and "Ad Revenue" show correct values
4. **Query ad_events** → Verify records exist for watched videos

### Load Testing

- Simulate 1,000 concurrent ad impression logs
- Monitor database query performance
- Measure API response times for /ads/track and /ads/metrics

---

## Known Limitations

1. **Ad Network** — Currently uses "placeholder" network (not real ads)
2. **VAST Format** — Placeholder media file (not actual video ad)
3. **Frequency Capping** — Schema ready but frontend enforcement not implemented
4. **Revenue Sharing** — CPM hard-coded at $5 (configurable via code change)
5. **Payout Timing** — Ad earnings go to "pending" status (monthly settlement schedule TBD)

---

## Security Notes

- ✅ No payment data accepted from client (ad events only)
- ✅ Creator ID fetched from server session, never from request
- ✅ Video ID validated against database before recording event
- ✅ Revenue estimation server-side only
- ⚠️ TODO: Implement signature-based idempotency tokens for duplicate prevention

---

## Conclusion

Phase 5 lays the complete foundation for monetizing free-tier users through non-intrusive advertising. The system is production-ready for integration with a real ad network and supports seamless future enhancements without changing existing architecture.

**Next Phase:** Phase 6 (Churn Analytics & Retention — admin dashboard for cohort analysis and at-risk user detection).

