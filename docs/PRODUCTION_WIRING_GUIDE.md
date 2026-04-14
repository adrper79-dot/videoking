# Production Wiring Guide — itsjusus.com Setup

**Date:** April 14, 2026  
**Status:** All code updated to use production domain; awaiting Cloudflare custom domain configuration

---

## Current Setup

| Component | Current URL | Target URL | Status |
|---|---|---|---|
| Worker API | `nichestream-api.adrper79.workers.dev` | `api.itsjusus.com` | ✓ Deployed |
| Pages Frontend | `videoking.pages.dev` | `itsjusus.com` | ✓ Deployed, needs domain |
| R2 Assets | `videoking-r2` bucket | `assets.itsjusus.com` | ✓ Configured |

---

## What Just Deployed

GitHub Actions has deployed code with **all domains updated to `itsjusus.com`**:

✅ **Worker Configuration**
- `APP_BASE_URL = "https://itsjusus.com"`
- Cookies and sessions will work with this domain
- CORS correctly set to allow `itsjusus.com`

✅ **Frontend Configuration**
- `NEXT_PUBLIC_API_URL = "https://api.itsjusus.com"`
- `NEXT_PUBLIC_APP_URL = "https://itsjusus.com"`
- All API calls point to the correct domain

✅ **Email & Assets**
- Emails from: `noreply@itsjusus.com`
- Email links: `https://itsjusus.com/...`
- Asset URLs: `https://assets.itsjusus.com/...`

---

## Next Steps: Wire It All Together in Cloudflare

### Step 1: Connect Pages to Custom Domain

Go to **Cloudflare Dashboard** → **Pages** → **videoking-web** (or whatever your Pages project is named)

1. **Custom Domains** tab
2. Click **"Add a custom domain"**
3. Enter: `itsjusus.com`
4. System will ask to verify (it's already registered with Cloudflare)
5. Click **Activate domain**

**Result:** Your Pages frontend will be live at `https://itsjusus.com`

### Step 2: Connect Worker to API Subdomain

Go to **Cloudflare Dashboard** → **Workers** → **nichestream-api**

1. **Settings** tab
2. **Custom domains** section
3. Click **"Add custom domain"**
4. Enter: `api.itsjusus.com`
5. Choose your domain from the list
6. Click **Add domain**

**Result:** Your Worker API will be at `https://api.itsjusus.com` (this is what the frontend will call)

### Step 3: Connect R2 Bucket to Assets Subdomain

Go to **Cloudflare Dashboard** → **R2** → **videoking-r2** (your bucket)

1. **Settings** tab
2. **Public domain** section
3. Click **"Connect domain"** or **"Add custom domain"**
4. Enter: `assets.itsjusus.com`
5. Configure as needed
6. Save

**Result:** Your assets will be served from `https://assets.itsjusus.com/...`

---

## Verification (After Custom Domains Are Set Up)

Once all domains are connected, test each:

**Frontend:**
```bash
curl https://itsjusus.com
# Should return HTML homepage
```

**API:**
```bash
curl https://api.itsjusus.com/api/videos
# Should return JSON video list or 401 if auth needed
```

**Assets:**
```bash
curl https://assets.itsjusus.com/some-uploaded-file
# Should return the file or 404 if not found
```

---

## Current DNS Status

All DNS should already be configured since `itsjusus.com` is registered with Cloudflare. The custom domains above just need to be activated in the Cloudflare dashboard.

---

## Testing the Full Flow

Once everything is wired:

1. Go to `https://itsjusus.com`
2. You should see the homepage
3. Click "Sign up" or any authenticated action
4. Should redirect to auth page
5. Cookies should work (BetterAuth will use `itsjusus.com`)
6. API calls from Pages will reach `api.itsjusus.com`
7. Uploaded videos/assets will use `assets.itsjusus.com`

---

## If You Get CORS Errors

This means the Worker and Pages aren't properly communicating. Root causes:

1. **API domain doesn't match** — Worker is looking for `itsjusus.com` in CORS, but frontend is at wrong origin
2. **Custom domain not activated** — One of the domains isn't actually routing to Cloudflare yet
3. **Worker needs redeployment** — If you just set the custom domains, the Worker is still using old config

**Solution:** If you get CORS errors:
1. Verify custom domains are all "Active" in Cloudflare dashboard
2. Re-run GitHub Actions workflow: GitHub → Actions → Latest run → Re-run all jobs
3. Wait 2-3 minutes for new deployment

---

## Architecture After Setup

```
User's Browser
    ↓ (https://itsjusus.com)
    ↓
Cloudflare Pages (videoking-web project)
    ↓ 
Serves static frontend from .vercel/output/static
    ↓
Frontend makes API calls to: https://api.itsjusus.com
    ↓
Cloudflare Worker (nichestream-api)
    ↓
Connects to:
  - Hyperdrive → Neon PostgreSQL
  - R2 Bucket → Assets at assets.itsjusus.com
  - Durable Objects → Video rooms & user presence
    ↓
Returns JSON responses
    ↓
Frontend renders data
    ↓
User sees live video site ✓
```

---

## Stripe/Stream Configuration

These still need credentials set in the Worker environment. If you have:
- **Stripe:** Update `STRIPE_CONNECT_CLIENT_ID` and pricing variables
- **Cloudflare Stream:** Update `STREAM_ACCOUNT_ID` and `STREAM_CUSTOMER_DOMAIN`

These are set as secrets in GitHub and deployed automatically. Just ensure the secrets have the right values.

---

## Summary

**Code Updated:** ✅ (commit b58f23c)  
**Worker Deployed:** ✅  
**Pages Deployed:** ✅  
**Custom Domains Configured:** ⏳ Needs Cloudflare dashboard steps above

Once you complete the 3 Cloudflare dashboard steps above, everything should work end-to-end!
