# CLI-Based Setup: Custom Domains for itsjusus.com

**Status:** Using Wrangler CLI instead of dashboard UI  
**What's Done:** ✅ Route configuration added to wrangler.toml  
**What's Needed:** Set up R2 custom domain + redeploy Worker

---

## Quick Setup (2 Commands)

### Step 1: Deploy Worker with Routes

```bash
cd apps/worker
pnpm exec wrangler deploy
```

This deploys the Worker with the route `api.itsjusus.com/*` configured in `wrangler.toml`.

**Expected output:**
```
✓ Uploaded nichestream-api
✓ Published to https://api.itsjusus.com
```

### Step 2: Add R2 Custom Domain

```bash
cd apps/worker
pnpm exec wrangler r2 bucket domain add videoking-r2 --domain-name "assets.itsjusus.com"
```

**What this does:**
- Adds custom domain `assets.itsjusus.com` to your R2 bucket `videoking-r2`
- Makes all assets accessible at that domain

---

## Verification

After running the commands above, verify everything is working:

```bash
# Check Worker routes
curl https://api.itsjusus.com/api/videos

# Check R2 bucket (if you've uploaded files)
curl https://assets.itsjusus.com/some-file.jpg

# Check Pages frontend
curl https://itsjusus.com
```

---

## If You Don't Have Wrangler Access Yet

If you need to authenticate first:

```bash
cd apps/worker
pnpm exec wrangler login
# Browser will open, confirm with your Cloudflare account
```

---

## Manual Script Option

Alternatively, run the automated setup script:

```bash
chmod +x setup-cloudflare-domains.sh
./setup-cloudflare-domains.sh
```

This handles all steps including deployment and domain configuration.

---

## Status After These Steps

| Component | URL | Method | Status |
|---|---|---|---|
| Pages Frontend | `itsjusus.com` | Dashboard | ✅ Done |
| Worker API | `api.itsjusus.com` | `wrangler deploy` | ⏳ Run Step 1 |
| R2 Assets | `assets.itsjusus.com` | `wrangler r2 bucket domain add` | ⏳ Run Step 2 |

---

## Troubleshooting

**"Command not found: wrangler"**
→ Run from the `apps/worker` directory and use `pnpm exec wrangler`

**"Not authenticated"**
→ Run `pnpm exec wrangler login` first

**"Domain add failed"**
→ Make sure `itsjusus.com` is registered in your Cloudflare account
→ Try: `pnpm exec wrangler r2 bucket domain list videoking-r2` to see current status

**"api.itsjusus.com not working yet"**
→ DNS propagation takes 5-10 minutes
→ Check progress: GitHub Actions → latest deploy
→ Verify route deployed: `pnpm exec wrangler routes list` (if available)

---

## Next: Trigger Deployment

Once you run these commands, push to trigger GitHub Actions:

```bash
git push
```

The workflow will deploy everything with all the custom domain routing in place.
