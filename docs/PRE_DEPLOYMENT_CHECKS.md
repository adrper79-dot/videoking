# Pre-Deployment Quality Checks ✅

## Overview
This document explains how to catch production issues **BEFORE** deployment, using automated checks.

## Issues Fixed

### 1. **Frontend Using localhost:8787 in Production** ❌ → ✅
**Problem:** Browser console errors:
```
localhost:8787/api/notifications: net::ERR_CONNECTION_REFUSED
localhost:8787/api/auth/entitlements: net::ERR_CONNECTION_REFUSED
```

**Root Cause:** `NEXT_PUBLIC_API_URL` environment variable wasn't set during the Next.js build step in GitHub Actions, so it defaulted to `http://localhost:8787` and this hardcoded value got baked into the static HTML/JS files.

**Fix Applied:**
```yaml
# .github/workflows/deploy.yml - Now sets env vars before build
- name: Build Web (Pages)
  env:
    NEXT_PUBLIC_API_URL: "https://api.itsjusus.com"
    NEXT_PUBLIC_APP_URL: "https://itsjusus.com"
    NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: ${{ secrets.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY }}
  run: cd apps/web && pnpm build:pages
```

**How this works:**
- Next.js replaces `process.env.NEXT_PUBLIC_*` at **build time** (not runtime)
- These values get baked into the compiled output
- GitHub Actions now passes the production URLs during build
- When Cloudflare Pages serves the files, they contain correct API endpoints

---

### 2. **Missing PWA Icons** ❌ → ✅
**Problem:** Browser console errors:
```
Manifest fetch from https://itsjusus.com/manifest.json failed, code 500
```

**Root Cause:** 
- `manifest.json` references `icon-192.png` and `icon-512.png` which didn't exist
- Also missing `favicon.ico` (browser always requests this)

**Fix Applied:**
- ✅ Created `/apps/web/public/icon-192.png` (192×192 PWA icon)
- ✅ Created `/apps/web/public/icon-512.png` (512×512 PWA icon)
- ✅ Created `/apps/web/public/favicon.ico` (32×32 browser icon)

---

### 3. **No Pre-Deployment Validation** ❌ → ✅
**Problem:** You had to find these errors manually in production

**Solution:** Automated pre-deployment checker that validates:
- ✅ All required environment variables are set
- ✅ All static PWA files exist
- ✅ manifest.json is valid JSON and references correct icons
- ✅ No localhost hardcoded references (or warning if fallbacks exist)
- ✅ Cloudflare project names are correct
- ✅ GitHub Actions workflow sets env vars during build

---

## How to Use Pre-Deployment Checks

### Option 1: Run Locally (Before Pushing)
```bash
# Set the production URLs
export NEXT_PUBLIC_API_URL="https://api.itsjusus.com"
export NEXT_PUBLIC_APP_URL="https://itsjusus.com"

# Run checks
pnpm pre-deploy-check
```

**Output:**
```
🔍 Running pre-deployment checks...

1️⃣  Environment Variables
✓ NEXT_PUBLIC_API_URL = https://api.itsjusus.com
✓ NEXT_PUBLIC_APP_URL = https://itsjusus.com
...
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
✅ All pre-deployment checks passed!
```

### Option 2: GitHub Actions (Automatic)
- Runs automatically on every push to `main`
- Happens **before** the build
- Fails the workflow if critical issues found
- Workflow still succeeds if only warnings

**Where it runs in workflow:**
```
1. Checkout code
2. Install dependencies
3. Type check ← checks TypeScript
4. Pre-deployment checks ← NEW: validates config
5. Build Worker
6. Build Web (Pages)
7. Deploy...
```

---

## Environment Variables Required at Build Time

For **production**, these MUST be set before `pnpm build:pages`:
```bash
NEXT_PUBLIC_API_URL="https://api.itsjusus.com"      # Frontend → API calls
NEXT_PUBLIC_APP_URL="https://itsjusus.com"          # Open Graph, manifests
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY="pk_live_..."    # Stripe checkout (optional)
```

**Why?** Next.js replaces these at build time, not runtime. They can't be set by Cloudflare Pages environment variables.

---

## Browser Errors Now Fixed

| Error | Status | Fix |
|-------|--------|-----|
| `localhost:8787/api/notifications` | ✅ FIXED | Env vars now set during build |
| `localhost:8787/api/auth/entitlements` | ✅ FIXED | Env vars now set during build |
| `manifest.json → 500` | ✅ FIXED | Icons now exist in public/ |
| `favicon.ico → 404` | ✅ FIXED | favicon.ico created |

---

## Quick Reference: What Each File Does

| File | Purpose |
|------|---------|
| `.github/workflows/deploy.yml` | Sets env vars before build; runs pre-deploy-check |
| `scripts/pre-deploy-checks.js` | Validation script (run locally or in CI) |
| `apps/web/public/favicon.ico` | Browser icon (32×32) |
| `apps/web/public/icon-192.png` | PWA icon for Android (192×192) |
| `apps/web/public/icon-512.png` | PWA icon for iOS/splash (512×512) |

---

## If Issues Reoccur

Edit checking script:
```bash
nano scripts/pre-deploy-checks.js
```

Add new validations, e.g.:
```javascript
// Check for new pattern you want to prevent
if (content.includes("badPattern")) {
  error(`Found badPattern in ${file}`);
}
```

Then re-run: `pnpm pre-deploy-check`

---

## Next Steps

✅ Push this commit to trigger GitHub Actions deployment with checks
✅ Both Pages and Worker should deploy successfully
✅ Visit https://itsjusus.com - should load without errors
✅ Browser DevTools (F12) should show no 404/500 errors
