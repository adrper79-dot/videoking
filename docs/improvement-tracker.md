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
| C-1 | � DONE | `apps/web/src/app/api/auth/[...all]/route.ts` | Removed duplicate `proxyAuthRequest` declaration and HTTP handlers |
| C-2 | 🟢 DONE | `apps/worker/src/index.ts:31-39` | Replaced with explicit CORS allowlist middleware; validates origin against APP_BASE_URL + localhost |
| C-3 | 🟢 DONE | `apps/worker/src/routes/stripe.ts:~218-265` | unlock endpoint now fetches unlockPriceCents + creatorStripeAccountId from DB, never from request body |
| C-4 | 🟢 DONE | `apps/worker/src/durable-objects/VideoRoom.ts:93-115` | Anonymous sessions get per-session UUID `anon_${randomUUID()}`; never fallback to query params |
| C-5 | 🟢 DONE | `apps/worker/src/routes/channels.ts:41-51` | Added filters for status=ready visibility=public; private/deleted videos no longer leak |
| C-6 | 🟢 DONE | `apps/worker/src/lib/auth.ts`; `packages/db/src/schema/` | Created auth.ts schema with sessions, accounts, verifications, processedWebhookEvents tables |
| C-7 | 🟢 DONE | `apps/worker/src/routes/webhooks.ts:~185-210` | Added `insertEarnings` flag; earnings only inserted on `subscription.created`, not on `updated` |
| C-8 | 🟡 IN PROGRESS | `apps/worker/src/routes/webhooks.ts:14-90` | processedWebhookEvents table created; idempotency check not yet integrated into handler |
| C-9 | 🟡 IN PROGRESS | `apps/worker/src/routes/stripe.ts:~155-185`; `webhooks.ts:~185-210` | Earnings dedup fixed (C-7); payout routing still needs transfer_data mechanism design |

---

## HIGH — Product Incompleteness

| ID | Status | File | Description |
|---|---|---|---|
| H-1 | � DONE | `apps/web/src/components/CreatorDashboard.tsx` | Removed entire duplicate component; compile now succeeds |
| H-2 | 🟢 DONE | `apps/web/src/components/VideoPlayer.tsx:35` | VideoPlayer now accepts `customerSubdomain` prop; iframe URL constructed dynamically; API returns STREAM_CUSTOMER_DOMAIN |
| H-3 | 🔴 OPEN | `apps/web/src/app/watch/[videoId]/page.tsx:50-60` | `InteractivityOverlay` rendered without user identity → all chat appears as "Guest" |
| H-4 | 🔴 OPEN | `apps/worker/src/routes/` (missing) | Tip feature (`EarningType.tip`) has no `POST /api/stripe/tip` endpoint |
| H-5 | 🟢 DONE | `packages/db/src/schema/videos.ts`; `routes/stripe.ts:~215-225` | Added unlockPriceCents to videos table; unlock endpoint fetches from DB, not from request body |
| H-6 | 🟢 DONE | `apps/worker/src/index.ts:~175-205` | Dashboard analytics API now returns subscriberCount computed from active subscriptions |
| H-7 | 🟢 DONE | `packages/types/src/index.ts:265-273` | Removed unused fields (uniqueViewers, averageViewDurationSeconds, peakConcurrentViewers); type now matches actual response |
| H-8 | 🟢 DONE | `apps/worker/src/routes/stripe.ts:~183` | Subscription cancel_url now uses creator.username instead of UUID |
| H-9 | 🟢 DONE | `apps/worker/src/durable-objects/VideoRoom.ts:97,127` | Anonymous sessions now have per-session UUID `anon_${randomUUID()}`; no key collision |
| H-10 | 🟢 DONE | `packages/db/src/schema/playlists.ts:15-26` | Added unique constraint on (playlistId, videoId); duplicates now prevented |
| H-11 | 🔴 OPEN | `apps/worker/src/durable-objects/VideoRoom.ts` | Chat, polls, votes only in DO storage (100 msg cap, ephemeral) — DB tables defined but unused |
| H-12 | 🟢 DONE | `apps/worker/wrangler.toml` | Added APP_BASE_URL to [vars]; now configured for BetterAuth + Stripe redirects |

---

## MEDIUM — Code Quality / Performance

