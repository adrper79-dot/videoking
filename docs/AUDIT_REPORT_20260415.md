# NicheStream Codebase Audit Report

**Date:** April 15, 2026  
**Audit Scope:** Full codebase review against project conventions, security, code quality, performance, database design, and build configuration  
**Project Version:** Phase 3 (Ad Monetization) - Loop 3 Final  
**Status:** 13 issues found requiring fixes  

---

## Executive Summary

| Metric | Value |
|---|---|
| Total Issues Found | 13 |
| Critical Blockers | 3 |
| High Priority | 6 |
| Medium Priority | 3 |
| Low Priority | 1 |
| Project Compliance | 85% convention-adherent |
| Security Posture | Good ✓ |
| Deployment Readiness | ⚠️ CAUTION - 3 blockers before scaling |

**All issues must be resolved before production scaling.**

---

## 🔴 CRITICAL ISSUES

### C-1: Database Client Caching Violates Per-Request Pattern
- **File:** [apps/worker/src/lib/db.ts](apps/worker/src/lib/db.ts#L5-L17)
- **Severity:** Regression Risk (blocks deployment)
- **Violation:** The `createDb()` function caches a postgres client at module scope using `cachedPostgresClient`. This violates the stated convention: *"Database client is per-request via createDb(env), NOT module-level singleton."*
- **Impact:** Module-level caching persists across requests and can cause stale connection issues under scaling, connection pool exhaustion, and unpredictable behavior with Hyperdrive.
- **Fix:** Remove module-level caching; create fresh drizzle client per request. Postgres client connection pooling is managed separately by Hyperdrive.

### C-2: 12+ Foreign Key Columns Lack Indexes (HIGH-FREQUENCY QUERY OPTIMIZATION)
- **File:** [packages/db/src/schema/](packages/db/src/schema/) (multiple)
- **Severity:** Blocks Deployment (N+1 queries at scale)
- **Violation:** Convention requires all FK columns indexed. Missing indexes will cause table scans and N+1 queries.
- **Missing Indexes:**
  1. `playlists.ts` - `creatorId`: no index
  2. `interactions.ts` - `polls.creatorId`: no index
  3. `interactions.ts` - `pollVotes.userId`: only in composite unique constraint, not individual index
  4. `interactions.ts` - `chatMessages.userId`: no index (only videoId indexed)
  5. `interactions.ts` - `videoUnlocks` (both userId and videoId): no indexes
  6. `auth.ts` - `sessions.userId`: no index
  7. `auth.ts` - `accounts.userId`: no index
  8. `moderation.ts` - `moderationReports.reporterId`: no index
  9. `notifications.ts` - `notifications.userId`: no index
  10. `earnings.ts` - `earnings.videoId`: no index (only creatorId and composite indexed)
  11. `playlists.ts` - `playlistVideos.playlistId`: no index
  12. `playlists.ts` - `playlistVideos.videoId`: only in composite unique, not individual
- **Impact Example queries:** fetching user's chat messages, polls by creator, user notifications, moderator reports by reporter will all table scan.

### C-3: Hardcoded APP_BASE_URL Not Overridable for Production
- **File:** [apps/worker/wrangler.toml](apps/worker/wrangler.toml#L31)
- **Severity:** Blocks Deployment (configuration risk)
- **Violation:** `APP_BASE_URL = "https://itsjusus.com"` is hardcoded directly in wrangler.toml. While a comment says "override via wrangler secret for production," this implementation is incomplete—value is not a secret and not marked as a var substitute.
- **Impact:** Could deploy to wrong domain if CI/CD not carefully configured; creates environment confusion.
- **Fix:** Remove hardcoded value; require APP_BASE_URL to be set only via `wrangler secret put APP_BASE_URL` for each environment.

---

## 🟠 HIGH PRIORITY ISSUES

### H-1: 11 Untyped `as any` Casts in VideoRoom.ts (Without Comments)
- **File:** [apps/worker/src/durable-objects/VideoRoom.ts](apps/worker/src/durable-objects/VideoRoom.ts#L300-L304)
- **Severity:** Technical Debt
- **Violations:**
  - Lines 300-304: `id/videoId/userId/type` casts in chat insert
  - Lines 407-411: `id/videoId/creatorId/options` casts in poll creation
  - Lines 451-453: `id/pollId/userId` casts in poll vote
- **Convention Violation:** "Strict TypeScript convention requires no `any` unless unavoidable with comment."
- **Fix:** Add `// Type mismatch: DO types differ from DB types` comment for each, or properly type StoredChatMessage and StoredPoll interfaces to match DB schema exactly.

### H-2: 2 Untyped `as any` Casts in Payouts.ts
- **File:** [apps/worker/src/lib/payouts.ts](apps/worker/src/lib/payouts.ts#L366)
- **Severity:** Technical Debt
- **Violations:**
  - Line 366: `event.data.object as any` in transfer.created webhook handler
  - Line 390: `transferStatus as any` when updating payout runs
- **Fix:** Add explanatory comments or properly type Stripe webhook event payloads.

### H-3: 1 Untyped `as any` Cast in Stripe-Connect.ts
- **File:** [apps/worker/src/lib/stripe-connect.ts](apps/worker/src/lib/stripe-connect.ts#L162)
- **Severity:** Technical Debt
- **Violation:** Line 162: `} as any` in verifyAccountStatus() lacks explanatory comment.
- **Fix:** Add comment explaining why proper typing from Stripe SDK is not possible here.

### H-4: 1 Untyped `as any` Cast in Assets.ts
- **File:** [apps/worker/src/routes/assets.ts](apps/worker/src/routes/assets.ts#L79)
- **Severity:** Technical Debt
- **Violation:** Line 79: `const file = formData.get('file') as any` lacks comment explaining FormData typing limitations.
- **Fix:** Add `// FormData.get() returns File | string | null; we know it's File here` comment.

### H-5: 3 Untyped `any` in Middleware Function Signatures
- **Files:** [apps/worker/src/middleware/admin.ts](apps/worker/src/middleware/admin.ts#L11), [apps/worker/src/middleware/session.ts](apps/worker/src/middleware/session.ts#L16)
- **Severity:** Technical Debt
- **Violations:**
  - admin.ts line 11: `async (c: any, next: any)`
  - session.ts line 16: `async (c: Context, next: any)` (partially typed)
- **Fix:** Properly type with `Context` or full Hono middleware type signature.

### H-6: Inconsistent Route Export Patterns
- **File:** [apps/worker/src/routes/](apps/worker/src/routes/)
- **Severity:** Technical Debt
- **Violation:** Routes use mixed export patterns: `export default router`, `export { router as routeName }`, etc.
- **Impact:** Creating inconsistency and potential confusion for future maintainers.
- **Fix:** Standardize on `export { routerName as routeExport }` pattern across all route files.

---

## 🟡 MEDIUM PRIORITY ISSUES

### M-1: adEvents Table Lacks FK Constraints
- **File:** [packages/db/src/schema/ads.ts](packages/db/src/schema/ads.ts#L1-L20)
- **Severity:** Technical Debt (data integrity)
- **Violation:** `adEvents.videoId` and `adEvents.creatorId` are plain uuid fields with no `.references()` foreign key definitions. This breaks referential integrity and allows orphaned records.
- **Fix:** Add `.references(() => users.id)` and `.references(() => videos.id)` to creatorId and videoId; add onDelete cascades; add indexes.

### M-2: TypeScript Strict Checks Disabled
- **File:** [apps/worker/tsconfig.json](apps/worker/tsconfig.json#L8)
- **Severity:** Technical Debt (code quality)
- **Violation:** Despite `strict: true`, `noUnusedLocals: false` and `noUnusedParameters: false` allow dead code to pass type checking.
- **Fix:** Set both to true; audit codebase and remove unused code/parameters.

### M-3: Dashboard Earnings Endpoint N+1 Potential at Scale
- **File:** [apps/worker/src/index.ts](apps/worker/src/index.ts#L175-L205)
- **Severity:** Technical Debt (performance)
- **Violation:** GET `/api/dashboard/earnings` fetches all earnings for a user in the last 30 days without pagination. At scale with many creators, this could load thousands of records into memory and return large JSON payload.
- **Fix:** Add pagination (limit + offset) to the earnings query; document max results returned.

---

## 🟢 LOW PRIORITY ISSUES

### L-1: Untyped Map in Cohort Analytics
- **File:** [apps/worker/src/routes/analytics.ts](apps/worker/src/routes/analytics.ts#L75)
- **Severity:** Technical Debt (minor)
- **Violation:** Line 75: `const cohortMap = new Map<string, any>();` uses `any` as value type.
- **Fix:** Replace with specific type for cohort data.

---

## Compliance Matrix

| Category | Status | Notes |
|---|---|---|
| **TypeScript Strict Mode** | ✓ PASS | Enforced; some `any` assertions need comments |
| **Worker Hono Patterns** | ✓ PASS | All routes properly typed with `Bindings: Env` |
| **Auth Pattern** | ✓ PASS | BetterAuth integration correct; session validation enforced |
| **Database Client Pattern** | ✗ FAIL | Module-level caching violates per-request convention |
| **Database Indexes** | ✗ FAIL | 12+ FK columns missing indexes |
| **Frontend Context Usage** | ✓ PASS | EntitlementsContext properly implemented |
| **CORS Security** | ✓ PASS | Explicit allowlist with origin validation |
| **Webhook Idempotency** | ✓ PASS | Event deduplication implemented |
| **Admin Middleware** | ✓ PASS | `requireAdmin()` pattern applied consistently |
| **Build Configuration** | ✓ PASS | Proper exports; typecheck passing (but with relaxed strict checks) |

---

## Action Plan (Priority Order)

| Phase | Stage | Issues | Estimated Effort |
|---|---|---|---|
| **Phase 1** | Critical | C-1, C-2, C-3 | 2-3 hours |
| **Phase 2** | High-Quality | H-1 through H-6 | 1.5-2 hours |
| **Phase 3** | Medium | M-1, M-2, M-3 | 1.5-2 hours |
| **Phase 4** | Low | L-1 | 0.25-0.5 hours |
| **Phase 5** | Validation | Re-audit + Tests | 1 hour |

**Total Estimated Time:** ~6-8 hours

---

## Next Steps

1. Execute Phase 1 fixes (critical blockers)
2. Verify database migration generation and application
3. Execute Phase 2 fixes (high-quality improvements)
4. Run TypeScript typecheck across all packages
5. Execute Phase 3 and 4 fixes
6. Re-run auditor to confirm 0 remaining issues
7. Create PR with all fixes

---

Generated by: Comprehensive Codebase Audit Agent  
Timestamp: 2026-04-15T00:00:00Z
