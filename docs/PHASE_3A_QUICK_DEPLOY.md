# Phase 3a — Quick Deploy Reference

**Status:** ✅ Ready to Deploy  
**Milestone:** Ad Event Logging  
**Date:** April 13, 2026

---

## What's Deployed

### Endpoints (Live after deployment)
- `POST /api/ads/log-event` — Log ad impressions
- `GET /api/ads/metrics/:creatorId` — Get creator ad stats

### Database (Run migration first)
- `ad_events` table → stores impressions
- Indexes on: creator_id, video_id, impression_at

### Frontend
- VideoPlayer auto-logs ads when `showAds=true`
- `creatorId` required to attribute impressions

---

## Deploy Steps

```bash
# 1. Enter worker dir
cd apps/worker

# 2. Login to Cloudflare
pnpm exec wrangler login

# 3. Set secrets (interactive)
pnpm exec wrangler secret put BETTER_AUTH_SECRET
pnpm exec wrangler secret put STRIPE_SECRET_KEY
pnpm exec wrangler secret put STRIPE_WEBHOOK_SECRET
pnpm exec wrangler secret put STREAM_API_TOKEN
pnpm exec wrangler secret put HYPERDRIVE_ID

# 4. Deploy worker
pnpm exec wrangler deploy

# 5. Deploy frontend
cd ../web
pnpm build:pages
pnpm exec wrangler pages deploy dist
```

---

## Verify It Works

```bash
# Health check
curl https://nichestream-worker.account.workers.dev/health

# Test ad logging
curl -X POST https://nichestream-worker.account.workers.dev/api/ads/log-event \
  -H "Content-Type: application/json" \
  -d '{"videoId":"test","creatorId":"test","adNetwork":"placeholder"}'
# Should return: {"logged":true}
```

---

## Database Migration

Before ads work, run the migration:

```bash
# Local dev
DATABASE_URL="postgres://..." pnpm db:migrate

# Production (if tunneled)
pnpm exec wrangler tail  # Monitor for errors
```

---

## What Happens After Deploy

1. Free users who watch videos get 1 ad impression logged (after 1s delay)
2. Ad events stored in `ad_events` table
3. `/api/ads/metrics/:creatorId` returns stats for dashboard
4. Ready for Milestone 3b (revenue attribution job)

---

## If Something Breaks

```bash
# View worker logs
pnpm exec wrangler tail

# Rollback
pnpm exec wrangler rollback

# Check status
pnpm exec wrangler deployments list
```

---

## Next: Milestone 3b

Monthly ad revenue attribution job processes earnings.  
Target: Next week

---

**All systems ready for launch! 🚀**
