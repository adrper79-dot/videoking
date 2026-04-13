# ⚠️ Worker & Pages Build Failure — Root Cause & Fix

**Date:** April 13, 2026  
**Issue:** Cloudflare Pages auto-build failing with `wrangler: not found`  
**Status:** GitHub Actions deployment ✅ WORKING (ignore Pages auto-build errors)

---

## What's Happening

You're seeing **TWO separate deployments**:

1. ✅ **GitHub Actions** (correct, working)
   - Uses `pnpm install` correctly
   - Builds Worker with wrangler
   - Builds Pages with Next.js
   - Deploys both to Cloudflare

2. ❌ **Cloudflare Pages auto-build** (breaking, should be disabled)
   - Runs when you push to main
   - Uses `bun install` (wrong package manager)
   - Can't find `pnpm-lock.yaml`
   - Worker build fails: `wrangler: not found`
   - **This is not your real deployment**

---

## Why This is Happening

Cloudflare Pages sees a push to main and tries to auto-build. But your project is a pnpm monorepo:
- `pnpm install` installs workspace dependencies
- `bun install` only installs root dependencies
- Without workspace dependencies, `wrangler` CLI isn't available
- Worker build command fails

---

## The Fix: Disable Pages Auto-Build

### Step 1: Go to Cloudflare Dashboard
https://dash.cloudflare.com → Pages → nichestream-web

### Step 2: Find Build Settings
**Pages settings** → **Builds & deployments** → **Build settings**

### Step 3: Disable Auto-Build
- **Build command:** Leave empty (or set to blank)
- **Build output directory:** Remove any value
- Save changes

### Step 4: Verify
Should show: "No build configuration" or similar

---

## Why We're Doing This

Your monorepo deployment happens ONLY via GitHub Actions:

```
You push to main
        ↓
GitHub Actions triggers
        ↓
Uses pnpm install (✅ works with monorepo)
        ↓
Builds Worker + Pages
        ↓
Deploys via wrangler
        ↓
❌ Cloudflare Pages auto-build is disabled (no interference)
        ↓
Live on https://nichestream-web.pages.dev
```

---

## Verify Your Deployment is Working

### Check GitHub Actions Status
https://github.com/adrper79-dot/videoking/actions

Look for the most recent run:
- ✅ Type check passed
- ✅ Build Worker passed
- ✅ Build Pages passed  
- ✅ Deploy Worker passed
- ✅ Deploy Pages passed

### Test Worker API
```bash
curl https://nichestream-worker.YOUR_ACCOUNT.workers.dev/health
# Expected: 200 OK with JSON response
```

### Test Pages Frontend
```bash
curl https://nichestream-web.pages.dev
# Expected: 200 OK with HTML
```

---

## If You See Build Failures in GitHub Actions

If GitHub Actions ALSO fails, check:

1. **Dependencies installed?**
   ```bash
   cd /workspaces/videoking
   pnpm install --frozen-lockfile
   ```

2. **TypeScript compiles?**
   ```bash
   pnpm typecheck
   ```

3. **Worker builds locally?**
   ```bash
   cd apps/worker
   pnpm build
   ```

4. **Pages builds locally?**
   ```bash
   cd apps/web
   pnpm build:pages
   ```

5. **GitHub Secrets configured?**
   - CLOUDFLARE_API_TOKEN
   - CLOUDFLARE_ACCOUNT_ID
   - BETTER_AUTH_SECRET
   - STRIPE_SECRET_KEY
   - STRIPE_WEBHOOK_SECRET
   - STREAM_API_TOKEN
   - STREAM_ACCOUNT_ID
   - HYPERDRIVE_ID

---

## Quick Checklist

- [ ] Disabled Cloudflare Pages auto-build via dashboard
- [ ] GitHub Actions workflow file exists (`.github/workflows/deploy.yml`)
- [ ] GitHub Actions run is green ✅ (check: https://github.com/adrper79-dot/videoking/actions)
- [ ] Worker responds to health check: `curl https://nichestream-worker.*.workers.dev/health`
- [ ] Pages loads: https://nichestream-web.pages.dev

---

## For Next Time: Prevent This

**This pages auto-build will keep failing until disabled.** After you disable it in the dashboard:

```bash
# Push/test normally
git push origin main
# GitHub Actions runs (✅ correct)
# Cloudflare Pages doesn't auto-build (disabled ✅)
# Only GitHub Actions deployment happens
```

---

**TL;DR:** Your real deployment is working via GitHub Actions. Disable Cloudflare Pages auto-build in the dashboard to stop the error messages.
