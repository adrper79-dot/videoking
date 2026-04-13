# NicheStream Improvement Tracker

Generated: 2026-04-13 | Loop: 1

**Related docs:** [ARCHITECTURE.md](./ARCHITECTURE.md) · [ENGINEERING.md](./ENGINEERING.md) · [PRODUCT_PLAN.md](./PRODUCT_PLAN.md) · [CLAUDE_AGENT_PROMPT.md](./CLAUDE_AGENT_PROMPT.md)

---

## Legend

| Status | Meaning |
|---|---|
| 🔴 OPEN | Not started |
| 🟡 IN PROGRESS | Being worked on |
| 🟢 DONE | Fixed and verified |

---

## CRITICAL — Immediate Blockers (Security / Data Loss / Payment)

| ID | Status | File | Description |
|---|---|---|---|
| C-1 | 🔴 OPEN | `apps/web/src/app/api/auth/[...all]/route.ts` | Entire file body duplicated: `proxyAuthRequest` declared twice, all HTTP handlers declared twice — compile failure, auth completely broken |
| C-2 | 🔴 OPEN | `apps/worker/src/index.ts:31-39` | CORS reflects arbitrary origin with `credentials: true` — OWASP A05, cross-site credentialed request attack |
| C-3 | 🔴 OPEN | `apps/worker/src/routes/stripe.ts:~218-265` | `POST /api/stripe/unlock` accepts `creatorStripeAccountId` from request body → payment theft IDOR |
| C-4 | 🔴 OPEN | `apps/worker/src/durable-objects/VideoRoom.ts:93-115` | WebSocket identity falls back to `url.searchParams.get("userId")` on auth error → user/tier impersonation |
| C-5 | 🔴 OPEN | `apps/worker/src/routes/channels.ts:41-51` | Channel endpoint returns `subscribers_only`, `unlocked_only`, and `deleted` videos to anonymous users |
| C-6 | 🔴 OPEN | `apps/worker/src/lib/auth.ts`; `packages/db/src/schema/` | BetterAuth missing `session`, `account`, `verification` DB tables → auth broken at runtime |
| C-7 | 🔴 OPEN | `apps/worker/src/routes/webhooks.ts:~185-210` | Subscription earnings insert fires on every `customer.subscription.updated` → duplicate revenue records |
| C-8 | 🔴 OPEN | `apps/worker/src/routes/webhooks.ts:14-90` | No Stripe webhook idempotency check → duplicate event delivery doubles all financial records |
| C-9 | 🔴 OPEN | `apps/worker/src/routes/stripe.ts:~155-185`; `webhooks.ts:~185-210` | Subscription checkout has no `application_fee_amount` or `transfer_data` → creators never paid, all earnings stuck as `pending` |

---

## HIGH — Product Incompleteness

| ID | Status | File | Description |
|---|---|---|---|
| H-1 | 🔴 OPEN | `apps/web/src/components/CreatorDashboard.tsx` | Entire component physically duplicated → compile error, `/dashboard` fails to build |
| H-2 | 🔴 OPEN | `apps/web/src/components/VideoPlayer.tsx:35` | Hardcoded `customer-stream.cloudflarestream.com` subdomain → all public videos unplayable |
| H-3 | 🔴 OPEN | `apps/web/src/app/watch/[videoId]/page.tsx:50-60` | `InteractivityOverlay` rendered without user identity → all chat appears as "Guest" |
| H-4 | 🔴 OPEN | `apps/worker/src/routes/` (missing) | Tip feature (`EarningType.tip`) has no `POST /api/stripe/tip` endpoint |
| H-5 | 🔴 OPEN | `packages/db/src/schema/videos.ts`; `routes/stripe.ts:~215-225` | No `unlockPriceCents` on `videos` table; unlock accepts client `amountCents` without server validation |
| H-6 | 🔴 OPEN | `apps/worker/src/index.ts:~175-205` | `DashboardAnalytics.subscriberCount` declared in types but never returned by the API |
| H-7 | 🔴 OPEN | `packages/types/src/index.ts:265-273` | `VideoAnalytics` fields `uniqueViewers`, `averageViewDurationSeconds`, `peakConcurrentViewers` don't match API response |
| H-8 | 🔴 OPEN | `apps/worker/src/routes/stripe.ts:~183` | Subscription `cancel_url` uses creator UUID instead of username → 404 redirect |
| H-9 | 🔴 OPEN | `apps/worker/src/durable-objects/VideoRoom.ts:97,127` | All anonymous WebSocket sessions share Map key `"anonymous"` → presence corrupted, rate-limit shared |
| H-10 | 🔴 OPEN | `packages/db/src/schema/playlists.ts:15-26` | `playlist_videos` junction table has no unique constraint on `(playlistId, videoId)` → duplicates allowed |
| H-11 | 🔴 OPEN | `apps/worker/src/durable-objects/VideoRoom.ts` | Chat, polls, votes only in DO storage (100 msg cap, ephemeral) — DB tables defined but unused |
| H-12 | 🔴 OPEN | `apps/worker/wrangler.toml` | `APP_BASE_URL` not in `[vars]` → BetterAuth + Stripe redirect URLs are `undefined` in production |

---

## MEDIUM — Code Quality / Performance

