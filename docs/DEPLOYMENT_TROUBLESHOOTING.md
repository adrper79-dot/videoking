# Deployment Troubleshooting Guide

## Current Status: April 13, 2026

All code is ready for deployment. Infrastructure setup needed: **Get and set your Hyperdrive ID**

## GitHub Actions Deployment Progress

### ✅ Fixed Issues
- **Run #1-3:** pnpm installation ordering — FIXED (commit 247ac04)
- **Run #4:** Cloudflare API authentication token permissions — FIXED (update GitHub Secret with proper token)
- **Run #5:** Hyperdrive ID placeholder discovered — In progress

### ⏳ Current Blocker: Missing Hyperdrive ID

**Error Code:** 10156  
**Error Message:** `Invalid hyperdrive database ID 'YOUR_HYPERDRIVE_ID'. It must be a valid UUID.`

**Status:** Waiting for user to provide Hyperdrive ID from Cloudflare

---

## How to Resolve

### Step 1: Get Your Hyperdrive ID from Cloudflare

1. Go to [Cloudflare Dashboard](https://dash.cloudflare.com/)
2. In the left sidebar, click **Workers & Pages**
3. Click **Hyperdrive** in the submenu
4. You should see your database configuration (created during Phase 1 setup)
   - If you don't have one, you need to create it:
     - Click "Create Hyperdrive" 
     - Choose "Neon" as database type
     - Use your Neon PostgreSQL connection string
     - Name it: `nichestream-db` or similar
     - Click "Create and bind"
5. Click on your Hyperdrive config to view details
6. **Copy the ID** — it looks like: `a1b2c3d4-e5f6-7890-abcd-ef1234567890`

### Step 2: Add HYPERDRIVE_ID to GitHub Secrets

1. Go to your GitHub repo: [videoking](https://github.com/adrper79-dot/videoking)
2. Click **Settings** tab (top right)
3. In left sidebar, click **Secrets and variables** → **Actions**
4. Click **New repository secret** (green button, top right)
5. Fill in:
   - **Name:** `HYPERDRIVE_ID`
   - **Value:** (paste the ID you copied from Cloudflare Dashboard)
6. Click **Add secret**

### Step 3: Trigger Redeployment

Once the secret is added, the next push will automatically trigger GitHub Actions with the correct Hyperdrive ID:

```bash
cd /workspaces/videoking
git commit --allow-empty -m "chore: trigger redeployment with Hyperdrive ID configured"
git push origin main
```

Or make any code change and push normally.

---

## Verification Checklist

After deployment completes, verify:

- [ ] GitHub Actions run succeeded (all green checkmarks)
- [ ] Worker deployed to Cloudflare Workers (check [Cloudflare Workers Dashboard](https://dash.cloudflare.com/?to=/:account/workers))
- [ ] Pages deployed to Cloudflare Pages (check [Cloudflare Pages Dashboard](https://dash.cloudflare.com/?to=/:account/pages))
- [ ] Worker is accessible: `curl https://YOUR_ACCOUNT.workers.dev/health`
- [ ] Pages is accessible: Visit your Pages domain
- [ ] Database connection works (check Hyperdrive logs in Cloudflare dashboard)

---

## GitHub Secrets Reference

All required GitHub Secrets are currently configured:

| Secret Name | Status | Used For |
|---|---|---|
| `CLOUDFLARE_API_TOKEN` | ✅ Set | Authenticate to Cloudflare API |
| `CLOUDFLARE_ACCOUNT_ID` | ✅ Set | Identify your Cloudflare account |
| `HYPERDRIVE_ID` | ⏳ **NEEDED** | Database access (Neon PostgreSQL) |
| `BETTER_AUTH_SECRET` | ✅ Set | BetterAuth session encryption |
| `STRIPE_SECRET_KEY` | ✅ Set | Stripe payments API |
| `STRIPE_WEBHOOK_SECRET` | ✅ Set | Stripe webhook verification |
| `STREAM_API_TOKEN` | ✅ Set | Cloudflare Stream (video hosting) |
| `STREAM_ACCOUNT_ID` | ✅ Set | Cloudflare Stream account |

---

## Build Pipeline Status

All build steps currently pass:

- ✅ `pnpm install` — 247 packages installed
- ✅ `pnpm typecheck` — All 4 packages pass TypeScript strict mode
- ✅ Worker build — `wrangler deploy --dry-run` generates valid Worker (461 KB gzipped)
- ✅ Pages build — Next.js 15 builds correctly
  - 10 prerendered routes
  - 7 edge function routes configured with `export const runtime = 'edge'`

**Blocker:** Worker deployment halts at `pnpm wrangler deploy` due to missing Hyperdrive ID in config.

---

## Deployment Architecture

### GitHub Actions Workflow

**Location:** `.github/workflows/deploy.yml`

**Steps:**
1. Checkout code
2. Install pnpm (v9.0.0)
3. Setup Node.js (v18)
4. Install dependencies
5. TypeScript type checking
6. Build Worker (dry-run)
7. Build Pages (Next.js + Cloudflare adapter)
8. **Deploy Worker to Cloudflare** ← Currently blocked here
9. Deploy Pages to Cloudflare
10. Notify on success/failure

### Deployment Targets

- **Worker:** Cloudflare Workers (API backend)
- **Pages:** Cloudflare Pages (Next.js frontend)
- **Database:** Neon PostgreSQL (via Cloudflare Hyperdrive)

---

## Next Steps After Deployment

Once deployment succeeds:

1. **Apply database migrations:**
   ```bash
   cd /workspaces/videoking
   pnpm db:migrate
   ```

2. **Verify Worker health check:**
   ```bash
   curl https://YOUR_ACCOUNT.workers.dev/health
   ```

3. **Test login flow:**
   - Visit your Pages domain
   - Try signing in
   - Verify session is created in database

4. **Begin Phase 3b:**
   - Monthly ad revenue attribution job
   - Creator dashboard metrics

---

## Debugging Tips

If deployment fails again:

1. Check GitHub Actions logs: https://github.com/adrper79-dot/videoking/actions
2. Look for specific error in the "Deploy Worker to Cloudflare" step
3. Verify all GitHub Secrets are set correctly (Settings → Secrets and variables → Actions)
4. Check Cloudflare dashboard for API errors
5. Verify Hyperdrive database is running in Cloudflare dashboard

---

## Contact / Support

If you encounter issues during deployment:
1. Check the GitHub Actions logs for the exact error
2. Verify all secrets are set in GitHub Actions settings
3. Verify Hyperdrive database exists and is running in Cloudflare dashboard
4. Try pushing again to trigger a fresh deployment

Reference commit: `d2fc6c2` (latest with sed-based substitution for Hyperdrive ID)
