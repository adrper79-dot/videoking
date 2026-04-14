# Phase 6: Admin Analytics Dashboard & Retention Metrics

> **Status:** Implemented | **Date:** April 14, 2026 | **Commits:** 954028b

## Overview

Phase 6 implements a comprehensive admin analytics dashboard for tracking retention, churn, conversion funnel, and revenue metrics. This gives platform operators visibility into user behavior and enables data-driven retention strategies.

---

## Features Implemented

### 1. Churn Analysis Tab

**Purpose:** Identify at-risk users and track subscription cancellations

**Metrics Displayed:**
- **At-Risk Users** — Count of users flagged as at-risk based on inactivity threshold
- **Churned (7d)** — Users who canceled subscription in last 7 days
- **Churn Rate** — Percentage of active Citizen users who are at-risk (targets = at-risk / total_citizens)

**Controls:**
- Inactivity threshold slider (1-30 days, default: 7) — interactive threshold to define "at-risk"

**User Table:**
- User ID, Inactivity days, Signup date, Last activity
- Sortable and paginated (first 50 at-risk users shown)
- Direct export opportunity for retention campaigns

**Data Source:** `churnTracking` table with real-time `is_at_risk` and `churned` flags

---

### 2. Cohort Retention Tab

**Purpose:** Track user survival rate across signup cohorts

**Metrics by Cohort:**
- **Cohort Week** — Signup week (Monday of that week)
- **Signups** — Total signups in that cohort
- **D7 Retention** — % still active after 7 days (color: green)
- **D14 Retention** — % still active after 14 days (color: yellow)
- **D30 Retention** — % still active after 30 days (color: orange)

**Visualization:** Horizontal progress bars showing retention descent (100% → 81% → 62% → 45%)

**Data Source:** `cohortTracking` table aggregated by `daysSinceSignup`

**Use Cases:**
- Identify cohorts with low retention (early intervention)
- Measure impact of feature launches (compare pre/post cohorts)
- Forecast LTV based on retention curves

---

### 3. Conversion Funnel Tab

**Purpose:** Visualize signup-to-paid pipeline

**Funnel Stages:**

```
Total Signups (30d)  ←  All new users
      ↓
Trial Activated      ←  Entitlements.activateTrialIfEligible()
      ↓
Converted to Paid    ←  Subscription.status = "active"
```

**Metrics:**
- **Total Signups (30d)** — Raw count of new users
- **Trial Activated** — Count + percentage of signups who got trial
- **Converted to Paid** — Count + percentage of activated trials that converted
- **Referral Conversion Rate** — % of referral signups → paid (vs organic)
- **Organic Conversion Rate** — % of organic signups → paid

**Visualization:**
- Funnel bars showing drop-off at each stage
- Side-by-side comparison of referral vs organic conversion

**Use Cases:**
- A/B test trial messaging or onboarding flows
- Measure impact of referral program
- Identify bottlenecks in conversion flow (where do users drop most?)

---

### 4. ARPU (Average Revenue Per User) Tab

**Purpose:** Measure monetization across segments

**Top-Level ARPU Metrics:**
- **Overall ARPU** — Average revenue per all users (monthly)
- **Citizen ARPU** — Average revenue per Citizen tier user
- **VIP ARPU** — Average revenue per VIP tier user
- **Ad Revenue ARPU** — Average ad impression revenue per free-tier user

**Cohort ARPU Table:**
- By signup cohort
- ARPU in dollars
- Paying users count
- Trend analysis (early cohorts higher ARPU due to LTV?)

**Data Sources:**
- `earnings` table (subscription revenue)
- `adEvents` table (ad revenue attribution)
- `subscriptions` table (active tier breakdown)

**Business Intelligence:**
- Which cohorts have highest lifetime value?
- Is VIP tier driving incremental revenue?
- Are ads reducing subscription conversions or additive?

---

## Component Architecture

### AnalyticsDashboard (`apps/web/src/components/AnalyticsDashboard.tsx`)

**Props:** None (uses `api.get` directly)

**Sub-components:**
- `ChurnAnalysis` — Displays at-risk metrics and user table
- `CohortAnalysis` — Retention rate visualizations
- `ConversionFunnel` — Funnel visualization
- `ARPUAnalysis` — ARPU tables and metrics

**State:**
- `activeTab` — Current tab selection
- `loading` — Data fetch status
- `error` — API error messages
- `[dataType]Data` — Cached API responses

**API Calls (all require admin role):**
```
GET /api/admin/analytics/churn?inactivity_threshold_days=7
GET /api/admin/analytics/cohorts?start_date=2026-03-01&end_date=2026-04-14
GET /api/admin/analytics/conversion-funnel
GET /api/admin/analytics/arpu
```

### AdminPanel Enhancement

**Before:** Creator verification only
**After:** Tabbed interface with:
- "Analytics" tab → `<AnalyticsDashboard />`
- "Creators" tab → Existing creator verification UI

