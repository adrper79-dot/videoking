# Phase 4 Production Deployment Checklist ✅

**Status**: Code complete, ready for production deployment  
**Date**: 2026-04-14  
**Phase**: 4 of 4  
**Git Branch**: `main` (all commits pushed)

---

## Pre-Deployment Verification

### Code Status ✅
- ✅ All 16 Phase 4 commits merged to main branch
- ✅ TypeScript: 4/4 packages compile successfully (0 errors)
- ✅ All TODOs implemented and removed from codebase
- ✅ Database migration generated: `0001_parallel_mephistopheles.sql`
- ✅ Working tree clean, fully synced with origin/main

### Features Implemented ✅
- ✅ **Referral System** (4 endpoints)
  - Create unique referral codes
  - Retrieve user referral links
  - Track referral performance metrics
  - Apply referral codes with trial bonuses
  - Features: 90-day expiration, trial bonuses for both users, status tracking

- ✅ **Analytics System** (4 endpoints, admin-only)
  - Cohort retention analysis
  - At-risk user churn identification
  - Signup-to-paid conversion funnel
  - Average revenue per user (ARPU) breakdown
  - Features: Date range filtering, aggregations, admin authentication

- ✅ **Payout Engine** (5+ functions)
  - Monthly earnings aggregation
  - Stripe Connect transfer processing
  - Transfer status tracking
  - Stripe webhook event handling
  - CRON job handler for monthly payouts
  - Features: Creator account validation, transfer metadata, error handling

### Database Schema ✅
- ✅ `referrals` table — Referral tracking with conversion states
- ✅ `cohortTracking` table — User cohort retention metrics
- ✅ `churnTracking` table — At-risk user detection
- ✅ `payoutRuns` table — Stripe transfer history
- ✅ `users` table extended with `accountCreditsCents`, `trialExtendedDays`
- ✅ All Drizzle ORM relations configured with proper indexes

---

## Required Configuration for Production

### 1. Database Migration

**Required**: Run database migration to create Phase 4 tables

```bash
cd /workspaces/videoking
pnpm db:migrate
```

This will execute:
- `packages/db/src/migrations/0001_parallel_mephistopheles.sql`

**Creates tables**:
- `referrals` — User referral program data
- `cohort_tracking` — Daily cohort retention metrics
- `churn_tracking` — At-risk user snapshots
- `payout_runs` — Stripe transfer records

**Modifies**:
- `users` table (adds `account_credits_cents`, `trial_extended_days`)

---

### 2. Cloudflare Secrets Configuration

**Required**: Set the following secrets in Cloudflare Workers dashboard

```bash
# Run these commands:
wrangler secret put BETTER_AUTH_SECRET
wrangler secret put STRIPE_SECRET_KEY
wrangler secret put STRIPE_WEBHOOK_SECRET
wrangler secret put STREAM_API_TOKEN
```

**Environment Values** (set via `wrangler secret put`):
- `BETTER_AUTH_SECRET` — Random 32+ character string for BetterAuth signing
- `STRIPE_SECRET_KEY` — Your Stripe API secret key (sk_...)
- `STRIPE_WEBHOOK_SECRET` — Your Stripe webhook signing secret (whsec_...)
- `STREAM_API_TOKEN` — Your Cloudflare Stream API token

---

### 3. Cloudflare Variables Configuration

**Required**: Set Phase 4-specific variables in `wrangler.toml` or via dashboard

Update `apps/worker/wrangler.toml` [vars] section:

```toml
[vars]
# Stripe
STRIPE_CONNECT_CLIENT_ID = "ca_XXXXXXXXX"  # Your Stripe Connect client ID

# Cloudflare Stream
STREAM_ACCOUNT_ID = "ac_XXXXXXXXX"
STREAM_CUSTOMER_DOMAIN = "customer-abc123"

# Stripe Plans (update with your actual price IDs)
STRIPE_CITIZEN_MONTHLY_PRICE = "price_xxxxxxxxx"
STRIPE_CITIZEN_ANNUAL_PRICE = "price_xxxxxxxxx"
STRIPE_VIP_MONTHLY_PRICE = "price_xxxxxxxxx"
STRIPE_VIP_ANNUAL_PRICE = "price_xxxxxxxxx"

# Platform Fee
PLATFORM_FEE_PERCENT = "20"

# Frontend URL (for Stripe/BetterAuth redirects)
APP_BASE_URL = "https://yourdomain.com"

# Chat Rate Limits (milliseconds between messages)
CHAT_RATE_LIMIT_FREE_MS = "10000"
CHAT_RATE_LIMIT_CITIZEN_MS = "1000"
CHAT_RATE_LIMIT_VIP_MS = "500"

# Trial Settings
TRIAL_PERIOD_DAYS = "14"
```

---

### 4. Stripe Connect OAuth Setup

**For Creator Payout System to Work**:

1. Create Stripe Connect Express account (or use existing)
2. Get your **Stripe Connect Client ID** from Stripe dashboard
3. Add `STRIPE_CONNECT_CLIENT_ID` to wrangler.toml vars
4. Configure OAuth redirect URI in Stripe dashboard:
   ```
   https://yourdomain.com/api/stripe/connect/callback
   ```

