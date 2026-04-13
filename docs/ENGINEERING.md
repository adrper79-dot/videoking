# NicheStream — Engineering Reference

> **Last updated:** April 2026  
> **Audience:** Developers extending or maintaining the platform

---

## 1. Local Development Setup

### Prerequisites

| Tool | Version |
|---|---|
| Node.js | 20+ |
| pnpm | 9+ |
| Wrangler CLI | latest (`pnpm add -g wrangler`) |

### First-time setup

```bash
# 1. Clone and install
git clone <repo>
cd videoking
pnpm install

# 2. Worker secrets (development only — do not commit)
# Create apps/worker/.dev.vars with the variables listed in ARCHITECTURE.md §7

# 3. Web env
# Create apps/web/.env.local with the variables listed in ARCHITECTURE.md §7

# 4. Wrangler bindings
# Edit apps/worker/wrangler.toml:
#   Replace YOUR_HYPERDRIVE_ID with your Hyperdrive binding ID
#   Replace STREAM_ACCOUNT_ID and STREAM_CUSTOMER_DOMAIN values

# 5. Database
pnpm db:generate
DATABASE_URL=postgres://... pnpm db:migrate

# 6. Run everything
pnpm dev       # starts both web (localhost:3000) and worker (localhost:8787) via Turborepo
```

### Individual app dev

```bash
# Worker only
cd apps/worker && pnpm dev

# Web only
cd apps/web && pnpm dev
```

---

## 2. Build & Typecheck

```bash
pnpm build              # build all packages + apps
pnpm typecheck          # tsc --noEmit across all workspaces

# Scope to one package
pnpm --filter @nichestream/worker typecheck
pnpm --filter @nichestream/web build
```

Packages are ordered by Turborepo dependency graph: `packages/types` → `packages/db` → `apps/*`.

---

## 3. Database Workflow

Schema source of truth: `packages/db/src/schema/`

```bash
# After editing any schema file:
pnpm db:generate         # generates a new migration file

# Apply to local/remote Neon:
DATABASE_URL=postgres://... pnpm db:migrate

# Open Drizzle Studio (visual DB browser):
DATABASE_URL=postgres://... pnpm db:studio
```

### Adding a new table

1. Create `packages/db/src/schema/your-table.ts`
2. Export it from `packages/db/src/schema/index.ts`
3. Add any necessary relations in the `index.ts` relations block
4. Run `pnpm db:generate` and commit both the schema file and the generated migration

---

## 4. Worker API Reference

Base URL (production): defined by your Cloudflare Worker deployment  
Base URL (local): `http://localhost:8787`

All API routes are prefixed with `/api/`. Auth uses BetterAuth session cookies. The `Authorization` header is not used — all requests must carry the session cookie.

### 4.1 Auth

| Method | Path | Auth | Description |
|---|---|---|---|
| `POST` | `/api/auth/sign-up` | — | Create account |
| `POST` | `/api/auth/sign-in/email` | — | Email/password sign-in |
| `POST` | `/api/auth/sign-out` | Required | Invalidate session |
| `GET` | `/api/auth/session` | — | Current session or null |
| `GET` | `/api/auth/entitlements` | Optional | Full entitlement object (tier, limits, trial status) |
| `POST` | `/api/auth/trial/activate` | Required | Manually activate Citizen trial |

```typescript
// GET /api/auth/entitlements response (AuthEntitlements type)
{
  authenticated: true,
  user: {
    id: string,
    username: string,
    displayName: string,
    avatarUrl: string | null,
    role: "viewer" | "creator" | "admin",
    userTier: "free" | "citizen" | "vip",
    effectiveTier: "free" | "citizen" | "vip",  // accounts for active trial
    subscriptionStatus: "none" | "trial" | "active" | "canceled" | "past_due",
    trialEndsAt: string | null,
  },
  limits: {
    chatRateLimitMs: number,
    canCreatePolls: boolean,
    canUseWatchParty: boolean,
    adFree: boolean,
  }
}
```

### 4.2 Videos

| Method | Path | Auth | Description |
|---|---|---|---|
| `GET` | `/api/videos` | — | Paginated public video feed |
| `GET` | `/api/videos/:id` | Optional | Single video; signed URL if access granted |
| `POST` | `/api/videos/upload-url` | Required (creator) | Get direct Stream upload URL |
| `PATCH` | `/api/videos/:id` | Required (owner) | Update title, description, visibility |
| `DELETE` | `/api/videos/:id` | Required (owner) | Soft delete (sets status to `deleted`) |