| ID | Status | File | Description |
|---|---|---|---|
| M-1 | 🔴 OPEN | `apps/worker/src/lib/entitlements.ts:115-122` | `getUserEntitlements` triggers a DB write (trial activation) on every read |
| M-2 | 🔴 OPEN | `packages/db/src/schema/` (videos, interactions, subscriptions, earnings) | Missing indexes on `creatorId`, `(status, visibility)`, `videoId`, `(subscriberId, status)`, `(creatorId, createdAt)` |
| M-3 | 🔴 OPEN | `apps/worker/src/index.ts:~185-200` | Dashboard analytics fires up to 10 concurrent Cloudflare Stream HTTP calls per request |
| M-4 | 🔴 OPEN | `apps/worker/src/routes/videos.ts:46-55` | Video feed uses 2 DB round-trips (data + COUNT) — use window function instead |
| M-5 | 🔴 OPEN | `apps/web/src/app/(auth)/sign-in/page.tsx:28-70` | Sign-in uses raw HTML form POST (url-encoded); BetterAuth expects JSON — inconsistency with sign-up |
| M-6 | 🔴 OPEN | `apps/worker/src/durable-objects/VideoRoom.ts:~330` | `activePoll.videoId` hardcoded to empty string |
| M-7 | 🔴 OPEN | `apps/worker/src/durable-objects/VideoRoom.ts:~296` | `emoji.slice(0, 2)` corrupts multi-codepoint emoji (skin tone, flags) |
| M-8 | 🔴 OPEN | `Navbar.tsx:18`, `InteractivityOverlay.tsx:40`, `PricingClient.tsx:19` | Entitlements fetched independently in 3 components → 3 identical parallel requests per page |
| M-9 | 🔴 OPEN | `apps/web/src/lib/auth-client.ts:8` | `authClient` `baseURL` points directly to Worker, bypassing Next.js auth proxy |
| M-10 | 🔴 OPEN | `apps/web/src/components/WatchParty.tsx:25-45` | Watch party host sync always sends `currentTimeSeconds: 0` → resets all viewers to start |
| M-11 | 🔴 OPEN | `apps/worker/src/lib/auth.ts:22` | Email verification disabled, no server-side password policy |

---

## BUILD / CONFIG

| ID | Status | File | Description |
|---|---|---|---|
| BC-1 | 🔴 OPEN | `apps/worker/wrangler.toml:19` | `id = "YOUR_HYPERDRIVE_ID"` placeholder — wrangler deploy fails |
| BC-2 | 🔴 OPEN | `apps/web/package.json:9` | `deploy` script targets `.vercel/output/static` without running `next-on-pages` first |
| BC-3 | 🔴 OPEN | `packages/types/package.json` | No `typecheck` script — Turbo silently skips types package |
| BC-4 | 🔴 OPEN | `apps/worker/wrangler.toml` | `STREAM_ACCOUNT_ID`, `STREAM_CUSTOMER_DOMAIN` empty; other required secrets undocumented |
| BC-5 | 🔴 OPEN | `apps/web/next.config.ts:6` | `images: { unoptimized: true }` without Cloudflare Image Resizing loader |
| BC-6 | 🔴 OPEN | `apps/worker/wrangler.toml`; `apps/worker/src/types.ts:43` | `ASSETS: Fetcher` in `Env` with no matching `[assets]` binding in wrangler.toml |

---

## CROSS-CUTTING — Patterns Across Multiple Files

| ID | Status | Affected Files | Description |
|---|---|---|---|
| XC-1 | 🔴 OPEN | All route handlers | `createDb` + `createAuth` instantiated on every request, no per-isolate caching |
| XC-2 | 🔴 OPEN | `CreatorDashboard`, `EarningsTable`, `Navbar`, `PricingClient`, `InteractivityOverlay` | Async errors silently swallowed; no error UI state set |
| XC-3 | 🔴 OPEN | `routes/moderation.ts:52-58, 88-94` | Admin role check duplicated in every handler — should be middleware |
| XC-4 | 🔴 OPEN | `routes/videos.ts`, `VideoRoom.ts` | Session validation not via shared middleware → easy to miss on new routes |

---

## Completed Items

_(empty — loop 1 in progress)_

---

## Execution Order (Current Loop)

1. **C-6** — Add BetterAuth tables to schema + migrate ← auth prerequisite for everything
2. **C-1, H-1** — Remove duplicate declarations ← compile prerequisite
3. **C-2** — Fix CORS allowlist
4. **C-3, H-5** — Fix Stripe unlock (fetch account + price from DB)
5. **C-4, H-9** — Fix WebSocket anonymous identity
6. **C-5** — Filter private videos from channel endpoint
7. **C-7, C-8** — Webhook idempotency + earnings dedup
8. **C-9, H-8** — Subscription payout flow + cancel_url fix
9. **H-2** — Fix VideoPlayer Stream subdomain
10. **H-3** — Fix identity propagation to InteractivityOverlay
11. **H-6, H-7** — Fix dashboard analytics types
12. **H-10** — playlist_videos unique constraint
13. **H-12, BC-4** — wrangler.toml env vars
14. **M-2** — DB indexes migration
15. **M-5** — Sign-in form to JSON client
16. **M-6, M-7** — activePoll.videoId + emoji fix
17. **M-8** — EntitlementsContext provider
18. **XC-2** — Error states in all components
19. **XC-3** — requireAdmin middleware
20. **BC-2, BC-3** — Build script fixes
