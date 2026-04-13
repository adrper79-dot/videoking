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
- **Monetization** — Stripe Connect Express: subscriptions, pay-per-view unlocks, tips
- **Auth** — BetterAuth email/password with session management
- **Moderation** — Content reporting and admin resolution flow
- **PWA** — Web app manifest for installability

---

## Getting Started

### Prerequisites

- Node.js 20+
- pnpm 9+
- A Cloudflare account with Workers & Pages, Stream, R2, and Hyperdrive configured
- A Stripe account with Connect enabled
- A Neon PostgreSQL database

### 1. Install dependencies

```bash
pnpm install
```

### 2. Configure environment variables

**Worker** (`apps/worker/.dev.vars`):
```
BETTER_AUTH_SECRET=your-secret-here
STREAM_API_TOKEN=your-stream-token
STREAM_ACCOUNT_ID=your-cf-account-id
# Stream customer subdomain (Settings → Customer Domain in Cloudflare Stream dashboard)
# e.g. if your URLs are customer-abc123.cloudflarestream.com, set STREAM_CUSTOMER_DOMAIN=abc123
STREAM_CUSTOMER_DOMAIN=abc123
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
APP_BASE_URL=http://localhost:3000
PLATFORM_FEE_PERCENT=20
```

**Web** (`apps/web/.env.local`):
```
NEXT_PUBLIC_API_URL=http://localhost:8787
NEXT_PUBLIC_APP_URL=http://localhost:3000
# Stripe Price ID for the monthly subscription plan (create in Stripe dashboard)
NEXT_PUBLIC_SUBSCRIPTION_PRICE_MONTHLY=price_...
```

### 3. Set up the database

```bash
pnpm db:generate
DATABASE_URL=postgres://... pnpm db:migrate
```

### 4. Update wrangler.toml

Edit `apps/worker/wrangler.toml` and replace:
- `YOUR_HYPERDRIVE_ID` with your actual Hyperdrive binding ID (Cloudflare dashboard → Workers & Pages → Hyperdrive → create config → copy ID)
- `STREAM_ACCOUNT_ID` with your Cloudflare account ID
- `STREAM_CUSTOMER_DOMAIN` with the subdomain shown in Cloudflare Stream → Settings → Customer Domain

### 5. Run locally

```bash
pnpm dev
```

- Web: http://localhost:3000
- Worker: http://localhost:8787

---

## Deployment

### Worker
```bash
cd apps/worker && pnpm deploy
```

### Web (Cloudflare Pages)
```bash
cd apps/web && pnpm build && pnpm deploy
```

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

### Monetization Flow

1. Creator completes Stripe Connect Express onboarding
2. Viewer subscribes → Stripe Checkout → webhook creates `subscriptions` + `earnings` rows
3. Platform retains configured fee percentage; creator receives the net via Stripe Connect transfers

---

## License

MIT