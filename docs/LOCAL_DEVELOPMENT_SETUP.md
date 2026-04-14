# Local Development Setup Guide

This guide explains how to set up NicheStream for local development.

## Prerequisites

- **Node.js:** 18+ (verify with `node --version`)
- **pnvm:** 9.0.0+ (verify with `pnpm --version`)
- **PostgreSQL:** 14+ running locally (for Hyperdrive emulation)
- **Cloudflare Account:** For Wrangler authentication

## Step 1: Install Dependencies

```bash
pnpm install
```

This installs all dependencies for the monorepo, including:
- Web frontend (Next.js)
- Worker API (Wrangler/Hono)
- Database package (Drizzle ORM)
- Shared types package

## Step 2: Set Up Environment Variables

### Worker API (.dev.vars)

Copy the example file:
```bash
cp apps/worker/.dev.vars.example apps/worker/.dev.vars
```

Edit `apps/worker/.dev.vars` and fill in test values:

| Variable | Source | Example |
|----------|--------|---------|
| `BETTER_AUTH_SECRET` | Generate: `openssl rand -base64 32` | `abc...xyz` |
| `STRIPE_SECRET_KEY` | [Stripe Dashboard → Test API Keys](https://dashboard.stripe.com/test/apikeys) | `sk_test_...` |
| `STRIPE_WEBHOOK_SECRET` | [Stripe → Webhooks](https://dashboard.stripe.com/test/webhooks) | `whsec_test_...` |
| `STRIPE_*_PRICE` | [Stripe → Products](https://dashboard.stripe.com/test/products) | `price_...` |
| `STREAM_API_TOKEN` | [Cloudflare Stream → Tokens](https://dash.cloudflare.com/?to=/:account/stream/tokens) | `token_...` |
| `STREAM_ACCOUNT_ID` | [Cloudflare Dashboard](https://dash.cloudflare.com/) (top-right) | `abc123def456` |
| `STREAM_CUSTOMER_DOMAIN` | [Cloudflare Stream → Settings](https://dash.cloudflare.com/?to=/:account/stream/settings) | `subdomain.cloudflarestream.com` |

### Frontend (.env.local)

Copy the example:
```bash
cp apps/web/.env.local.example apps/web/.env.local
```

Edit `apps/web/.env.local`:

```
NEXT_PUBLIC_API_BASE_URL=http://localhost:8787
NEXT_PUBLIC_STREAM_DOMAIN=your-subdomain.cloudflarestream.com
NEXT_PUBLIC_GOOGLE_IMA_SDK_URL=https://imasdk.googleapis.com/js/sdkloader/ima3.js
```

## Step 3: Set Up Local Database

### Option A: Docker (Recommended)

```bash
docker run --name nichestream-postgres \
  -e POSTGRES_USER=postgres \
  -e POSTGRES_PASSWORD=password \
  -e POSTGRES_DB=nichestream \
  -p 5432:5432 \
  -d postgres:15
```

### Option B: Local PostgreSQL

Create a database:
```bash
createdb nichestream
```

### Configure Connection String

For `pnpm dev` to work, set the local connection string:

```bash
export WRANGLER_HYPERDRIVE_LOCAL_CONNECTION_STRING_DB="postgresql://postgres:password@localhost:5432/nichestream"
```

Or add to your shell profile (`~/.bashrc`, `~/.zshrc`, etc.):
```bash
export WRANGLER_HYPERDRIVE_LOCAL_CONNECTION_STRING_DB="postgresql://postgres:password@localhost:5432/nichestream"
```

## Step 4: Run Migrations

Initialize the database schema:

```bash
cd packages/db
pnpm db:generate    # Generate migration files
pnpm db:migrate     # Run migrations against local DB
```

## Step 5: Start Development Servers

### Terminal 1: Worker API

```bash
cd apps/worker
pnpm dev
# Output: ⚡ Listening on http://localhost:8787
```

### Terminal 2: Web Frontend

```bash
cd apps/web
pnpm dev
# Output: ▲ Next.js ready on http://localhost:3000
```

### Terminal 3 (Optional): Database UI

```bash
cd packages/db
pnpm db:studio    # Opens Drizzle Studio at http://localhost:3000
```

## Step 6: Verify Setup

1. Open http://localhost:3000 in browser
2. Click "Sign Up" to create an account
3. Check that auth flow works
4. Verify database entries in Drizzle Studio

## Troubleshooting

### "Hyperdrive requires a local connection string"

```bash
# Set before running pnpm dev
export WRANGLER_HYPERDRIVE_LOCAL_CONNECTION_STRING_DB="postgresql://user:pass@localhost:5432/dbname"
```

### "Connection refused" to database

- Verify PostgreSQL is running: `psql -U postgres`
- Check connection string in `WRANGLER_HYPERDRIVE_LOCAL_CONNECTION_STRING_DB`
- Run migrations: `cd packages/db && pnpm db:migrate`

### "Stripe API key invalid"

- Verify you're using test keys from https://dashboard.stripe.com/test/apikeys
- Test keys start with `sk_test_` (not `sk_live_`)

### "Stream API token expired"

- Regenerate at https://dash.cloudflare.com/?to=/:account/stream/tokens
- Get new customer domain at Settings

## Available Commands

### Root level

```bash
pnpm build          # Build all packages
pnpm dev            # Run all dev servers (requires multiple terminals)
pnpm typecheck      # Type-check all packages
pnpm db:generate    # Generate new database migration
pnpm db:migrate     # Run pending database migrations
```

### Worker API

```bash
cd apps/worker
pnpm dev            # Start dev server on http://localhost:8787
pnpm build          # Dry-run build
pnpm deploy         # Deploy to Cloudflare Workers
pnpm typecheck      # Check types
```

### Web Frontend

```bash
cd apps/web
pnpm dev            # Start dev server on http://localhost:3000
pnpm build          # Build for production
pnpm build:pages    # Build for Cloudflare Pages
pnpm typecheck      # Check types
```

### Database

```bash
cd packages/db
pnpm db:generate    # Generate migration from schema changes
pnpm db:migrate     # Run pending migrations
pnpm db:studio      # Open Drizzle Studio UI
```

## File Structure

```
/workspaces/videoking/
├── apps/
│   ├── worker/              # Cloudflare Worker API (Hono)
│   │   ├── .dev.vars        # Dev environment variables (gitignored)
│   │   ├── src/
│   │   │   ├── index.ts     # Main worker entry
│   │   │   ├── routes/      # API routes
│   │   │   ├── lib/         # Utilities (auth, logging, retry)
│   │   │   └── middleware/  # Express-like middleware
│   │   └── wrangler.toml    # Cloudflare config
│   │
│   └── web/                 # Next.js frontend
│       ├── .env.local       # Dev environment variables (gitignored)
│       ├── src/
│       │   ├── app/         # Next.js 15 app router
│       │   ├── components/  # React components
│       │   └── lib/         # Client utilities
│       └── next.config.ts
│
├── packages/
│   ├── db/                  # Drizzle ORM + Neon PostgreSQL
│   │   ├── src/
│   │   │   ├── schema/      # Database schema definitions
│   │   │   └── migrations/  # SQL migrations
│   │   └── drizzle.config.ts
│   │
│   └── types/               # Shared TypeScript interfaces
│       └── src/index.ts
│
└── docs/                    # Documentation
    ├── ARCHITECTURE.md      # System design
    ├── DEPLOYMENT.md        # Production deployment
    └── PHASE_3_*.md         # Feature implementation docs
```

## Next Steps

1. [Read ARCHITECTURE.md](../ARCHITECTURE.md) to understand system design
2. [Check ENGINEERING.md](../ENGINEERING.md) for code conventions
3. [Review improvement-tracker.md](../improvement-tracker.md) for current status
4. Start developing! Push commits to a feature branch.

## Security Notes

⚠️ **Never commit `.dev.vars` or `.env.local`** — These files contain secrets and are gitignored.

For production:
- Use Wrangler secrets: `wrangler secret put KEY_NAME`
- Never store secrets in code or `.wrangler.toml`
- Use GitHub Secrets for CI/CD pipelines