```typescript
// GET /api/videos query params
{ page?: number, pageSize?: number (max 50) }

// GET /api/videos/:id response (when access granted for protected videos)
{
  video: Video,
  playbackUrl: string    // signed Cloudflare Stream URL (5-min TTL)
}
```

**Access control logic for `GET /api/videos/:id`:**

```
visibility = "public"         → always allowed; unsigned playback URL
visibility = "subscribers_only" → allowed if effectiveTier ∈ {citizen, vip};
                                  signed URL returned on success
visibility = "unlocked_only"  → allowed if video_unlocks row exists for user;
                                  signed URL returned on success
```

### 4.3 Channels

| Method | Path | Auth | Description |
|---|---|---|---|
| `GET` | `/api/channels/:username` | — | Creator profile + paginated video list |

### 4.4 Playlists

| Method | Path | Auth | Description |
|---|---|---|---|
| `GET` | `/api/playlists` | Required | List all playlists for authenticated user |
| `POST` | `/api/playlists` | Required | Create playlist |
| `PATCH` | `/api/playlists/:id` | Required (owner) | Update playlist |
| `DELETE` | `/api/playlists/:id` | Required (owner) | Delete playlist |
| `POST` | `/api/playlists/:id/videos` | Required (owner) | Add video to playlist |
| `DELETE` | `/api/playlists/:id/videos/:videoId` | Required (owner) | Remove video from playlist |

### 4.5 Stripe

| Method | Path | Auth | Description |
|---|---|---|---|
| `POST` | `/api/stripe/connect/onboard` | Required | Begin Stripe Connect Express onboarding |
| `GET` | `/api/stripe/connect/status` | Required | Check Connect account readiness |
| `POST` | `/api/stripe/subscriptions` | Required | Create Checkout Session for Citizen/VIP plan |
| `POST` | `/api/stripe/unlock` | Required | Create PaymentIntent for one-time video unlock |

```typescript
// POST /api/stripe/subscriptions body
{ plan: "monthly" | "annual", tier: "citizen" | "vip" }

// POST /api/stripe/unlock body
{ videoId: string }
```

### 4.6 Webhooks

| Method | Path | Auth | Description |
|---|---|---|---|
| `POST` | `/api/webhooks/stripe` | Stripe signature | Handles all Stripe events |

Handled Stripe events:

| Event | Action |
|---|---|
| `customer.subscription.created` | Insert subscription; promote user tier |
| `customer.subscription.updated` | Update subscription status; recompute tier |
| `customer.subscription.deleted` | Cancel subscription; downgrade tier to `free` |
| `invoice.payment_failed` | Set `subscription_status = past_due` |
| `payment_intent.succeeded` | Record unlock purchase in `video_unlocks` |

### 4.7 Moderation

| Method | Path | Auth | Description |
|---|---|---|---|
| `POST` | `/api/moderation/report` | Required | Submit content report |
| `GET` | `/api/moderation/reports` | Required (admin) | List open reports |
| `PATCH` | `/api/moderation/reports/:id` | Required (admin) | Resolve report |

### 4.8 Dashboard

| Method | Path | Auth | Description |
|---|---|---|---|
| `GET` | `/api/dashboard/earnings` | Required (creator) | 30-day earnings summary |
| `GET` | `/api/dashboard/analytics` | Required (creator) | Stream analytics for creator's videos |

### 4.9 WebSocket (Real-Time)

```
GET /api/ws/:videoId    (with Upgrade: websocket header)
```

Upgrades the connection to the `VideoRoom` Durable Object for the given `videoId`. Pass identity as query params (Worker reads from session where possible):

```
/api/ws/:videoId?userId=...&username=...&avatarUrl=...
```

---

## 5. WebSocket Message Protocol

All messages are JSON-encoded. The shared types are in `packages/types/src/index.ts`.

### Client → Server messages

```typescript
type ClientMessage =
  | { type: "chat";     content: string }
  | { type: "reaction"; emoji: string }
  | { type: "poll_create"; question: string; options: string[] }
  | { type: "poll_vote"; pollId: string; optionIndex: number }
  | { type: "watch_party_sync"; isPlaying: boolean; currentTimeSeconds: number }
  | { type: "ping" }
```

### Server → Client broadcast messages

```typescript
type ServerMessage =
  | { type: "chat_message";      message: StoredChatMessage }
  | { type: "reaction_update";   emoji: string; count: number }
  | { type: "poll_update";       poll: Poll & { votes: Record<string, number> } }
  | { type: "watch_party_state"; state: WatchPartyState }
  | { type: "user_joined";       userId: string; username: string; userTier: UserTier }
  | { type: "user_left";         userId: string }
  | { type: "error";             code: string; message: string }
  | { type: "pong" }
```

