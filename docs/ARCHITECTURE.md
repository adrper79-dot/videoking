# NicheStream — Architecture Reference

> **Last updated:** April 2026  
> **Status:** Phase 1 complete, Phase 2 (interactivity moat) complete, Phase 3 (monetization & ad tech) in planning

---

## 1. Vision & Design Principles

NicheStream is a hyper-niche interactive video platform that collapses the gap between lean indie tooling and world-class viewer experience. Every architectural decision follows three constraints:

1. **Edge-first** — All compute runs at or near the user. There are no long-haul round-trips for hot paths.
2. **Serverless** — No persistent VMs. All costs are usage-proportional. $0 burn when idle.
3. **Modular layers** — Video delivery, real-time state, relational data, and payments are independent services that compose cleanly.

The platform is designed for a single passionate niche (e.g., indie animation, specialist hobby, professional craft). Narrow vertical focus drives organic growth, reduces moderation surface, and makes recommendation quality trivial to achieve.

---

## 2. System Diagram

```
┌──────────────────────────────────────────────────────────────────┐
│                        USER (browser / PWA)                      │
│                                                                   │
│   Next.js 15 frontend (Cloudflare Pages)                         │
│   ┌─────────────┐  ┌──────────────┐  ┌─────────────────────┐    │
│   │  Video Feed │  │ Video Player │  │  Interactive Overlay │    │
│   │  + Search   │  │ (CF Stream)  │  │  Chat · Polls · WP  │    │
│   └──────┬──────┘  └──────┬───────┘  └──────────┬──────────┘    │
│          │                │                      │ WebSocket      │
└──────────┼────────────────┼──────────────────────┼───────────────┘
           │ REST (HTTPS)   │ Signed URL            │ WS
           ▼                ▼                        ▼
┌──────────────────────────────────────────────────────────────────┐
│                   Cloudflare Workers (Hono API)                   │
│                                                                   │
│  ┌───────────┐ ┌──────────┐ ┌──────────┐ ┌────────────────────┐ │
│  │  /videos  │ │ /stripe  │ │ /auth    │ │  /api/ws/:videoId  │ │
│  │ /channels │ │ /webhooks│ │ (BetterAuth)│ │  → VideoRoom DO   │ │
│  │ /playlists│ │ /moderation│             │                    │ │
│  └─────┬─────┘ └────┬─────┘ └──────────┘ └──────────┬─────────┘ │
│        │             │                               │            │
└────────┼─────────────┼───────────────────────────────┼────────────┘
         │             │                               │
         ▼             ▼                               ▼
┌──────────────┐ ┌──────────────┐        ┌────────────────────────┐
│    Neon DB   │ │    Stripe    │        │  Durable Objects       │
│  (Postgres)  │ │   Connect    │        │                        │
│  via Hyper-  │ │  Billing     │        │  VideoRoom (per video) │
│  drive       │ │  Webhooks    │        │  · chat history        │
│              │ │              │        │  · active poll         │
│  users       │ │  Checkout    │        │  · reaction counts     │
│  videos      │ │  Subscriptions│       │  · watch party state   │
│  earnings    │ │  Payouts     │        │                        │
│  interactions│ └──────────────┘        │  UserPresence (per uid)│
│  playlists   │                         │  · online / lastSeen   │
│  moderation  │        ┌────────────────┤                        │
└──────────────┘        │ Cloudflare R2  └────────────────────────┘
                        │ (thumbnails,
                        │  static assets)
                        └────────────┐
                                     ▼
                          ┌─────────────────────┐
                          │  Cloudflare Stream  │
                          │  · HLS encoding     │
                          │  · Global delivery  │
                          │  · Live RTMPS/SRT   │
                          │  · Signed URLs      │
                          │  · Analytics API    │
                          └─────────────────────┘
```

---

## 3. Stack Components

### 3.1 Frontend — Next.js 15 on Cloudflare Pages (`apps/web`)

| Concern | Implementation |
|---|---|
| Framework | Next.js 15 App Router with React server components |
| Styling | Tailwind CSS |
| Auth client | `@better-auth/client` (`lib/auth-client.ts`) |
| API calls | Typed `fetch` wrapper in `lib/api.ts` |
| Real-time | Native `WebSocket` in `hooks/useWebSocket.ts` |
| Player control | `hooks/useVideoPlayer.ts` (wraps CF Stream iframe player API) |
| PWA | `public/manifest.json` + service worker |

