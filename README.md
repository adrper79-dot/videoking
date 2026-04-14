# NicheStream 🎬

A **hyper-niche interactive video platform** built on the Cloudflare edge stack. Stream, interact, and monetize — all in real time.

## Stack

| Layer | Technology |
|---|---|
| Monorepo | pnpm workspaces + Turborepo |
| Frontend | Next.js 15 (App Router) on Cloudflare Pages |
| Backend | Cloudflare Workers (Hono) + Durable Objects |
| Database | Neon PostgreSQL via Cloudflare Hyperdrive + Drizzle ORM |
| Video | Cloudflare Stream |
| Storage | Cloudflare R2 |
| Auth | BetterAuth |
| Payments | Stripe Connect (Express) |
| Realtime | Durable Objects WebSocket Hibernation API |
| Styling | Tailwind CSS |

---

## 📚 Documentation

| Resource | Purpose |
|---|---|
| [LOCAL_DEVELOPMENT_SETUP.md](docs/LOCAL_DEVELOPMENT_SETUP.md) | Complete dev environment setup guide |
| [PHASE_3_DEPLOYMENT_READY.md](docs/PHASE_3_DEPLOYMENT_READY.md) | Production deployment guide |
| [ARCHITECTURE.md](docs/ARCHITECTURE.md) | System design and component overview |
| [ENGINEERING.md](docs/ENGINEERING.md) | Code conventions and patterns |
| [improvement-tracker.md](docs/improvement-tracker.md) | Feature status (42/49 issues complete) |
| [COMPREHENSIVE_AUDIT_REPORT.md](docs/COMPREHENSIVE_AUDIT_REPORT.md) | Technical audit and code review |

---

## Project Structure

```
nichestream/
├── apps/
│   ├── web/          # Next.js 15 frontend (Cloudflare Pages)
│   └── worker/       # Cloudflare Worker API (Hono + Durable Objects)
└── packages/
    ├── db/           # Drizzle schema + migrations
    └── types/        # Shared TypeScript interfaces
```

---

## Features

- **Video feed** — Infinite-scroll public video catalog
- **Video player** — Cloudflare Stream embed with custom controls overlay
- **Live chat** — WebSocket-powered real-time chat via Durable Objects (last 100 messages persisted)
- **Polls** — Creator-launched live polls with real-time vote tallying
- **Reactions** — Emoji reaction counts synced across all viewers
- **Watch Party** — Host-controlled synchronized playback for all room members
- **Creator Dashboard** — Upload, analytics (via Stream API), and earnings overview
- **Monetization** — Hybrid freemium (AVOD + SVOD): free tier ads + low-friction subscriptions via Stripe
- **Auth** — BetterAuth email/password with session management
- **Moderation** — Content reporting and admin resolution flow
- **PWA** — Web app manifest for installability

---

## Getting Started

For complete setup instructions, see [**LOCAL_DEVELOPMENT_SETUP.md**](docs/LOCAL_DEVELOPMENT_SETUP.md).

### Quick Start (5 minutes)

1. **Install dependencies:**
   ```bash
   pnpm install
   ```

2. **Set up environment files:**
   ```bash
   # Worker environment (all Stripe/Stream/Auth credentials)
   cp apps/worker/.dev.vars.example apps/worker/.dev.vars
   
   # Web environment (API URLs)
   cp apps/web/.env.local.example apps/web/.env.local
   ```

3. **Initialize database:**
   ```bash
   cd packages/db
   pnpm db:generate    # Generate migrations
   pnpm db:migrate     # Run migrations (needs local PostgreSQL)
   cd ../..
   ```

4. **Start development servers** (multiple terminals):
   ```bash
   # Terminal 1: Worker API
   cd apps/worker && pnpm dev
   # → http://localhost:8787
   
   # Terminal 2: Web Frontend
   cd apps/web && pnpm dev
   # → http://localhost:3000
   ```

### Prerequisites

- **Node.js:** 18+ 
- **pnpm:** 9.0.0+
- **PostgreSQL:** 14+ (local or Docker)
- **Cloudflare Account:** For deploying (optional for local dev)
- **Stripe Account:** Test mode credentials for payment testing

### Detailed Setup

See [docs/LOCAL_DEVELOPMENT_SETUP.md](docs/LOCAL_DEVELOPMENT_SETUP.md) for:
- Docker PostgreSQL setup
- All environment variables explained with sources
- Troubleshooting common issues
- Complete command reference

---

## Deployment

For complete deployment instructions, see [**docs/PHASE_3_DEPLOYMENT_READY.md**](docs/PHASE_3_DEPLOYMENT_READY.md).

### Quick Deploy

```bash
# 1. Authenticate with Cloudflare
cd apps/worker && pnpm exec wrangler login

# 2. Set secrets (interactive)
pnpm exec wrangler secret put BETTER_AUTH_SECRET
pnpm exec wrangler secret put STRIPE_SECRET_KEY
pnpm exec wrangler secret put STRIPE_WEBHOOK_SECRET

# 3. Deploy Worker API
pnpm exec wrangler deploy

# 4. Deploy Web Frontend
cd ../web
pnpm build:pages
pnpm exec wrangler pages deploy dist

# 5. Verify
curl https://your-worker.*.workers.dev/health
```

### Environment Setup

Before deploying, configure:
- Secrets: `wrangler secret put KEY VALUE`
- Config vars: Set in `wrangler.toml` or via dashboard
- Database: Neon PostgreSQL with Hyperdrive binding
- Stripe: Connected account with pricing configured
- Stream: Customers domain configured

---

## API Reference