### Connection init (server → client on connect)

```typescript
{
  type: "init",
  chatHistory: StoredChatMessage[],   // last 100 messages
  activePoll: Poll | null,
  reactionCounts: Record<string, number>,
  watchPartyState: WatchPartyState,
  onlineCount: number,
}
```

---

## 6. Entitlement System

### `getUserEntitlements(userId, db, env)`

Located in `apps/worker/src/lib/entitlements.ts`. This is the canonical access control function used across all route handlers and the VideoRoom DO.

```typescript
// Effective tier calculation
function getEffectiveTier(user): UserTier {
  if (user.userTier === "vip")     return "vip"
  if (user.userTier === "citizen") return "citizen"
  if (isTrialActive(user.trialEndsAt)) return "citizen"   // trial = citizen privileges
  return "free"
}
```

**Key rule:** `effectiveTier` elevates a `free` user to `citizen` while their trial is active. All access checks use `effectiveTier`, never `userTier` directly.

### Trial lifecycle

```
Sign up
  → POST /api/auth/trial/activate (or auto-triggered by GET /api/auth/entitlements)
    → INSERT trial_ends_at = now() + TRIAL_PERIOD_DAYS
    → user.subscriptionStatus = "trial"
    → user.hasSeenOnboarding = true

Trial active → effectiveTier = "citizen"

Trial expires (trial_ends_at < now())
  → effectiveTier = "free" (no DB write needed; computed at read time)
  → Show "trial ended" prompt; direct to /pricing

User subscribes → Stripe webhook → user.userTier = "citizen" | "vip"
  → trial_ends_at becomes irrelevant (userTier takes over)
```

---

## 7. Monetization Implementation Details

### Tier gating — decision matrix

```
Request context     | Neon check                              | Outcome
--------------------|------------------------------------------|----------------------------
Unauthenticated     | —                                        | Free experience + ads
Free (no trial)     | userTier=free, no active trial           | Free experience + ads
Trial active        | trialEndsAt > now()                      | Citizen experience (no ads)
Citizen active      | userTier=citizen, subscriptionStatus=active | Full Citizen experience
Citizen past_due    | subscriptionStatus=past_due              | Degrade to free; nudge to update
Citizen canceled    | subscriptionStatus=canceled              | Downgrade to free
VIP active          | userTier=vip, subscriptionStatus=active  | Full VIP experience
```

### Revenue flow

```
Viewer subscribes ($1/month)
  → Stripe Checkout → customer.subscription.created webhook
  → Update users.user_tier = 'citizen'
  → Revenue allocated to creator pool (attribution by engagement share, TODO: platform-level)

Creator earns payout
  → Worker calculates earnings share based on views + interaction depth
  → INSERT INTO earnings { grossAmountCents, platformFeeCents, netAmountCents }
  → Stripe Connect: createTransfer to creator's connected_accounts.stripeAccountId
  → UPDATE earnings SET paid_out = true, stripe_transfer_id = ...

Free tier ad revenue (PLANNED)
  → VAST tag served in Stream player only when users.adFree = false
  → Ad impression tracked (ad_events table — not yet implemented)
  → Attributed to video/creator for monthly payout rollup
```

### Fee structure

```
Platform fee:   PLATFORM_FEE_PERCENT (env var, default 20%)
Stripe fee:     ~2.9% + $0.30 per successful charge
Creator net:    grossAmount × (1 - platformFeePct) - stripeFees (absorbed by platform)
```

---

## 8. Durable Object Patterns

### Creating or retrieving a VideoRoom

```typescript
// In a Worker route handler:
const id = c.env.VIDEO_ROOM.idFromName(videoId)   // deterministic ID from string
const stub = c.env.VIDEO_ROOM.get(id)
return stub.fetch(c.req.raw)
```

### WebSocket Hibernation API

VideoRoom uses `this.state.acceptWebSocket(ws)` rather than keeping a live event loop. This means:
- The DO is evicted from memory when all connections are idle
- Cloudflare re-hydrates it on the next incoming message
- Persistent state (chatHistory, activePoll, reactionCounts) is loaded from DO storage in the constructor via `blockConcurrencyWhile`

Pattern for handling hibernated messages:

```typescript
async webSocketMessage(ws: WebSocket, message: string | ArrayBuffer) {
  // ws is the hibernated session handle provided by the runtime
  // re-hydrate session context from DO storage if needed
}

async webSocketClose(ws: WebSocket) {
  // clean up session map entry
}
```

