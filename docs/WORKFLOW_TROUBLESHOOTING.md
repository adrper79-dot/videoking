# GitHub Actions Workflow Troubleshooting Guide

**Last Updated:** April 14, 2026  
**Status:** Workflow issues identified and fixed

---

## 🔴 Issue: All Workflow Runs Failed

### Root Cause
**The GitHub Actions workflow was configured to use Node.js 18, but Wrangler requires Node.js 20+.**

This caused every workflow run to fail at the "Build Worker" step with:
```
Wrangler requires at least Node.js v20.0.0. You are using v18.20.8.
```

### Why It Went Undetected
- The workflow was never manually tested before being committed
- No pre-push validation checked the Node.js version requirement
- The master branch received commits that all failed silently

### Solution Applied
✅ **FIXED** in commit `9e1189b`
- Updated `.github/workflows/deploy.yml` line 18: `node-version: [18]` → `node-version: [20]`

---

## 🟡 Issue: Pages Deployment Fails (Project Not Found)

### Error Message
```
✘ [ERROR] A request to the Cloudflare API failed.
Project not found. The specified project name does not match any of your existing projects. [code: 8000007]
```

### Root Cause
The Cloudflare Pages project `nichestream-web` either:
1. **Hasn't been created yet** in your Cloudflare account
2. **Belongs to a different account** than your credentials point to
3. **Was deleted** from the account

### Solution Path A: Create the Project Manually (Recommended First)

1. **Go to Cloudflare Dashboard**
   - https://dash.cloudflare.com

2. **Navigate to Pages**
   - Left sidebar → **Pages**

3. **Create a new project**
   - Click **"Create a project"**
   - **Project name:** `nichestream-web`
   - **Production branch:** `main`
   - Click **"Create project"**

4. **Disable auto-build** (Important!)
   - Go to **Settings** → **Builds & deployments**
   - **Build command:** Leave empty
   - **Build output directory:** Leave empty
   - Save changes

   > Why? Your builds run in GitHub Actions. Cloudflare auto-build will conflict because it can't find `pnpm` dependencies.

5. **Re-run the workflow**
   - Go to GitHub → **Actions**
   - Find the failed workflow run
   - Click the **"Re-run"** button

### Solution Path B: Verify Your Credentials

If you created the project but it's still failing:

1. **Check that your GitHub secrets are correct**
   - Go to GitHub repo → **Settings** → **Secrets and variables** → **Actions**
   - Verify `CLOUDFLARE_ACCOUNT_ID` matches your account
   - Verify `CLOUDFLARE_API_TOKEN` is valid and has correct permissions

2. **Verify the token has Pages permissions**
   - Go to Cloudflare → **My Profile** → **API Tokens**
   - Find your token and verify it includes:
     - ✓ `Account.Pages`
     - ✓ `User.Read`
     - ✓ `Account.Read`

3. **If token expired or invalid:**
   - Create a new token with required permissions
   - Update `CLOUDFLARE_API_TOKEN` secret in GitHub

### Solution Path C: Make Pages Deployment Non-Blocking

If you want the workflow to succeed even if Pages deployment fails:

1. **Current behavior** (after commit `5c8c3e6`):
   - Worker deployment is required to succeed
   - Pages deployment can fail without breaking the workflow
   - You can deploy Pages manually later

This is recommended during setup while you configure the Pages project.

---

## ✅ Verification Checklist

### Pre-Deployment
- [ ] Node.js 20+ is specified in workflow (verified: ✅)
- [ ] GitHub secrets configured:
  - [ ] `CLOUDFLARE_API_TOKEN`
  - [ ] `CLOUDFLARE_ACCOUNT_ID`
  - [ ] All other required secrets
- [ ] Cloudflare Pages project `nichestream-web` created
- [ ] Auto-build disabled in Pages project settings

### After Commit (When Workflow Runs)
- [ ] Dependency installation succeeds
- [ ] Type checking passes (0 errors)
- [ ] Worker builds successfully
- [ ] Web pages build successfully
- [ ] ✓ Worker deploys to Cloudflare (required)
- [ ] ✓ Pages deployment optional (can be done manually)

### Live Site Verification
After successful deployment:
```bash
# Worker API
curl https://api.nichestream.tv/health

# Pages (once project is created and deployed)
curl https://nichestream-web.pages.dev
```

---

## Common Issues & Fixes

### Issue: "Type check fails with errors"
**Solution:** Run locally first
```bash
cd /workspaces/videoking
pnpm typecheck
```
Fix any TypeScript errors before pushing.

### Issue: "pnpm install fails"
**Solution:** Ensure lock file is committed
```bash
git status | grep pnpm-lock.yaml
# If not present, run: pnpm install
```

### Issue: "Build Worker step fails (non-Node.js related)"
**Steps to debug:**
1. Check the full error output in GitHub Actions
2. Verify `HYPERDRIVE_ID` is set correctly (if using database)
3. Run build locally:
   ```bash
   cd apps/worker
   pnpm build
   ```

### Issue: "wrangler: command not found"
**Solution:** This means Node.js is still 18 or pnpm dependencies aren't installed
- Verify `.github/workflows/deploy.yml` shows `node-version: [20]` ✅
- Ensure `pnpm install` step runs before build steps

---

## How to Prevent This in the Future

### 1. Pre-Push Validation
Add a local check before pushing:
```bash
# Check Node.js requirements
node --version  # Should be v20.0.0 or higher

# Type check locally
pnpm typecheck

# Build locally
pnpm build:web && pnpm build:worker
```

### 2. Workflow Monitoring
- Watch GitHub Actions after pushing
- Don't assume workflows pass silently
- Set up Slack/email notifications for failures

### 3. Documentation
Keep workflow requirements documented (like this file!)

---

## Manual Deployment (Alternative)

If GitHub Actions continues to have issues:

```bash
# Build everything
pnpm build:web
cd apps/worker && pnpm build && cd ../..

# Login to Cloudflare
cd apps/worker
pnpm exec wrangler login

# Deploy Worker
pnpm exec wrangler deploy

# Deploy Pages (if project exists)
cd ../web
pnpm exec wrangler pages deploy .vercel/output/static
```

---

## Resource Links
- [Wrangler Documentation](https://developers.cloudflare.com/workers/wrangler/)
- [Cloudflare Pages Guide](https://developers.cloudflare.com/pages/)
- [GitHub Actions Docs](https://docs.github.com/en/actions)
- Repository Actions: https://github.com/adrper79-dot/videoking/actions
