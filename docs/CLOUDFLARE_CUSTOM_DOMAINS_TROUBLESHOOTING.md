# Finding Custom Domain Settings in Cloudflare — Troubleshooting

**Status:** You've added custom domain to Pages (itsjusus.com). Now need Worker and R2 domains.

---

## What Needs to Be Done

You need to connect:
1. ✅ **Pages:** `itsjusus.com` — YOU ALREADY DID THIS
2. ⏳ **Worker:** `api.itsjusus.com` — NEED TO FIND
3. ⏳ **R2:** `assets.itsjusus.com` — NEED TO FIND

---

## For the Worker (nichestream-api)

**Navigate to:** https://dash.cloudflare.com/account/workers-and-pages

You should see your worker listed. Look for **nichestream-api**. 

**When you click on it, you should see sections like:**
- Overview
- Settings
- Domains (or Routes)
- Environment variables
- Triggers
- Analytics
- Logs

**Tell me: What sections/tabs do you see?**

The custom domain setting could be under:
- A **Domains** tab
- A **Routes** section within Settings
- An option that says "Connect domain" or "Add route"

Once you tell me what you see, I can give you exact steps.

---

## For R2 (videoking-r2)

**Navigate to:** https://dash.cloudflare.com/account/storage/r2

Find your bucket **videoking-r2** and click on it.

**You should see:**
- Files listing
- Settings
- ... (other options)

**Tell me: What tab/section options do you see?**

Look specifically for anything related to:
- "Public domain"
- "Custom domain"
- "URL setup"
- "Settings"

---

## What to Tell Me

For both Worker and R2, describe:
1. **The exact tab/section names you see**
2. **What buttons or links are available?**
3. **Do you see anything that says "custom domain", "add domain", "routes", or similar?**

Once I know what UI you're actually looking at, I can give you precise steps instead of guessing.

---

## Alternative: Use Wrangler CLI

If you can't find it in the UI, we can use the command line instead:

**For Worker custom domain:**
```bash
cd apps/worker
pnpm exec wrangler deployments rollback --to <version>
# Or list routes
pnpm exec wrangler routes list
```

**For R2 custom domain:**
```bash
cd apps/worker
pnpm exec wrangler r2 bucket list
```

But first, let me know what you see in the dashboard so I can help you complete it through the UI.
