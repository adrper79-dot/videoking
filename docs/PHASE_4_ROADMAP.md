# Phase 4 Roadmap — Polish & Growth

**Target Timeline:** May 15 — June 30, 2026 (6 weeks)  
**Target Status:** General Availability (GA)  
**Goal:** Production-grade platform with creator tools and growth infrastructure

---

## Overview

Phase 4 focuses on:
1. **Creator Onboarding** — Stripe Connect OAuth + bank payouts
2. **Growth Infrastructure** — Referral system, community events
3. **Analytics & Insights** — Creator earnings breakdown, retention cohorts
4. **Performance & Reliability** — Observability, error recovery, load testing
5. **UI Polish** — Trial countdowns, post-churn messaging, mobile optimization

---

## Feature Breakdown

### 1. Creator Stripe Connect Onboarding (Week 1–2)

**Current State:** POST `/api/stripe/connect/onboard` exists but incomplete

**Work Required:**

#### 1a. OAuth Flow
- [ ] Implement Stripe Connect OAuth redirect in worker
- [ ] Handle redirect back with authorization code
- [ ] Exchange for connected account ID
- [ ] Store in `connected_accounts` table
- [ ] Display in creator dashboard

**Files to Modify:**
- `apps/worker/src/routes/stripe.ts` — Add OAuth handler
- `packages/db/src/schema/users.ts` — Link user to connected_accounts
- `apps/web/src/components/CreatorDashboard.tsx` — Add "Connect Bank" button

#### 1b. Automatic Payouts
- [ ] Query `earnings` table monthly
- [ ] Calculate creator_net for each earning record
- [ ] Aggregate by creator per payout period
- [ ] Trigger Stripe Connect payout transfer
- [ ] Track transfer status (pending/paid/failed) in earnings table

**Files to Modify:**
- `apps/worker/src/lib/payouts.ts` — New module (250 LOC)
- `apps/worker/src/index.ts` — Add cron job for monthly payout sweep
- `packages/db/src/schema/earnings.ts` — Add stripeTransferId field (already exists)

#### 1c. Creator Earnings Dashboard
- [ ] Show breakdown by revenue source (subscription shares, video unlocks, tips, ad revenue)
- [ ] Show breakdown by payer tier (Free, Citizen, VIP)
- [ ] Show pending vs. paid earnings
- [ ] Show transfer history with Stripe links

**Files to Create:**
- `apps/web/src/components/EarningsBreakdown.tsx` (200 LOC)

**Estimated Effort:** 5 story points (2 weeks for 2 developers)

---

### 2. Retention & Conversion UI (Week 1–3)

#### 2a. Trial Expiry Countdown
- [ ] Query trial_started_at from users table
- [ ] Calculate days_remaining = trial_started_at + 14 days - today
- [ ] Show banner when days_remaining ≤ 3: "Your trial ends in X days — subscribe for $1/month"
- [ ] Update banner daily

**Files to Modify:**
- `apps/web/src/components/Navbar.tsx` — Add trial banner

#### 2b. Post-Trial Downgrade Messaging
- [ ] On trial expiry (Stripe webhook `customer.subscription.created` with `trial_end` = now):
  - Send in-app notification: "Your trial ended! Keep the community for $1/month"
  - Show CTA banner for 7 days
  - Track if converted within 7 days (cohort metric)

**Files to Modify:**
- `apps/worker/src/routes/webhooks.ts` — Handle trial_end
- `apps/web/src/components/Notifications.tsx` — In-app messaging

#### 2c. Chat Limit Upsell
- [ ] When free user hits chat rate limit (10s between messages):
  - Show modal: "Upgrade to Citizen ($1/month) for unlimited chat"
  - Track modal display and conversion

**Files to Modify:**
- `apps/web/src/components/InteractivityOverlay.tsx` — Add rate-limit modal

**Estimated Effort:** 3 story points (1.5 weeks for 1 developer)

---

### 3. Referral System (Week 2–4)

#### 3a. Referral Links
- [ ] Generate unique referral code per creator: `nichestream.com?ref=creator_username`
- [ ] Store referral metadata: referred_by_user_id, referral_code, created_at
- [ ] Track in new `referrals` table

**Schema:**
```sql
CREATE TABLE referrals (
  id UUID PRIMARY KEY,
  referred_user_id UUID NOT NULL REFERENCES users(id),
  referred_by_user_id UUID NOT NULL REFERENCES users(id),
  referral_code TEXT NOT NULL UNIQUE,
  signed_up_at TIMESTAMP,
  trial_started_at TIMESTAMP,
  converted_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW()
);
```

#### 3b. Referral Rewards
- [ ] On sign-up via referral link:
  - Both referrer and referred get 7 extra trial days (new column: `trial_extended_days`)
  - Or: $2 credit toward subscription (new column: `account_credits_cents`)
- [ ] Track in earnings table as "referral_bonus" type

#### 3c. Referral Dashboard
- [ ] Show creator's referral link
- [ ] Show referral stats: clicks, sign-ups, conversions
- [ ] Show total referral bonuses earned

**Files to Create:**
- `apps/worker/src/routes/referrals.ts` (150 LOC)
- `apps/web/src/components/ReferralDashboard.tsx` (200 LOC)

**Estimated Effort:** 5 story points (2.5 weeks)

---

### 4. Churn Analytics & Cohort Tracking (Week 3–5)

#### 4a. Cohort Tables
Create reporting tables to track user behavior over time:

```sql
CREATE TABLE cohorts_daily (
  cohort_date DATE,
  user_id UUID REFERENCES users(id),
  days_since_signup INT,
  tier TEXT,
  is_active BOOLEAN,
  watched_minutes INT,
  created_at TIMESTAMP
);

CREATE TABLE churn_tracking (
  user_id UUID PRIMARY KEY REFERENCES users(id),
  signup_date DATE,
  trial_activated_date DATE,
  trial_ended_date DATE,
  converted_date DATE,
  canceled_date DATE,
  total_watched_minutes INT,
  total_chat_messages INT,
  inactivity_days INT
);
```

