# Pre-Deployment Checklist — Phase 3a

**Date:** April 13, 2026  
**Milestone:** 3a (Ad Event Logging)  

---

## Code Quality ✅

- [x] All TypeScript strict mode checks passing
- [x] Worker routes compile without errors
- [x] Frontend components integrate ad logging
- [x] Database schema created and indexed
- [x] No console errors or warnings in build

## Database Ready ✅

- [x] `ad_events` table schema defined (`packages/db/src/schema/ads.ts`)
- [x] Migration file created (`packages/db/src/migrations/0003_phase3_ad_events.sql`)
- [x] Indexes on creator_id, video_id, impression_at ready
- [x] Earnings table updated with ad_event_id column
- [x] Users table updated with frequency capping columns

## API Endpoints ✅

- [x] `POST /api/ads/log-event` — Fire-and-forget logging
- [x] `GET /api/ads/metrics/:creatorId` — Analytics query
- [x] Wired into Worker index.ts
- [x] Error handling and validation in place

## Frontend Integration ✅

- [x] `logAdImpression()` function in `lib/api.ts`
- [x] VideoPlayer accepts `showAds` and `creatorId` props
- [x] Ad logging fires after 1s (non-blocking)
- [x] Integrated with entitlements context

## Security ✅

- [x] CORS allowlist verified
- [x] No secrets in code (use .dev.vars)
- [x] API validation on request body
- [x] Secrets gitignored

## Configuration ✅

- [x] `wrangler.toml` has all required env vars listed
- [x] `.dev.vars.example` created with templates
- [x] `.env.local.example` created for frontend
- [x] APP_BASE_URL configured

## Testing ✅

- [x] TypeScript compilation clean
- [x] No lint errors
- [x] Schema exports correctly

---

## Deployment Runbook

### Phase 1: Authenticate
```bash
cd apps/worker
pnpm exec wrangler login
# OR
export CLOUDFLARE_API_TOKEN="token"
```

### Phase 2: Set Secrets
```bash
pnpm exec wrangler secret put BETTER_AUTH_SECRET
pnpm exec wrangler secret put STRIPE_SECRET_KEY
pnpm exec wrangler secret put STRIPE_WEBHOOK_SECRET
pnpm exec wrangler secret put STREAM_API_TOKEN
pnpm exec wrangler secret put HYPERDRIVE_ID
```

### Phase 3: Deploy Worker
```bash
cd apps/worker
pnpm exec wrangler deploy
```

### Phase 4: Deploy Pages
```bash
cd apps/web
pnpm build:pages
pnpm exec wrangler pages deploy dist
```

### Phase 5: Verify Endpoints
```bash
# Worker health
curl https://nichestream-worker.account.workers.dev/health

# Ad logging
curl -X POST https://nichestream-worker.account.workers.dev/api/ads/log-event \
  -H "Content-Type: application/json" \
  -d '{"videoId":"test","creatorId":"test","adNetwork":"test"}'

# Pages frontend
curl https://your-project.pages.dev
```

---

## Go/No-Go Decision

| Criterion | Status | Notes |
|---|---|---|
| Code quality | ✅ GO | TypeScript strict, zero errors |
| API completeness | ✅ GO | Both endpoints implemented |
| Database ready | ✅ GO | Schema + migration ready |
| Frontend integration | ✅ GO | VideoPlayer wired |
| Security | ✅ GO | Secrets gitignored, CORS verified |
| Documentation | ✅ GO | Deployment guide created |

**Status: ✅ READY FOR DEPLOYMENT**

---

## Post-Deployment Tasks

1. **Monitor ad events:**
   - Check database for incoming ad impressions
   - Verify `/api/ads/metrics/:creatorId` returns data

2. **Test crawl:**
   - Watch any video with `showAds=true` flag
   - Confirm logs appear in ad_events table after 1s

3. **Dashboard readiness:**
   - Prep Milestone 3b: revenue attribution job
   - Plan for Monday feature release

---

## Rollback Plan

If issues arise:

```bash
# Worker
cd apps/worker && pnpm exec wrangler rollback

# Pages
cd apps/web && pnpm exec wrangler pages deployments rollback
```

---

**Ready to deploy! 🚀**
