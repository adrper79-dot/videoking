# 🚀 Fix: 404 Error on Cloudflare Pages Deployment

## Problem

Your site URL `https://3962ce73.videoking.pages.dev/` returns **404 Not Found**.

**Root Cause:** This is a **deployment preview URL**, not your production URL. The hash (`3962ce73`) is a unique preview ID, which means:

1. Either the deployment was partial/incomplete
2. Or you're viewing a preview build instead of the main production deployment

## Solution: Proper Deployment

### Prerequisites
You need:
- **Cloudflare API Token** (create at https://dash.cloudflare.com/profile/api-tokens)
- **Cloudflare Account ID** (find at https://dash.cloudflare.com/login)

### Step 1: Set Up Credentials

```bash
export CLOUDFLARE_API_TOKEN="your-token-here"
export CLOUDFLARE_ACCOUNT_ID="your-account-id-here"
```

### Step 2: Deploy the Web App

```bash
cd /workspaces/videoking/apps/web

# This builds for Cloudflare Pages and deploys
pnpm deploy
```

**What this does:**
1. Runs `@cloudflare/next-on-pages` to optimize for edge runtime
2. Deploys `.vercel/output/static/` to Cloudflare Pages
3. Creates a production deployment (not a preview)

### Step 3: Find Your Production URL

After deployment completes, you'll see output like:
```
✨ Deployment successful!
🔗 https://nichestream-web.pages.dev  (or your custom domain)
```

This is your **production URL** (different from the preview URL).

---

## Alternative: GitHub Actions Auto-Deploy

Set up automatic deployment on every push:

### 1. Create GitHub Secrets

Go to your repo settings → **Secrets and variables** → **Actions**

Add:
- `CLOUDFLARE_API_TOKEN` = your API token
- `CLOUDFLARE_ACCOUNT_ID` = your account ID

### 2. Create Deployment Workflow

Create `.github/workflows/deploy-pages.yml`:

```yaml
name: Deploy to Cloudflare Pages

on:
  push:
    branches: [main]
    paths: ['apps/web/**']

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      
      - uses: pnpm/action-setup@v2
        with:
          version: 9
      
      - uses: actions/setup-node@v3
        with:
          node-version: '20'
          cache: 'pnpm'
      
      - run: pnpm install
      
      - run: cd apps/web && pnpm build:pages
      
      - name: Deploy to Cloudflare Pages
        run: cd apps/web && npx wrangler pages deploy .vercel/output/static
        env:
          CLOUDFLARE_API_TOKEN: ${{ secrets.CLOUDFLARE_API_TOKEN }}
          CLOUDFLARE_ACCOUNT_ID: ${{ secrets.CLOUDFLARE_ACCOUNT_ID }}
```

Now every push to `main` auto-deploys your site!

---

## Verify Deployment

After deploying, visit:
- Your production URL (will be provided in deployment output)
- Should show NicheStream homepage with Trending Now section

If still getting 404:
1. Check that `.vercel/output/static/index.html` exists (it does ✅)
2. Verify Cloudflare project name matches `wrangler.toml` name
3. Check deployment logs in Cloudflare Dashboard → Pages

---

## Current State

✅ **Built**: Next.js app compiled to static files  
✅ **Ready**: `.vercel/output/static/` contains all HTML/CSS/JS  
❌ **Not Deployed**: Files haven't been uploaded to production  
⏳ **Next**: Run `pnpm deploy` with credentials

---

Generated: April 14, 2026