#### 4b. Churn Prediction
- [ ] Generate daily/weekly cohort reports
- [ ] Identify at-risk users (inactive > 7 days after trial expiry)
- [ ] Send re-engagement emails (Stripe templates integration)
- [ ] Track re-engagement success

#### 4c. Analytics API
- [ ] Create admin endpoint: `GET /api/admin/analytics/cohorts` (requires role=admin middleware)
- [ ] Return cohort data (sign-ups by week, trial→conversion rate, churn rate)
- [ ] Enable drill-down by creator, geography, device type

**Files to Create:**
- `apps/worker/src/routes/analytics.ts` (250 LOC)
- `packages/db/src/migrations/0004_phase4_cohorts.sql`

**Estimated Effort:** 4 story points (2 weeks)

---

### 5. Performance & Observability (Week 2–6)

#### 5a. Database Query Optimization
- [ ] Profile slow queries in dashboard analytics endpoint
- [ ] Add missing indexes on high-frequency filter columns
- [ ] Optimize VideoRoom chat persistence queries
- [ ] Implement query result caching (Redis or KV) for read-heavy endpoints

**Files to Modify:**
- `packages/db/src/schema/*.ts` — Add performance indexes
- `apps/worker/src/routes/videos.ts` — Cache video feed query

#### 5b. Error Monitoring
- [ ] Integrate structured logging with Axiom or Sentry
- [ ] Set up alerts for error rate thresholds
- [ ] Add custom metrics: auth latency, Stripe webhook processing time, Stream API latency

**Files to Modify:**
- `apps/worker/src/lib/logger.ts` — Add Axiom/Sentry transport
- `apps/worker/src/index.ts` — Add middleware for metrics

#### 5c. Load Testing
- [ ] Run load test with 10K concurrent users
- [ ] Simulate realistic scenarios: video stream, chat, polls
- [ ] Identify bottlenecks (Durable Objects, database, Stream API)
- [ ] Document scaling limits and upgrade path

**Tools:**
- k6.io for load testing

**Estimated Effort:** 4 story points

---

### 6. UI Polish & Mobile Optimization (Week 4–6)

#### 6a. Mobile Responsive
- [ ] Test on iOS Safari, Android Chrome
- [ ] Fix VideoPlayer layout on small screens
- [ ] Optimize chat UI for mobile (larger tap targets)
- [ ] Test watch party sync on 4G network

#### 6b. Accessibility
- [ ] WCAG 2.1 AA audit
- [ ] Add ARIA labels, keyboard navigation
- [ ] Test with screen readers

#### 6c. Dark Mode
- [ ] Implement Tailwind dark mode toggle
- [ ] Store preference in user settings
- [ ] Default to system preference

**Files to Modify:**
- `tailwind.config.ts` — Enable dark mode
- `apps/web/src/components/*.tsx` — Update styling

**Estimated Effort:** 2 story points

---

## Risk Mitigation

| Risk | Mitigation |
|---|---|
| Stripe Connect OAuth complexity | Early spike (week 1), pair programming with Stripe docs |
| Cohort analytics scale (millions of rows) | Use Neon time-series optimizations, partition by month |
| Load test reveals scaling limits | Prepare Durable Objects multi-region failover design |
| Mobile testing on real devices | Budget for BrowserStack or device rental |

---

## Success Criteria

- [ ] Stripe Connect onboarding flow > 90% completion rate
- [ ] Trial → conversion rate ≥ 30%
- [ ] Referral program drives ≥ 5% of new sign-ups
- [ ] Platform supports 10K concurrent users with <500ms p95 latency
- [ ] Churn rate ≤ 8% (target for subscription platforms)
- [ ] Mobile traffic ≥ 40% of total (post-optimization)
- [ ] WCAG 2.1 AA accessibility score ≥ 95%

---

## Deliverables

### Code
- [ ] `apps/worker/src/routes/referrals.ts` (150 LOC)
- [ ] `apps/worker/src/routes/analytics.ts` (250 LOC)
- [ ] `apps/worker/src/lib/payouts.ts` (250 LOC)
- [ ] `apps/web/src/components/ReferralDashboard.tsx` (200 LOC)
- [ ] `apps/web/src/components/EarningsBreakdown.tsx` (200 LOC)
- [ ] Database migrations (cohorts, referrals, churn tracking)

### Documentation
- [ ] PHASE_4_DEPLOYMENT_CHECKLIST.md
- [ ] Creator Onboarding Guide
- [ ] Analytics API Reference
- [ ] Load Test Results Report

### Metrics
- [ ] Cohort analysis with conversion funnel
- [ ] Performance report (load test results)
- [ ] Mobile usage & accessibility scores

---

## Timeline Summary

| Week | Focus | Developers |
|---|---|---|
| 1–2 | Stripe Connect OAuth + payouts | 2 |
| 1–3 | Trial/churn UI + messaging | 1 |
| 2–4 | Referral system | 2 |
| 2–6 | Performance & observability | 1 |
| 3–5 | Cohort analytics | 1 |
| 4–6 | UI polish & mobile | 1 |

**Total Effort:** ~20 story points (team of 3–4 developers, 6 weeks to GA)

---

## Post-GA Roadmap (Phase 4.5+)

- Advanced creator tools (scheduling, auto-captions via Workers AI, transcription)
- Community features (creator collabs, user-generated critique circles)
- Monetization expansion (live shopping, merchandise integration)
- Global expansion (localization, geo-targeted ads, regional payment methods)
