# Deployment Checklist & Configuration Guide

This document provides the final steps to deploy NicheStream to production on Cloudflare Pages + Workers.

## Pre-Deployment Configuration

### 1. Hyperdrive Setup (BC-1)

Hyperdrive provides low-latency connection pooling from Cloudflare Workers to your Neon PostgreSQL database.

**Steps:**
1. In Cloudflare dashboard: **Workers & Pages** → **Hyperdrive**
2. Click **Create a Hyperdrive config**
3. Name it: `nichestream-db` (or your preference)
4. Paste your Neon connection string:
   - Get it from [console.neon.tech](https://console.neon.tech) → Project → Connection string
   - Format: `postgresql://user:password@host/dbname`
5. Click **Create config** and copy the **ID**
6. Update `apps/worker/wrangler.toml`:
   ```toml
   [[hyperdrive]]
   binding = "DB"
   id = "YOUR_HYPERDRIVE_ID_HERE"  # Replace with copied ID
   ```

### 2. Environment Variables (Secrets & Configuration)

Set these via **Cloudflare dashboard** or `wrangler secret` command:

**Critical Secrets** (use `wrangler secret put `):
```bash
pnpm wrangler secret put BETTER_AUTH_SECRET
pnpm wrangler secret put STRIPE_SECRET_KEY
pnpm wrangler secret put STRIPE_WEBHOOK_SECRET
pnpm wrangler secret put APP_BASE_URL  # Frontend URL - environment specific
```

**Configuration Variables** (in `wrangler.toml` `[vars]` section):
- `STREAM_ACCOUNT_ID` — From Cloudflare Stream dashboard
- `STREAM_CUSTOMER_DOMAIN` — e.g., "abc123" (Stream customer subdomain)
- `STRIPE_CITIZEN_MONTHLY_PRICE` — From Stripe dashboard (Price ID)
- `STRIPE_CITIZEN_ANNUAL_PRICE` — From Stripe dashboard (Price ID)
- `STRIPE_VIP_MONTHLY_PRICE` — From Stripe dashboard (Price ID)
- `STRIPE_CITIZEN_MONTHLY_PRICE` — Price ID for Citizen monthly
- `PLATFORM_FEE_PERCENT` — 20 (recommended)

**APP_BASE_URL Configuration:**
- **Local Development**: Add to `.dev.vars` (e.g., `http://localhost:3000`)
- **Staging**: `wrangler secret put APP_BASE_URL` with staging URL
- **Production**: `wrangler secret put APP_BASE_URL` with production URL
- This must be set for each environment as it's critical for Stripe and auth redirects

### 3. Stripe Connected Accounts (C-9)

**Note**: Full payout routing requires Stripe connected account setup for creators. This is a feature for future release requiring an additional OAuth onboarding flow.

For MVP, you can manually handle transfers or implement a basic connected account setup.

## Deployment Steps

### Web (Next.js frontend)
```bash
cd apps/web
pnpm build:pages
pnpm deploy  # Via @cloudflare/wrangler-action or manual wrangler pages deploy
```

### Worker (API backend)
```bash
cd apps/worker
pnpm deploy
```

## Post-Deployment Verification

1. **Health check**: `curl https://your-worker-url/api/health`
2. **Database connectivity**: Check Hyperdrive logs in Cloudflare dashboard
3. **BetterAuth setup**: Create a test user via `/sign-up`
4. **Stripe webhooks**: Configure endpoint URL in Stripe dashboard → Developers → Webhooks
   - Endpoint: `https://your-worker-url/api/stripe/webhooks`
   - Event types: `payment_intent.succeeded`, `customer.subscription.*`, `charge.refunded`

## Troubleshooting

### "Hyperdrive binding not found"
- Ensure `id` in `wrangler.toml` is set (not `YOUR_HYPERDRIVE_ID`)
- Run `wrangler deploy` to update bindings

### Database connection timeout
- Verify Neon connection string has correct IP allowlist
- Check Hyperdrive config is pointing to correct database

### Stripe webhook failures
- Verify `STRIPE_WEBHOOK_SECRET` matches Stripe dashboard
- Check webhook endpoint URL is accessible and not rate-limited

## Performance Notes

- **DB pool**: Hyperdrive caches connections; expect 5-50ms latency vs. direct DB
- **VideoRoom DO**: Persists chat/polls asynchronously; live delivery is immediate
- **Image optimization**: Cloudflare CDN handles compression; no Next.js Image Optimization required

## Future Enhancements

1. **XC-1**: Per-isolate DB/Auth caching for improved cold start performance
2. **C-9**: Stripe connected accounts OAuth flow for creator payout routing
3. **Dashboard**: Upgrade streaming analytics with Cloudflare Logpush integration

---

For questions, refer to the main [ARCHITECTURE.md](./ARCHITECTURE.md) and [improvement-tracker.md](./improvement-tracker.md).
