# Deployment Guide — Phase 3a Ready

**Last Updated:** April 13, 2026  
**Status:** Worker and Pages ready for deployment  
**Recommended:** Use GitHub Secrets + GitHub Actions (automated)

---

## Quick Start (Recommended: GitHub Actions)

### 1. Add GitHub Secrets
See [GITHUB_SECRETS_SETUP.md](./GITHUB_SECRETS_SETUP.md) for complete instructions.

### 2. Secrets Required
```
CLOUDFLARE_API_TOKEN
CLOUDFLARE_ACCOUNT_ID
BETTER_AUTH_SECRET
STRIPE_SECRET_KEY
STRIPE_WEBHOOK_SECRET
STREAM_API_TOKEN
STREAM_ACCOUNT_ID
HYPERDRIVE_ID
```

### 3. Push to main
```bash
git push origin main
```

**That's it!** GitHub Actions will automatically:
- ✅ Type check
- ✅ Build Worker + Pages
- ✅ Deploy to Cloudflare
- ✅ Notify on success/failure

Check progress: https://github.com/adrper79-dot/videoking/actions

---

## Manual Deployment (Alternative)

If you prefer not to use GitHub Actions:

### Step 1: Authenticate with Cloudflare
```bash
cd apps/worker
pnpm exec wrangler login
```

### Step 2: Set Secrets
```bash
cd apps/worker

pnpm exec wrangler secret put BETTER_AUTH_SECRET
pnpm exec wrangler secret put STRIPE_SECRET_KEY
pnpm exec wrangler secret put STRIPE_WEBHOOK_SECRET
pnpm exec wrangler secret put STREAM_API_TOKEN
pnpm exec wrangler secret put HYPERDRIVE_ID
```

### Step 3: Deploy Worker

```bash
cd apps/worker
pnpm exec wrangler deploy
```

**Output should show:**
```
✓ Uploaded nichestream-worker (v1.0.0)
✓ Published to https://nichestream-worker.your-account.workers.dev
```

## Step 4: Deploy Pages (Frontend)

```bash
cd apps/web

# Build
pnpm build:pages

# Deploy
pnpm exec wrangler pages deploy dist
```

**Output should show:**
```
✓ Deployment complete. 
✓ Project URL: https://your-project.pages.dev
```

## Step 5: Configure Environment Variables

### Frontend (.env variables)
Set in Cloudflare Pages dashboard:

```
NEXT_PUBLIC_API_URL=https://nichestream-worker.your-account.workers.dev
NEXT_PUBLIC_APP_URL=https://your-project.pages.dev
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_live_...
```

### Worker (wrangler.toml)
Already configured. Verify:
```bash
cat apps/worker/wrangler.toml | grep vars
```

## Verification

### Check Worker health:
```bash
curl https://nichestream-worker.your-account.workers.dev/health
# Expected: {"status":"ok","ts":1234567890}
```

### Check ad logging endpoint:
```bash
curl -X POST https://nichestream-worker.your-account.workers.dev/api/ads/log-event \
  -H "Content-Type: application/json" \
  -d '{
    "videoId":"test-video",
    "creatorId":"test-creator",
    "adNetwork":"test"
  }'
# Expected: {"logged":true}
```

### Check Pages frontend:
```bash
curl https://your-project.pages.dev
# Should return HTML (status 200)
```

## Rollback (if needed)

### Rollback Worker
```bash
cd apps/worker
pnpm exec wrangler rollback
```

### Rollback Pages
```bash
cd apps/web
pnpm exec wrangler pages deployments list
pnpm exec wrangler pages deployments rollback --message "Rollback from bad deploy"
```

## Troubleshooting

| Issue | Solution |
|---|---|
| "Not authenticated" | Run `pnpm exec wrangler login` or set `CLOUDFLARE_API_TOKEN` |
| "Project not found" | Verify `account_id` in `wrangler.toml` matches your account |
| "Secrets not set" | Use `pnpm exec wrangler secret put KEY` to configure |
| 500 errors on API calls | Check `HYPERDRIVE_ID` and database connection via `wrangler tail` |
| Pages build fails | Verify `next.config.ts` has `output: 'export'` for static export |

## View Logs

### Worker logs (real-time)
```bash
cd apps/worker
pnpm exec wrangler tail
```

### Pages build logs
```bash
cd apps/web
pnpm exec wrangler pages deployment list
pnpm exec wrangler pages deployment info --deployment-id=<id>
```

## Phase 3a Status

✅ Code deployed: `/api/ads/log-event` and `/api/ads/metrics/:creatorId` endpoints live  
✅ VideoPlayer auto-logging: Ad impressions logged on video render (when `showAds=true`)  
✅ Database: `ad_events` table ready to receive impressions  
✅ Frontend: `logAdImpression()` function active  

Next: Monitor ad logs and prep Milestone 3b (revenue attribution).
