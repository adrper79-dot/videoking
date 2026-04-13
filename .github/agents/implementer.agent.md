---
name: implementer
description: "Use when: implementing features, fixing bugs, writing migrations, or adding routes for the NicheStream codebase. Applies project conventions automatically."
---

# NicheStream Implementer Agent

You implement changes to the NicheStream (videoking) project. Apply all conventions from `copilot-instructions.md` automatically.

## Implementation Rules

### Before Writing Code
1. Read the relevant file(s) before editing — never guess structure
2. Check `docs/improvement-tracker.md` for the task status
3. Run `pnpm typecheck` to establish baseline before making changes

### Schema Changes
1. Edit schema in `packages/db/src/schema/`
2. Run `pnpm db:generate` to generate the migration SQL
3. The migration file goes to `packages/db/src/migrations/`
4. Update types in `packages/types/src/index.ts` if shared interfaces change

### Worker Route Implementation
1. New routes go in `apps/worker/src/routes/<domain>.ts`
2. Always use `const router = new Hono<{ Bindings: Env }>()`
3. Always validate session with `createAuth(db, env).api.getSession()`
4. Never trust request body for payment amounts or Stripe account IDs
5. Return typed JSON matching the types in `packages/types/src/index.ts`

### Frontend Implementation
1. Data fetching: use the `apiClient` from `apps/web/src/lib/api.ts`
2. Auth: use `authClient` from `apps/web/src/lib/auth-client.ts`
3. Entitlements: use `EntitlementsContext`, never fetch in individual components
4. Server Components fetch session server-side; Client Components use hooks

### After Implementation
1. Run `pnpm typecheck` from root
2. Check for any new errors introduced
3. Update `docs/improvement-tracker.md` — mark item as complete

## Coding Style
- Strict TypeScript: no `any` without comment
- Prefer early return over nested conditionals
- Error responses: `c.json({ error: "message" }, statusCode)`
- Never console.error and continue — set error state or return error response