Pages:
- `/` — Infinite-scroll video feed
- `/watch/[videoId]` — Player + interactive overlay (chat, polls, reactions, watch party)
- `/channel/[username]` — Creator profile + video list
- `/dashboard` — Creator dashboard (analytics, upload, earnings)
- `/dashboard/upload` — Direct upload flow to Cloudflare Stream
- `/dashboard/earnings` — Payout history + Stripe Connect status
- `/pricing` — Free / Citizen / VIP tier comparison + checkout entry
- `/sign-in`, `/sign-up` — BetterAuth flows

### 3.2 Backend API — Cloudflare Workers + Hono (`apps/worker`)

The entire backend is a single Cloudflare Worker using the [Hono](https://hono.dev) micro-framework. Routes are split into dedicated files under `src/routes/`.

| Route module | Responsibility |
|---|---|
| `routes/auth.ts` | BetterAuth session and entitlement endpoints |
| `routes/videos.ts` | CRUD, upload URL generation, signed playback URLs |
| `routes/channels.ts` | Public channel profiles and video listings |
| `routes/playlists.ts` | Playlist management |
| `routes/stripe.ts` | Checkout sessions, Connect onboarding, unlock payments |
| `routes/webhooks.ts` | Stripe event ingestion and entitlement updates |
| `routes/moderation.ts` | Report submission and admin resolution |

Supporting libraries under `src/lib/`:

| Module | Role |
|---|---|
| `auth.ts` | BetterAuth instance factory (Worker-compatible) |
| `db.ts` | Neon + Hyperdrive connection factory, returns Drizzle client |
| `entitlements.ts` | Single source of truth for `getUserEntitlements()` |
| `r2.ts` | R2 read/write helpers |
| `stream.ts` | Cloudflare Stream REST API wrappers (upload URL, analytics, signed URL) |
| `stripe.ts` | Stripe client factory with `constructEventAsync` for webhook verification |

### 3.3 Database — Neon Serverless Postgres (`packages/db`)

Accessed exclusively via **Cloudflare Hyperdrive** to eliminate cold-start latency from Workers. ORM: **Drizzle** with generated migrations.

#### Core Tables

| Table | Key columns |
|---|---|
| `users` | `id`, `email`, `username`, `role`, `user_tier` (enum: `free/citizen/vip`), `subscription_status` (enum: `none/trial/active/canceled/past_due`), `trial_ends_at`, `ad_preferences` (jsonb) |
| `videos` | `id`, `creator_id`, `cloudflare_stream_id`, `title`, `status` (enum: `processing/ready/live/unlisted/deleted`), `visibility` (enum: `public/subscribers_only/unlocked_only`), `views_count`, `likes_count` |
| `subscriptions` | `id`, `subscriber_id`, `creator_id`, `stripe_subscription_id`, `status`, `created_by_trial`, `trial_period_days` |
| `connected_accounts` | `id`, `user_id`, `stripe_account_id`, `charges_enabled`, `payouts_enabled` |
| `earnings` | `id`, `creator_id`, `video_id`, `amount_cents`, `currency`, `type` (enum: `subscription/ad/unlock/tip`), `paid_out` |
| `chat_messages` | `id`, `video_id`, `user_id`, `content`, `type`, `is_deleted`, `user_tier` |
| `polls` | `id`, `video_id`, `creator_id`, `question`, `options` (jsonb), `is_active` |
| `poll_votes` | `id`, `poll_id`, `user_id`, `option_index` — unique constraint on `(poll_id, user_id)` |
| `video_unlocks` | `id`, `user_id`, `video_id`, `stripe_payment_intent_id` — unique constraint on `(user_id, video_id)` |
| `playlists` | `id`, `creator_id`, `title`, `description`, `is_public` |
| `playlist_videos` | `id`, `playlist_id`, `video_id`, `position` |
| `moderation_reports` | `id`, `reporter_id`, `content_type`, `content_id`, `reason`, `status` |

### 3.4 Real-Time — Durable Objects (`apps/worker/src/durable-objects/`)

#### `VideoRoom` (one instance per `videoId`)

Manages all real-time state for a single video or live stream. Uses the **WebSocket Hibernation API** so connections survive Worker restarts and idle costs approach zero.

**Persisted in DO storage (survives hibernation):**
- `chatHistory` — last 100 messages (full `StoredChatMessage[]`)
- `activePoll` — current poll + vote tallies by option index
- `reactionCounts` — emoji → count map

**In-memory during active session:**
- `sessions` — `Map<userId, Session>` where `Session` carries the live `WebSocket` handle, `userTier`, and `lastMessageAt` for rate limiting
- `watchPartyState` — `{ isPlaying, currentTimeSeconds, updatedAt, hostUserId | null }`

**Per-tier privileges enforced at the DO:**

| Privilege | Free | Citizen | VIP |
|---|---|---|---|
| Read chat | ✓ | ✓ | ✓ |
| Send chat | ✓ (rate-limited 10 s) | ✓ (1 s) | ✓ (0.5 s) |
| Create poll | ✗ | ✓ (creator only) | ✓ (creator only) |
| Vote in poll | ✓ | ✓ | ✓ |
| Host watch party | ✗ | ✓ | ✓ |
| Join watch party | ✓ (passive) | ✓ (interactive) | ✓ (interactive) |
| Reaction badge | — | Citizen badge | VIP badge |

#### `UserPresence` (one instance per `userId`)
Tracks online/offline status and `lastSeen` timestamp. Lightweight; updated on WS connect and disconnect events.

### 3.5 Video — Cloudflare Stream

| Feature | Details |
|---|---|
| Upload | Direct creator uploads via signed `direct_upload` URLs (never hits the Worker's memory) |
| Encoding | Automatic multi-bitrate HLS — encoding and ingress are free |
| Delivery | Global edge delivery; ~$1 per 1,000 minutes delivered |
| Storage | ~$5 per 1,000 minutes stored/month |
| Live | RTMPS/SRT ingest → HLS delivery + automatic VOD recording |
| Player | Cloudflare Stream iframe embed with `postMessage` API for player control (`useVideoPlayer.ts`) |
| Access control | Short-lived signed playback tokens generated per request for `subscribers_only` and `unlocked_only` videos |
| Analytics | Per-video view counts and watch time via Stream Analytics API (polled in dashboard) |
| Ad insertion (planned) | VAST tag injection at the player layer for free-tier users only |

### 3.6 Payments — Stripe

| Flow | Implementation |
|---|---|
| Platform subscriptions | Stripe Billing (`Checkout Session` with `mode: "subscription"`) |
| Video unlocks | Stripe Payments (`PaymentIntent` one-time) |
| Creator Connect onboarding | Stripe Connect Express `AccountLink` flow |
| Creator payouts | Destination charges with `application_fee_amount`; Stripe handles bank disbursement |
| Webhooks | `POST /api/webhooks/stripe` — verified with `constructEventAsync` |
| Entitlement updates | `customer.subscription.*` events → update `users.user_tier` and `subscription_status` in Neon |
| Tax / 1099 | Handled automatically by Stripe for US creators |

**Subscription products (configured in Stripe dashboard):**

| Product | Price ID env var | Amount |
|---|---|---|
| Citizen Monthly | `STRIPE_CITIZEN_MONTHLY_PRICE` | $1.00 / month |
| Citizen Annual | `STRIPE_CITIZEN_ANNUAL_PRICE` | $10.00 / year |
| VIP Monthly | `STRIPE_VIP_MONTHLY_PRICE` | $5–9 / month (TBD) |

---

## 4. Request Lifecycle Examples

### 4.1 Video Watch (authenticated Citizen)

```
Browser → GET /watch/[videoId]  (Next.js SSR)
  → Worker GET /api/videos/:id
      → Neon: SELECT video WHERE id = ?
      → entitlements check (getUserEntitlements)
        → video.visibility = 'public' → allow
        → video.visibility = 'subscribers_only'
            → check users.user_tier ∈ {citizen, vip} OR video_unlocks row
      → Cloudflare Stream: generate signed playback URL (5-min TTL)
      → return { video, playbackUrl }
  → Next.js renders VideoPlayer with signed playback URL
  → Browser connects WebSocket → /api/ws/:videoId
      → VideoRoom DO WebSocket upgrade
      → DO loads persisted chatHistory, activePoll, reactionCounts
      → Session registered with userTier from session token
```

### 4.2 Stripe → Entitlement Update

```
Stripe event: customer.subscription.updated (status: active)
  → POST /api/webhooks/stripe
      → Worker verifies Stripe signature (constructEventAsync)
      → lookup subscriptions row by stripe_subscription_id
      → UPDATE users SET user_tier='citizen', subscription_status='active'
      → next WS connection or API call reflects new tier
```

### 4.3 Creator Upload

```
Creator → POST /api/videos/upload-url
  → Worker calls Cloudflare Stream direct_upload API
  → returns { uploadUrl, streamId }
Browser → PUT {uploadUrl}  (direct to Cloudflare; never transits Worker)
  → Cloudflare Stream encodes asynchronously
  → Creator POSTs metadata to Worker → INSERT INTO videos
  → Stream webhook (or polling) updates videos.status = 'ready'
```

---

## 5. Entitlement Model

Single function `getUserEntitlements(userId, db)` in `lib/entitlements.ts` returns:

```typescript
{
  tier: "free" | "citizen" | "vip",
  canAccessVideo: (video: Video) => boolean,
  canChat: boolean,
  chatRateLimitMs: number,
  canCreatePoll: boolean,
  canHostWatchParty: boolean,
  showAds: boolean,
}
```

This is the canonical truth used by:
- Worker route handlers (HTTP access gating)
- VideoRoom DO (WebSocket privilege enforcement)
- Auth endpoint `GET /api/auth/entitlements` (client-side UI gating)

---

## 6. Phase 3: Ad-Supported Monetization

Phase 3 introduces a VAST-based ad tier to monetize free users while maintaining transparent creator payouts. This section documents the planned implementation.

### 6.1 Ad-Tier Architecture

**Data flow:**

```
Free User Watch (no Citizen tier)
    ↓
VideoPlayer component checks showAds flag from entitlements
    ↓
Stream player iframe URL includes ?ads=true query param
    ↓
Stream player injects VAST tag (or loads Google IMA SDK)
    ↓
Ad impression fires → browser logs to POST /api/ad-events
    ↓
ad_events table persists: (videoId, creatorId, adNetwork, estimatedRevenue, impressionAt)
    ↓
Monthly payout job: sum ad_revenue × engagement_weight → creator earnings
    ↓
Stripe Connect transfer includes ad revenue attribution
```

### 6.2 Schema Changes (Phase 3a: MVP)

**New table: `ad_events`**

```sql
CREATE TABLE ad_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  video_id UUID REFERENCES videos(id) NOT NULL,
  creator_id UUID REFERENCES users(id) NOT NULL,
  ad_network TEXT, -- 'google_ima', 'custom_vast', etc
  estimated_revenue_cents INT, -- CPM-based estimate
  impression_at TIMESTAMP WITH TIMEZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIMEZONE DEFAULT NOW()
);

CREATE INDEX ad_events_creator_id ON ad_events(creator_id);
CREATE INDEX ad_events_video_id ON ad_events(video_id);
CREATE INDEX ad_events_impression_at ON ad_events(impression_at);
```

**Earnings table addition:**

```sql
ALTER TABLE earnings ADD COLUMN ad_event_id UUID REFERENCES ad_events(id);
-- type column now includes: 'platform_subscription', 'video_unlock', 'platform_ad'
```

**User table addition (Phase 3c: Frequency capping):**

```sql
ALTER TABLE users ADD COLUMN last_ad_served_at TIMESTAMP WITH TIMEZONE;
-- For per-user frequency limiting (max 1 ad per 10 minutes)
```

### 6.3 Implementation Milestones

| Milestone | Owner | Timeline | Details |
|---|---|---|---|
| **3a** | Backend | Week 1 | Schema: create `ad_events` table + indexes; Worker: add `POST /api/ad-events` endpoint |
| **3b** | Frontend | Week 2 | VideoPlayer: add `ads` query param logic; entitlements: inject `showAds` flag |
| **3a** | Backend | Week 2 | Logging: asynchronous ad event persistence (non-blocking) + error handling |
| **3c** | Backend | Week 3 | Attribution job: monthly ad_revenue allocation by engagement weight |
| **3d** | Frontend | Week 3 | Dashboard: new "Earnings" tab breakdown (subscriptions vs. ads); Charts for ad impressions |
| **3e** | DevOps | Week 4 | Partner with ad network (Google IMA or custom VAST source) + CPM testing |
| **3f** | Frontend | Week 4 | Frequency capping UI: "Ad will resume in X seconds" tooltip for subsequent watches |

### 6.4 Tier Privileges (Updated)

| Feature | Free | Citizen | VIP |
|---|---|---|---|
| Ad impressions | Yes (1 per 10 min) | No | No |
| Video access | Public only | All | All + exclusive |
| Chat | Rate-limited (10s) | Unlimited (1s) | VIP badge (0.5s) |
| Reactions | View only | Full | Full + reactions |
| Watch party | Observe | Host/join | Host/join/private |

### 6.5 Monetization Impact

**Unit economics (with ads):**

```
Free user watch (10 min video):
  → ~2 ad impressions @ $2 CPM → $0.004 per watch
  → 20k free-tier watches/month → $80 ad revenue
  → Creator share (65%) → ~$52/month from ad tier alone

Blended ARPU (100k MAU, 80% free, 20% Citizen):
  → Subscription: 20k × $1/monthly = $20k
  → Ad revenue: 80k × $0.50 blended = $40k
  → Blended ARPU: ($20k + $40k) / 100k = $0.60 per MAU
```

---

## 7. Monorepo Layout

```
videoking/
├── apps/
│   ├── web/         Next.js 15 frontend
│   │   ├── src/app/           App Router pages + layouts
│   │   ├── src/components/    Shared React components
│   │   ├── src/hooks/         useVideoPlayer, useWebSocket
│   │   └── src/lib/           api.ts, auth-client.ts, utils.ts
│   └── worker/      Cloudflare Worker backend
│       ├── src/index.ts       Hono app entry + WS route + dashboard routes
│       ├── src/types.ts        Env bindings interface
│       ├── src/durable-objects/ VideoRoom, UserPresence
│       ├── src/lib/           auth, db, entitlements, r2, stream, stripe
│       └── src/routes/        auth, videos, channels, playlists, stripe, webhooks, moderation
├── packages/
│   ├── db/          Drizzle schema, migrations, drizzle.config.ts
│   └── types/       Shared TypeScript interfaces (UserTier, WSMessage, Poll, etc.)
├── turbo.json       Turborepo pipeline
└── pnpm-workspace.yaml
```

---

## 8. Environment Configuration

### Worker (`apps/worker/.dev.vars` / Cloudflare secret bindings)

| Variable | Purpose |
|---|---|
| `BETTER_AUTH_SECRET` | Cookie signing key |
| `STREAM_API_TOKEN` | Cloudflare Stream REST API token |
| `STREAM_ACCOUNT_ID` | Cloudflare account ID |
| `STREAM_CUSTOMER_DOMAIN` | Stream customer subdomain (for playback URLs) |
| `STRIPE_SECRET_KEY` | Stripe server-side key |
| `STRIPE_WEBHOOK_SECRET` | Webhook signature secret (`whsec_...`) |
| `APP_BASE_URL` | Frontend origin (CORS + redirect URLs) |
| `PLATFORM_FEE_PERCENT` | Platform cut on Connect charges (e.g., `20`) |
| `STRIPE_CITIZEN_MONTHLY_PRICE` | Stripe Price ID for $1/month |
| `STRIPE_CITIZEN_ANNUAL_PRICE` | Stripe Price ID for $10/year |
| `STRIPE_VIP_MONTHLY_PRICE` | Stripe Price ID for VIP tier |
| `CHAT_RATE_LIMIT_FREE_MS` | Free user chat cooldown (default: `10000`) |
| `CHAT_RATE_LIMIT_CITIZEN_MS` | Citizen chat cooldown (default: `1000`) |
| `CHAT_RATE_LIMIT_VIP_MS` | VIP chat cooldown (default: `500`) |
| `TRIAL_PERIOD_DAYS` | Citizen trial length on signup (default: `14`) |

### Web (`apps/web/.env.local`)

| Variable | Purpose |
|---|---|
| `NEXT_PUBLIC_API_URL` | Worker base URL |
| `NEXT_PUBLIC_APP_URL` | Frontend base URL |
| `NEXT_PUBLIC_SUBSCRIPTION_PRICE_MONTHLY` | Stripe Price ID (displayed in pricing UI) |
| `NEXT_PUBLIC_SUBSCRIPTION_PRICE_ANNUAL` | Stripe Price ID (displayed in pricing UI) |

### Wrangler bindings (`apps/worker/wrangler.toml`)

| Binding | Type | Purpose |
|---|---|---|
| `VIDEO_ROOM` | Durable Object | Real-time video rooms |
| `USER_PRESENCE` | Durable Object | Online presence tracking |
| `R2_BUCKET` | R2 | Asset storage |
| `HYPERDRIVE` | Hyperdrive | Neon connection pool |

---

## 9. Deployment

### Worker
```bash
cd apps/worker && pnpm deploy
```

### Web (Cloudflare Pages)
```bash
cd apps/web && pnpm build && pnpm deploy
```

### Database migrations
```bash
pnpm db:generate          # generate migration from schema changes
DATABASE_URL=postgres://... pnpm db:migrate
```

---

## 10. Known Gaps & Roadmap (from Implementation Audit)

| Priority | Gap | Impact |
|---|---|---|
| Critical | Subscriptions are still creator-linked, not platform-level | Revenue attribution and Citizen gating decouple incorrectly |
| Critical | VAST ad insertion not yet wired into the player | Free tier earns no ad revenue |
| High | Trial expiry messaging and post-trial downgrade flow incomplete | Conversion lifecycle broken |
| High | Analytics do not track trial conversion or ad impressions | Cannot measure funnel health |
| Medium | Pricing page checkout still routes through creator-centric billing entry | Last mile of upgrade funnel broken |
| Medium | Creator dashboard earnings do not break down by revenue source + payer tier | Obscures platform economics |

See [implementation-audit.md](./implementation-audit.md) for full details and recommended execution order.
