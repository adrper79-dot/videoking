# Cloudflare Account Setup — Missing Pieces

**Date:** April 14, 2026  
**Status:** Worker deployed, Pages not deployed, domain routing not configured  

---

## Current Situation

### ✅ What's Deployed
- **Worker:** `nichestream-api.adrper79.workers.dev` ✓
  - All bindings configured: Hyperdrive, R2, Durable Objects
  - Running code: uploaded successfully
  
### ❌ What's Missing
1. **Pages Project** — doesn't exist in Cloudflare account
2. **Custom Domain Routing** — not set up
3. **Production Config** — Worker has localhost config instead of production

---

## Why You Don't See Your Site

The Pages project "nichestream-web" doesn't exist in your Cloudflare account. When Wrangler tries to deploy, it fails with:
```
Project not found. The specified project name does not match any of your existing projects. [code: 8000007]
```

This means:
- GitHub Actions tried to upload your built files
- Cloudflare API said "I don't have a project with that name"
- Nothing was deployed

---

## Setup Instructions (3 Steps)

### STEP 1: Create Pages Project in Cloudflare Dashboard

**Navigate to:**
1. Go to https://dash.cloudflare.com
2. Left sidebar → **Pages**
3. Click **"Create a project"**

**Configure:**
- **Project name:** `nichestream-web`
- **Deploy method:** `Direct upload` (since GitHub Actions does the building)
- Click **Create project**

**In the Pages project settings:**
1. Go to **Settings** → **Builds & deployments**
2. **Build command:** Leave empty (GitHub Actions handles builds)
3. **Build output directory:** Leave empty
4. **Save changes**

Why? Your GitHub Actions workflow builds the site and uploads directly. You don't want Cloudflare Pages trying to build it too.

### STEP 2: Fix Worker Production Configuration

You currently have this in `apps/worker/wrangler.toml`:
```
APP_BASE_URL = "http://localhost:3000"
```

This needs to be the **production domain** where your Pages frontend will be hosted.

**Questions to answer:**
1. Do you have a domain registered with Cloudflare? (e.g., `nichestream.tv`?)
2. If yes, is it already added to your Cloudflare account?
3. Or are you using a temporary domain for testing?

**Once you know your domain:**
- Update `apps/worker/wrangler.toml`:
```toml
APP_BASE_URL = "https://your-domain.com"  # Change this
```

- Then commit and push:
```bash
git add apps/worker/wrangler.toml
git commit -m "config: Update APP_BASE_URL to production domain"
git push
```

The workflow will automatically redeploy the Worker with the correct configuration.

### STEP 3: Configure Custom Domains (Once You Have a Domain)

**For Pages:**
1. Go to Cloudflare Dashboard → Pages → nichestream-web
2. **Custom domains**
3. Add your domain (e.g., `nichestream.tv`)

**For Worker:**
1. Go to Cloudflare Dashboard → Workers → nichestream-api
2. **Settings** → **Custom domains**
3. Add your API subdomain (e.g., `api.nichestream.tv`)

---

## What You Need From Your Cloudflare Account

To complete setup, I need to know:

1. **Do you have `nichestream.tv` (or similar) domain in Cloudflare?**
   - Yes → Great! What's the exact domain?
   - No → What domain should we use? Do you need to register one?

2. **Does your Cloudflare account have:**
   - Stripe integration (for payments)?
   - Cloudflare Stream (for video)?
   - Cloudflare R2 (for file storage)?
   
   If yes, the credentials for these are needed in the secrets.

3. **Verify your GitHub Secrets are set correctly:**
   - `CLOUDFLARE_ACCOUNT_ID` — your account ID (found in Cloudflare dashboard top-right)
   - `CLOUDFLARE_API_TOKEN` — API token with Pages and Workers permissions

---

## Quick Verification

To check if your Pages project now exists, after creating it, run:
```bash
curl https://nichestream-web.pages.dev
```

If you see your site → Success! ✓
If you get 404 or connection refused → Still building or not deployed

Once Pages project is created, GitHub Actions will automatically deploy to it on the next push.

---

## Next Steps

**For now:**
1. Create the Pages project in Cloudflare (STEP 1 above)
2. Confirm what domain you're using (STEP 2 question)
3. Let me know, and I'll update the configuration

**After that:**
- Push the updated Worker config
- GitHub Actions will deploy
- Your site should be live!

---

## Troubleshooting

**"Pages deployment still fails after creating project"**
→ Run workflow again: GitHub → Actions → Latest run → Re-run all jobs

**"I see the Pages project but it's blank"**
→ Wait a few minutes, Pages deployment takes 2-3 minutes
→ Check GitHub Actions logs for deployment status

**"Worker is working but Pages isn't"**
→ Make sure custom domain is set up (Step 3)
→ Pages might be deploying to: `nichestream-web.pages.dev` (temporary URL)
→ Custom domain (`nichestream.tv`) might take 5-10 minutes to work

**"Getting CORS errors"**
→ Worker needs `APP_BASE_URL` set to your actual domain
→ Frontend must match that domain exactly
→ Update config in STEP 2 and redeploy