| Method | Path | Description |
|---|---|---|
| `GET` | `/api/videos` | List videos (paginated) |
| `GET` | `/api/videos/:id` | Get video details |
| `POST` | `/api/videos/upload-url` | Get Stream direct upload URL |
| `PATCH` | `/api/videos/:id` | Update video metadata |
| `DELETE` | `/api/videos/:id` | Soft-delete video |
| `GET` | `/api/channels/:username` | Channel profile + videos |
| `POST` | `/api/stripe/connect/onboard` | Start Stripe Connect onboarding |
| `GET` | `/api/stripe/connect/status` | Check Connect account status |
| `POST` | `/api/stripe/subscriptions` | Create subscription checkout |
| `POST` | `/api/stripe/unlock` | Create unlock payment intent |
| `POST` | `/api/webhooks/stripe` | Stripe webhook handler |
| `GET` | `/api/ws/:videoId` | WebSocket upgrade → VideoRoom DO |
| `GET` | `/api/dashboard/earnings` | Creator earnings summary |
| `GET` | `/api/dashboard/analytics` | Video analytics |
| `POST` | `/api/moderation/report` | Submit content report |

---

## Architecture Notes

### Durable Objects

**VideoRoom** — One instance per `videoId`. Uses WebSocket hibernation API. Persists chat history, polls, and reaction counts in DO storage. Per-user rate limiting (1 msg/sec).

**UserPresence** — One instance per `userId`. Tracks online/offline with `lastSeen` timestamp.

### Monetization Flow (2026 Hybrid Freemium)

#### Tier Model

**Free Tier (Guest/Non-Citizen)**
- Free access to browse/watch public videos and basic discovery
- Light, non-intrusive ad load (pre-roll, sponsored polls, dynamic overlays)
- Limited chat/reactions and optional viewing caps (per day/week)
- Standard quality and reduced advanced interactivity

**Citizen Tier ($1/month or $10/year)**
- Ad-free (or near ad-free) viewing
- Full interactivity: unlimited chat with badges/priority, advanced polls/quizzes, synced watch parties
- Unlimited access, richer personalization, and PWA/offline progress sync
- Primary conversion target for recurring revenue

**VIP Citizen Tier ($5-$9/month, optional)**
- Everything in Citizen plus super-fan perks (exclusive content/AMAs, private rooms, priority support, higher quality options)
- Natural upgrade path that lifts blended ARPU

#### Revenue Mix

1. Free tier generates baseline ad revenue from high-volume casual viewers
2. Citizen/VIP subscriptions generate predictable recurring revenue via Stripe Billing
3. Revenue is attributed by views + interaction depth and split to creators (typically 60-70%) via Stripe Connect
4. Platform retains the remainder after creator split and payment processing fees

This hybrid structure balances acquisition and margin better than ad-only or subscription-only models for early-stage niche platforms.

### Hybrid Gating and Entitlements

- **Neon + Drizzle**: Store and query `user_tier`, `subscription_status`, entitlement flags, and ad preferences
- **Stripe Webhooks**: Update entitlements immediately after checkout, renewal, cancellation, and payment retries
- **Cloudflare Stream**: Signed playback URLs + ad-tag injection logic per tier
- **Durable Objects**: Enforce tier permissions in real-time rooms (rate limits, badge privileges, premium feature access)

### Retention and Conversion Layer

- 7-14 day Citizen trial to reduce first-purchase friction
- Annual plan discount ($10/year) to improve cash flow and reduce voluntary churn
- Contextual upgrade nudges during high-intent moments (chat limits, watch party entry, advanced poll participation)
- Community events and creator-exclusive interactivity to increase stickiness
- Churn instrumentation by tier with watch-time and interaction-depth cohorts

### Ad Tech Maturity Path

1. **Phase 1**: Client-side VAST tags in Stream player for free-tier inventory
2. **Phase 2**: Worker-managed targeting/frequency capping and sponsored interactive units
3. **Phase 3**: Server-side dynamic ad insertion optimizations for better fill and CPM

### Creator Earnings and Attribution

- Combine ad revenue and subscription pools into transparent creator payout calculations
- Attribute shares using weighted engagement signals (watch time, interactive actions, session quality)
- Expose clear payout breakdowns in dashboard (ad revenue, sub revenue, adjustments, net transfer)
- Keep payout operations on Stripe Connect Express for scalable global disbursements

### Phase 1 Execution Priorities

Ship with hybrid monetization on day one:

1. Core video feed/player + auth
2. Free/Citizen tier gating and entitlement checks
3. $1 monthly + $10 annual Stripe Billing plans
4. Basic VAST ad insertion for free users only
5. Stripe Connect creator payout baseline
6. Initial retention hooks (trial + upgrade nudges + churn tracking)

### Plan Addendum for Agent Prompting

Append this block to any implementation-planning prompt:

```text
MONETIZATION ADDENDUM (Implement this hybrid model exactly):

- Free Tier: Light ads (VAST/dynamic via Stream Player), limited chat/reactions, video limits.
- Citizen Tier: $1/month recurring via Stripe Billing (with annual $10 option). Unlocks ad-free + full interactivity (unlimited chat with badges, advanced polls, watch parties), unlimited access.
- Optional VIP Tier: $5-9/month for exclusive perks.
- Use Stripe Connect for creator revenue shares across all sources (ads + subs), attributed by engagement metrics.
- Gating: Neon roles + signed Stream URLs + Durable Object permissions.
- Retention features: Trials, upgrade nudges during high-engagement moments, churn tracking.
- Prioritize Phase 1: Core video + auth + hybrid tiering + basic ad insertion + Stripe Connect payouts.

Update all architecture, schema, frontend, and dashboard sections to support this hybrid model. Start Phase 1 with the improved monetization from day one.
```

---

## License

MIT# NicheStream - Updated Mon Apr 13 21:51:43 UTC 2026