---

### 5. Deployment Steps

#### Step 1: Deploy Worker
```bash
cd apps/worker
pnpm deploy
```

#### Step 2: Deploy Web Frontend
```bash
cd apps/web
pnpm build:pages
pnpm deploy
```

#### Step 3: Migrate Database
```bash
cd packages/db
pnpm db:migrate
```

#### Step 4: Verify Deployment
```bash
# Test referral endpoint
curl -X POST https://api.yourdomain.com/api/referrals/create \
  -H "Authorization: Bearer <session_token>" \
  -H "Content-Type: application/json"

# Test analytics endpoint (admin-only)
curl https://api.yourdomain.com/api/admin/analytics/cohorts \
  -H "Authorization: Bearer <admin_session_token>"
```

---

## Testing Checklist

### Unit Tests
- ✅ Phase 4 API tests exist in `test/phase4-api.test.ts`
- Run with: `pnpm test`

### Integration Tests - Manual

**Referral System**:
- [ ] Create referral code
- [ ] Retrieve user's referral link
- [ ] View referral stats
- [ ] Apply referral code on signup (validates 90-day expiration)

**Analytics System** (admin-only):
- [ ] Get cohort retention data
- [ ] Get churn metrics
- [ ] Get conversion funnel
- [ ] Get ARPU breakdown

**Payout System**:
- [ ] Creator can link Stripe Connect account (OAuth flow)
- [ ] Creator account status shows payouts enabled
- [ ] Monthly payout CRON triggers and creates transfers
- [ ] Transfer webhook updates payout status

---

## Monitoring & Alerts

### Phase 4 Critical Metrics

**Referral System**:
- Track referral code generation rate
- Monitor referral conversion rates
- Alert on trial bonus application failures

**Analytics System**:
- Monitor admin query performance
- Track cohort aggregation query times
- Alert on analytics data staleness

**Payout Engine**:
- Monitor monthly payout job completion
- Track failed transfer attempts
- Alert on Stripe account validation failures
- Monitor webhook processing lag

### Log Targets

Configure application logging to send to:
- Cloudflare Workers Analytics
- DataDog or similar APM
- Sentry for error tracking

---

## Rollback Plan

If Phase 4 deployment has issues:

### Quick Rollback (< 5 minutes)
1. Revert to previous Worker deployment:
   ```bash
   wrangler deployments list
   wrangler deployments rollback <deployment-id>
   ```

2. Revert web frontend:
   ```bash
   cd apps/web
   wrangler pages deployments list
   wrangler pages rollback  # Or deploy previous version
   ```

### Database Rollback
If migration fails or causes issues:
- Keep database backup before running migration
- Migration is additive only (creates new tables, doesn't drop existing)
- If needed, drop Phase 4 tables manually:
  ```sql
  DROP TABLE IF EXISTS payout_runs;
  DROP TABLE IF EXISTS churn_tracking;
  DROP TABLE IF EXISTS cohort_tracking;
  DROP TABLE IF EXISTS referrals;
  ALTER TABLE users DROP COLUMN IF EXISTS account_credits_cents, trial_extended_days;
  ```

---

## Success Criteria

Phase 4 deployment is successful when:

- ✅ Worker deployment completes without errors
- ✅ Web frontend deployment completes without errors
- ✅ Database migration creates all 4 Phase 4 tables
- ✅ All 11 API endpoints respond with 200/401/403 status codes (not 404)
- ✅ Referral endpoints return proper JSON responses
- ✅ Analytics endpoints require admin authentication
- ✅ Payout engine webhook handler processes Stripe events
- ✅ No new errors in application logs
- ✅ Database queries execute within SLA (< 500ms for analytics)
- ✅ Stripe Connect OAuth flow completes successfully

---

## Environmental Summary

| Component | Version | Status |
|-----------|---------|--------|
| Node.js | 20+ | ✅ |
| TypeScript | 5.9.3 | ✅ |
| Hono | Latest | ✅ |
| Drizzle ORM | 0.45+ | ✅ |
| BetterAuth | 1.6.2+ | ✅ |
| Stripe SDK | Latest | ✅ |
| Cloudflare Workers | 2024-09-23 compat | ✅ |
| PostgreSQL (Neon) | 14+ | ✅ |

---

## Contact & Support

For deployment issues:
1. Check Cloudflare Workers dashboard for runtime errors
2. Review database logs in Neon dashboard
3. Check Stripe dashboard for webhook delivery status
4. Review application logs for specific error messages

---

## Post-Deployment Tasks (Phase 5)

**After Phase 4 is stable**:
- [ ] Monitor referral program conversion rates (target: 15%+)
- [ ] Monitor creator payout completion rate (target: 99%+)
- [ ] Analyze cohort retention trends
- [ ] Implement referral marketing campaign
- [ ] Onboard creators for Stripe Connect
- [ ] Start Phase 5 work (see PRODUCT_PLAN.md)

---

**Production deployment checklist prepared**: 2026-04-14  
**Ready to deploy**: ✅ YES