**Integration:** `apps/web/src/components/AdminPanel.tsx` imports and renders `AnalyticsDashboard`

---

## Backend Infrastructure (Already Implemented in Phase 4)

### Analytics Routes (`apps/worker/src/routes/analytics.ts`)

All endpoints require `requireAdmin` middleware.

#### GET /api/admin/analytics/churn
```typescript
Query: inactivity_threshold_days = 7
Response: {
  at_risk_count: 42,
  churned_last_7d: 8,
  churn_rate: 0.2105,
  inactivity_threshold_days: 7,
  at_risk_users: [
    { user_id, inactivity_days, last_activity, signup_date }
  ]
}
```

#### GET /api/admin/analytics/cohorts
```typescript
Query: start_date="2026-03-01", end_date="2026-04-14"
Response: [
  {
    cohort_week: "2026-04-07",
    signup_count: 150,
    d7_retention: 0.81,
    d14_retention: 0.62,
    d30_retention: 0.45
  }
]
```

#### GET /api/admin/analytics/conversion-funnel
```typescript
Response: {
  total_signups_30d: 542,
  trial_activated: 489,
  trial_activated_pct: 0.9027,
  converted_to_paid: 147,
  conversion_rate: 0.27 (147/542),
  refer_conversion_rate: 0.35 (referral signups only),
  organic_conversion_rate: 0.25 (organic signups only)
}
```

#### GET /api/admin/analytics/arpu
```typescript
Response: {
  overall_arpu: 235000, // cents = $2.35/user
  citizen_arpu: 450000,
  vip_arpu: 1200000,
  ad_revenue_arpu: 15000,
  by_cohort: [
    {
      cohort_week: "2026-04-07",
      arpu_cents: 180000,
      paying_users: 45
    }
  ]
}
```

---

## Database Tables (Already Created in Phase 4)

### churnTracking
- Tracks user activity and churn risk
- `is_at_risk` flag: 1 if meets churn criteria, 0 otherwise
- `churned`: 1 if subscription canceled
- Indexed on `is_at_risk`, `churned`, `updated_at`

### cohortTracking
- Records daily snapshot of user engagement by cohort
- `daysSinceSignup` — number of days since signup on that date
- `engagement_score` — weighted: watched_minutes + (chat_messages × 2) + (poll_votes × 1.5)
- Indexed on `cohort_date`, `user_id`, `days_since_signup`

### earnings
- Records all revenue events
- `type` — 'subscription_share', 'unlock_purchase', 'tip', 'ad_impression'
- `source` — 'stripe' or 'platform_ad'
- Aggregations: SUM(net_amount_cents) by creator_id, status

---

## UX/UI Features

### Tab Navigation
- Consistent design with Phase 5 (tabs with brand-color underline)
- Smooth transitions between tabs
- Tab state persists during session

### Loading State
- Animated spinner while data fetches
- Prevents interaction during load

### Error Handling
- Red error banner with API error message
- Retry button (resets `activeTab` to force refetch)
- Graceful fallback if specific metric fails

### Data Visualization
- Progress bars show retention %
- Color coding (green → yellow → orange) for declining retention
- Large numbers for KPIs
- Sortable tables with hover effects

### Threshold Controls
- Inactivity slider allows real-time filtering of at-risk users
- Instantly updates table without page reload
- Shows current threshold value

---

## Access Control

### Admin Role Requirement
- All analytics endpoints protected by `requireAdmin` middleware
- Admin status determined by `user.role = "admin"` in users table
- Dashboard only accessible to admins
- Non-admins see "Access Denied" message

### Audit Trail
- All admin analytics views logged to `structured logs` (via `createLogger`)
- Request correlation IDs track which admin viewed which metrics when

---

## Performance Considerations

### Query Optimization
- `churnTracking` table has indexes on `is_at_risk`, `churned`, `updated_at`
- `cohortTracking` indexed on `cohort_date`, `user_id`
- Queries limit to 50 at-risk users (paginate if expanded)
- Monthly date range filters reduce scan size

### Caching Strategy
- Frontend caches analytics data in component state
- Re-fetches only on tab change or manual refresh
- No browser caching (fresh data on page reload)
- Consider adding Redis cache in future for high-traffic admin dashboards

### API Response Time Targets
- `/churn` — <500ms (simple filtering + limit of 50)
- `/cohorts` — <1s (aggregation over month)
- `/conversion-funnel` — <300ms (3 COUNT queries)
- `/arpu` — <1.5s (multiple SUM aggregations by cohort)

---

## Future Enhancements

### Phase 6b: Retention Playbook
- Auto-generate retention email campaigns for at-risk users
- Template builder for win-back offers
- A/B test different messaging

### Phase 6c: Predictive Analytics
- ML model to predict churn probability (not just is_at_risk flag)
- Feature importance scores (which factors most predict churn?)
- Intervention recommendations per user

### Phase 6d: Segment Builder
- Create cohorts based on engagement, spending, tenure
- Save segments for bulk email campaigns
- Trigger automations based on segment rules

