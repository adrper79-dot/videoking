# NicheStream (videoking) — Workspace Copilot Instructions

## Project at a Glance

Monorepo: **pnpm workspaces + Turborepo**

| App/Package | Path | Runtime |
|---|---|---|
| Web frontend | `apps/web` | Next.js 15, Cloudflare Pages |
| Worker API | `apps/worker` | Cloudflare Workers + Hono + Durable Objects |
| DB package | `packages/db` | Drizzle ORM + Neon PostgreSQL via Hyperdrive |
| Types package | `packages/types` | Shared TypeScript interfaces |

## Always-On Conventions

### TypeScript
- Strict mode everywhere. No `any` unless unavoidable with comment.
- All new shared types go in `packages/types/src/index.ts`.
- Worker env types live in `apps/worker/src/types.ts` (`Env` interface).

### Worker (Hono)
- Routes go under `apps/worker/src/routes/`.
- All route files must use `const router = new Hono<{ Bindings: Env }>()` and `export default router`.
- Session validation uses `createAuth(db, env).api.getSession(...)` — never trusting client-supplied identity.
- Never accept payment-related IDs (Stripe account IDs, amounts) from request bodies — always fetch from DB.
- Prefer `createMiddleware` for cross-cutting concerns (auth, admin checks).
- `createDb(env)` and `createAuth(db, env)` are per-request — no module-level singletons yet.

### Database (Drizzle)
- Schema files: `packages/db/src/schema/`.
- All migrations: `packages/db/src/migrations/`.
- After schema changes, run `pnpm db:generate` then `pnpm db:migrate`.
- Always add indexes for FK columns and high-frequency query columns.

### Frontend (Next.js)
- Auth client calls go through `apps/web/src/lib/auth-client.ts` (BetterAuth client).
- API calls go through `apps/web/src/lib/api.ts`.
- Entitlements should be fetched through the `EntitlementsContext` — not in each component independently.
- All pages that need to gate content fetch entitlements from context.

### Security Non-Negotiables
- CORS `origin` must be an explicit allowlist — never reflect caller origin with `credentials: true`.
- WebSocket identity always from verified server session, never from query parameters.
- Stripe account IDs and payment amounts always resolved server-side from DB.
- Webhook handlers must verify idempotency (check processed event IDs).
- Admin role always verified in middleware, never ad-hoc per handler.

### Build
- Typecheck all packages: `pnpm typecheck` from root.
- Worker deploy: `cd apps/worker && pnpm deploy`.
- Web deploy: `cd apps/web && pnpm build:pages && pnpm deploy` (uses `@cloudflare/next-on-pages`).

## Key Environment Variables (Worker)

```
BETTER_AUTH_SECRET, HYPERDRIVE (binding), STREAM_API_TOKEN,
STREAM_ACCOUNT_ID, STREAM_CUSTOMER_DOMAIN, STRIPE_SECRET_KEY,
STRIPE_WEBHOOK_SECRET, APP_BASE_URL, PLATFORM_FEE_PERCENT,
STRIPE_CITIZEN_MONTHLY_PRICE, STRIPE_CITIZEN_ANNUAL_PRICE,
STRIPE_VIP_MONTHLY_PRICE, CHAT_RATE_LIMIT_FREE_MS,
CHAT_RATE_LIMIT_CITIZEN_MS, CHAT_RATE_LIMIT_VIP_MS, TRIAL_PERIOD_DAYS
```

## Audit Tracker

See `docs/improvement-tracker.md` for the live issue backlog and status.