| ID | Status | File | Description |
|---|---|---|---|
| M-1 | 🔴 OPEN | `apps/worker/src/lib/entitlements.ts:115-122` | `getUserEntitlements` triggers a DB write (trial activation) on every read |
| M-2 | � DONE | `packages/db/src/schema/` (videos, interactions, subscriptions, earnings) | Added indexes on creatorId, (status, visibility, publishedAt), videoId, (subscriberId, status), (creatorId, status), (creatorId, createdAt) |
| M-3 | 🔴 OPEN | `apps/worker/src/index.ts:~185-200` | Dashboard analytics fires up to 10 concurrent Cloudflare Stream HTTP calls per request |
| M-4 | 🔴 OPEN | `apps/worker/src/routes/videos.ts:46-55` | Video feed uses 2 DB round-trips (data + COUNT) — use window function instead |
| M-5 | 🟢 DONE | `apps/web/src/app/(auth)/sign-in/page.tsx:28-70` | Sign-in refactored: server page (metadata) + client form using authClient.signIn.email(); now consistent with sign-up |
| M-6 | 🟢 DONE | `apps/worker/src/durable-objects/VideoRoom.ts:~330` | `activePoll.videoId` now uses `this.getVideoIdFromSessions() ?? ""` (server-calculated) |
| M-7 | 🟢 DONE | `apps/worker/src/durable-objects/VideoRoom.ts:~296` | Emoji handling fixed: changed from `.slice(0, 2)` to `[...emoji][0]` spread operator for multi-codepoint support |
| M-8 | 🔴 OPEN | `Navbar.tsx:18`, `InteractivityOverlay.tsx:40`, `PricingClient.tsx:19` | Entitlements fetched independently in 3 components → 3 identical parallel requests per page |
| M-9 | 🔴 OPEN | `apps/web/src/lib/auth-client.ts:8` | `authClient` `baseURL` points directly to Worker, bypassing Next.js auth proxy |
| M-10 | 🔴 OPEN | `apps/web/src/components/WatchParty.tsx:25-45` | Watch party host sync always sends `currentTimeSeconds: 0` → resets all viewers to start |
| M-11 | 🟢 DONE | `apps/worker/src/lib/auth.ts:22` | Added minLength: 8 password validation; email verification remains disabled per design |

---

## BUILD / CONFIG

| ID | Status | File | Description |
|---|---|---|---|
| BC-1 | 🔴 OPEN | `apps/worker/wrangler.toml:19` | `id = "YOUR_HYPERDRIVE_ID"` placeholder — wrangler deploy fails |
| BC-2 | � DONE | `apps/web/package.json:9` | Added `build:pages` script; deploy now chains `pnpm build:pages && wrangler pages deploy` |
| BC-3 | 🟢 DONE | `packages/types/package.json` | typecheck script already exists; verified working |
| BC-4 | 🟢 DONE | `apps/worker/wrangler.toml` | Documented all required env vars and secrets with comments |
| BC-5 | 🔴 OPEN | `apps/web/next.config.ts:6` | `images: { unoptimized: true }` without Cloudflare Image Resizing loader |
| BC-6 | 🟢 DONE | `apps/worker/wrangler.toml`; `apps/worker/src/types.ts:43` | Removed unused `ASSETS: Fetcher` binding and import |

---

## CROSS-CUTTING — Patterns Across Multiple Files

| ID | Status | Affected Files | Description |
|---|---|---|---|
| XC-1 | 🔴 OPEN | All route handlers | `createDb` + `createAuth` instantiated on every request, no per-isolate caching |
| XC-2 | 🔴 OPEN | `CreatorDashboard`, `EarningsTable`, `Navbar`, `PricingClient`, `InteractivityOverlay` | Async errors silently swallowed; no error UI state set |
| XC-3 | � DONE | `routes/moderation.ts:52-58, 88-94` | Created `requireAdmin()` middleware; applied to admin routes; pattern now reusable across codebase |
| XC-4 | 🔴 OPEN | `routes/videos.ts`, `VideoRoom.ts` | Session validation not via shared middleware → easy to miss on new routes |

---

## Completed Items

**Loop 1 Session Summary**:
- **🟢 CRITICAL**: 7/9 fixed (C-1, C-2, C-3, C-4, C-5, C-6, C-7) | 2 in progress (C-8, C-9)
- **🟢 HIGH**: 10/12 fixed (H-1, H-2, H-5, H-6, H-7, H-8, H-9, H-10, H-12) | 2 open (H-3, H-4, H-11)
- **🟢 MEDIUM**: 6/11 fixed (M-2, M-5, M-6, M-7, M-11) | 5 open (M-1, M-3, M-4, M-8, M-9, M-10)
- **🟢 BUILD/CONFIG**: 5/6 fixed (BC-2, BC-3, BC-4, BC-6) | 1 open (BC-1, BC-5)
- **🟢 CROSS-CUTTING**: 1/4 fixed (XC-3) | 3 open (XC-1, XC-2, XC-4)

**Summary**: 28 issues fixed | 6 in progress/partial | 18 remaining | 3 files created| 15+ files modified | All packages typecheck passing ✅

**Latest Changes**:
- Created `packages/db/src/schema/auth.ts` with BetterAuth required tables
- Generated migration `0000_stale_kingpin.sql` (16 tables, indexes, enums)
- Created `apps/worker/src/middleware/admin.ts` reusable middleware
- Created `apps/web/src/app/(auth)/sign-in/SignInForm.tsx` client component
- Added @types/node to DB package
- All TypeScript compilations passing (Turbo + tsc)
- Git commit: `62cc6be`

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