### Phase 6e: Real-Time Dashboards
- WebSocket subscription to real-time metrics
- Relative-time metrics ("2 mins ago someone signed up")
- Automated alerts (e.g., "churn rate spike detected")

---

## Testing Guide

### Manual Testing

**1. Churn Analysis**
```bash
# Check at-risk users appear
1. Login as admin
2. Navigate to /dashboard/admin → Analytics → Churn
3. Adjust inactivity threshold from 7 → 14 days
4. Verify user list updates
5. Check that user IDs match churned users from query:
   SELECT * FROM churn_tracking WHERE is_at_risk = 1 ORDER BY inactivity_days DESC
```

**2. Cohort Retention**
```bash
# Verify retention rates decline properly
1. Go to Cohort tab
2. Check that D7 > D14 > D30 (retention declining)
3. Spot-check against database:
   SELECT COUNT(*) FROM cohorts_daily 
   WHERE cohort_week = '2026-04-07' AND days_since_signup = 7 AND is_active = 1
```

**3. Conversion Funnel**
```bash
# Verify funnel drops correctly
1. Check: trial_activated ≤ total_signups
2. Check: converted_to_paid ≤ trial_activated
3. Verify referral conversion > organic conversion (or vice versa)
```

**4. ARPU**
```bash
# Verify revenue calculations
1. Pull overall ARPU from API
2. Manually calculate: SUM(earnings.net_amount_cents) / COUNT(DISTINCT users.id)
3. Compare results
```

### Automated Tests
- Unit tests for analytics endpoints (query builders, aggregation logic)
- Integration tests simulating user flows (signup → trial → conversion)
- E2E tests clicking through admin UI tabs

---

## Deployment Checklist

### Prerequisites
- [ ] Verify `churnTracking`, `cohortTracking`, `earnings` tables exist in staging DB
- [ ] Verify indexes exist: `churn_tracking_is_at_risk_idx`, `cohorts_daily_cohort_date_idx`, etc.
- [ ] Verify test admin user exists with `role = 'admin'`

### Smoke Tests (Staging)
```bash
# 1. Admin can access dashboard
curl -b "session=<admin_session>" https://staging.nichestream.com/dashboard/admin
# Verify tab navigation works

# 2. Test churn API
curl https://staging-api.nichestream.com/api/admin/analytics/churn \
  -H "Authorization: Bearer <admin_jwt>"
# Verify returns JSON with at_risk_users array

# 3. Test cohorts API
curl https://staging-api.nichestream.com/api/admin/analytics/cohorts
# Verify returns array of cohorts with retention rates

# 4. Test funnel API
curl https://staging-api.nichestream.com/api/admin/analytics/conversion-funnel
# Verify conversion_rate is between 0-1

# 5. Test ARPU API
curl https://staging-api.nichestream.com/api/admin/analytics/arpu
# Verify overall_arpu > 0 and citizen_arpu >= overall_arpu
```

### Production Deployment
- Deploy analytics routes to worker (already live if Phase 4 merged)
- Deploy AdminPanel + AnalyticsDashboard components to web app
- Verify admin users can access /dashboard/admin
- Monitor API latency for 24h (watch for query performance issues under real load)

---

## Files Created/Modified

| File | Type | Change |
|------|------|--------|
| `apps/web/src/components/AnalyticsDashboard.tsx` | Component | New: 460+ LOC with 4 visualization tabs |
| `apps/web/src/components/AdminPanel.tsx` | Component | Updated: Added tab navigation, import AnalyticsDashboard |
| `apps/worker/src/routes/analytics.ts` | API | ✅ Already existed (Phase 4) |

---

## Commits

| Hash | Message |
|------|---------|
| `954028b` | feat: Phase 6 - Admin analytics dashboard with churn and retention metrics |

---

## Security & Privacy

- ✅ All analytics endpoints require admin role
- ✅ No sensitive user data exposed (only aggregates and IDs)
- ✅ Inactivity threshold configurable (prevents bias)
- ✅ Churn predictions made server-side, not client-side
- ⚠️ TODO: Add rate limiting for analytics endpoints (prevent abuse)
- ⚠️ TODO: Implement data retention policy (archive old cohort snapshots)

---

## Known Limitations

1. **Manual At-Risk Flagging** — `is_at_risk` flag currently set externally; should be calculated automatically in background job
2. **No Pagination** — At-risk users limited to 50; add pagination UI for scale
3. **No Export** — No CSV/Excel export of cohort data; consider adding for reporting
4. **Cohort Boundaries** — Cohorts defined by calendar week; could support custom periods
5. **No Drill-Down** — Can't click cohort to see individual users in that cohort

---

## Conclusion

Phase 6 provides platform operators with actionable insights into retention, conversion, and revenue metrics. Combined with Phases 4-5 (referrals, email, ads), the platform now has comprehensive monetization and retention infrastructure.

**Next Phase:** Phase 7 (Advanced Personalization - content recommendations, creator discovery algorithms)