### Rate limiting in the DO

```typescript
const now = Date.now()
const session = this.sessions.get(userId)
const rateLimitMs = getRateLimitMs(session.userTier, this.env)

if (now - session.lastMessageAt < rateLimitMs) {
  ws.send(JSON.stringify({ type: "error", code: "RATE_LIMITED", message: "..." }))
  return
}
session.lastMessageAt = now
```

---

## 9. Cloudflare Stream Integration

### Upload flow

```typescript
// lib/stream.ts
export async function getDirectUploadUrl(accountId: string, apiToken: string): Promise<{
  uploadUrl: string,
  streamVideoId: string,
}> {
  const res = await fetch(
    `https://api.cloudflare.com/client/v4/accounts/${accountId}/stream/direct_upload`,
    {
      method: "POST",
      headers: { Authorization: `Bearer ${apiToken}`, "Content-Type": "application/json" },
      body: JSON.stringify({ maxDurationSeconds: 21600, requireSignedURLs: false }),
    }
  )
  const data = await res.json()
  return { uploadUrl: data.result.uploadURL, streamVideoId: data.result.uid }
}
```

### Signed playback URL (for protected videos)

```typescript
export async function getSignedStreamUrl(
  accountId: string, apiToken: string, streamVideoId: string
): Promise<string> {
  // POST to Stream API to create a signed token (5-min TTL by default)
  // Returns: https://customer-{domain}.cloudflarestream.com/{token}/iframe
}
```

### Polling video status after upload

Video encoding is asynchronous. Poll `GET /api/videos/:id` until `status === "ready"`, which is set when the Stream webhook (or manual re-check) confirms encoding is complete.

---

## 10. Stripe Webhook Security

```typescript
// apps/worker/src/lib/stripe.ts
import Stripe from "stripe"

export function createStripeClient(env: Env): Stripe {
  return new Stripe(env.STRIPE_SECRET_KEY, { apiVersion: "2024-06-20" })
}

// In the webhook route handler:
const body = await c.req.text()
const sig  = c.req.header("stripe-signature") ?? ""
// constructEventAsync is the Workers-compatible async version
const event = await stripe.webhooks.constructEventAsync(body, sig, env.STRIPE_WEBHOOK_SECRET)
```

**Never** use `constructEvent` (synchronous) in Workers — use `constructEventAsync`.

---

## 11. Shared Type Packages

### `@nichestream/types` (`packages/types/src/index.ts`)

Key exports:

```typescript
UserRole, UserTier, MembershipStatus
User, PublicUser
VideoStatus, VideoVisibility
Video, VideoUploadUrlResponse
SubscriptionPlan, SubscriptionStatus, Subscription
EarningType, EarningStatus, Earning, EarningsSummary
Poll, PollOption
WatchPartyState
WSMessage, WSMessageType
AuthEntitlements
```

### `@nichestream/db` (`packages/db/src/index.ts`)

Exports all Drizzle table objects and relations. Import directly in Worker code:

```typescript
import { users, videos, subscriptions, earnings } from "@nichestream/db"
```

---

## 12. Error Handling Conventions

All API routes return consistent JSON error shapes:

```typescript
{ error: string, message: string }   // HTTP 4xx / 5xx
```

Common error codes:

| Code | HTTP | Meaning |
|---|---|---|
| `Unauthorized` | 401 | No valid session |
| `Forbidden` | 403 | Session exists but lacks permission |
| `NotFound` | 404 | Resource does not exist |
| `ValidationError` | 422 | Bad request body |
| `InternalError` | 500 | Unexpected server error (details logged, not surfaced) |

WebSocket errors use `{ type: "error", code: string, message: string }` messages rather than connection closure.

---

## 13. Security Notes

- All Stripe webhook payloads are verified with `constructEventAsync` before processing.
- All protected video playback URLs use short-lived (5-min TTL) signed tokens from Cloudflare Stream.
- CORS is restricted to the frontend origin (`APP_BASE_URL`) in production — the `origin: (origin) => origin ?? "*"` pattern is development-only and should be locked down before launch.
- Session cookies are HttpOnly and Secure (handled by BetterAuth).
- Rate limiting is enforced per-user in the VideoRoom DO; additionally apply Cloudflare's built-in WAF/rate limiting rules at the account level for HTTP routes.
- SQL injection is not possible — all queries go through Drizzle's parameterized query builder.
- No secrets are exposed to the frontend; all Stripe operations that require the secret key happen in Workers only.
