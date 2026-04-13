# Phase 2 Deployment Checklist

Complete this checklist before deploying Phase 2 BlerdArt features to production.

---

## 📋 Pre-Deployment Verification

### Database
- [ ] **Review migration:** `packages/db/src/migrations/0002_blerdart_phase2.sql`
  - Verify all enum definitions are correct
  - Confirm all columns have appropriate defaults
  - Check indexes are created
  - Verify foreign key constraints

- [ ] **Test migration locally:**
  ```bash
  cd packages/db
  pnpm db:generate  # Generate Drizzle ORM types
  pnpm db:migrate   # Run migrations locally
  ```

- [ ] **Backup production database** before running migration

- [ ] **Schema validation:**
  - Confirm `events` table created with unique slug index
  - Confirm `assets` table created with creator_id and category indexes
  - Confirm `videos` table extensions added (style, tool, genre, tags, eventId)
  - Confirm `users` table extension added (blerdart_verified)

### API Routes
- [ ] **Run all API tests locally:**
  ```bash
  cd apps/worker
  pnpm test  # If test suite exists
  ```

- [ ] **Manual API testing with curl or Postman:**
  ```bash
  # Test events
  curl http://localhost:8787/api/events
  curl http://localhost:8787/api/events/create  # Will 403 without auth
  
  # Test assets
  curl http://localhost:8787/api/assets
  
  # Test admin verification (requires auth)
  curl -X POST http://localhost:8787/api/admin/verify-creator \
    -H "Content-Type: application/json" \
    -d '{"userId": "test-id"}'
  ```

- [ ] **Verify error handling:**
  - Missing required fields → 400 Bad Request
  - Unauthorized access → 401 Unauthorized
  - Forbidden access (non-admin) → 403 Forbidden
  - Resource not found → 404 Not Found
  - Duplicate slug → 409 Conflict
  - Server error → 500 with meaningful message

### Frontend
- [ ] **Build test:**
  ```bash
  cd apps/web
  pnpm build  # Next.js build
  pnpm typecheck  # TypeScript verification
  ```

- [ ] **Component tests:**
  - [ ] DiscoveryFilters loads and filters correctly
  - [ ] CreatorVerification badges display when verified=true
  - [ ] UploadForm includes new metadata fields
  - [ ] Events page loads and searches events
  - [ ] Event detail page shows videos from event
  - [ ] Assets dashboard allows upload/delete

- [ ] **Integration tests:**
  - [ ] Upload video with metadata → stored correctly
  - [ ] Filter videos by style → returns correct results
  - [ ] Create event → appears in events list
  - [ ] Upload asset → appears in assets dashboard

### Type Safety
- [ ] **Typecheck all packages:**
  ```bash
  pnpm typecheck  # From root
  # Should show: Tasks: 4 successful
  ```

- [ ] **Review new types in `packages/types/src/index.ts`:**
  - Verify Video type includes new fields
  - Verify Event type is exported
  - Verify Asset type is exported

## 🚀 Deployment Steps

### 1. Database Migration
```bash
# Connect to production Neon via Hyperdrive
# Run migration via Cloudflare Worker

# Via wrangler:
cd packages/db
pnpm db:migrate --env production

# Or manually:
# 1. Export migration SQL from 0002_blerdart_phase2.sql
# 2. Connect to Neon PostgreSQL
# 3. Execute entire SQL file
# 4. Verify all objects created: \dt, \dx, \di
```

### 2. Deploy Worker (APIs)
```bash
cd apps/worker
pnpm deploy

# Verify routes registered:
# curl YOUR_WORKER_DOMAIN/api/events
# curl YOUR_WORKER_DOMAIN/api/assets
# curl YOUR_WORKER_DOMAIN/api/admin/verify-creator (401 without auth)
```

### 3. Deploy Web (Frontend)
```bash
cd apps/web
pnpm build:pages  # Next.js + Cloudflare Pages integration
pnpm deploy

# Verify pages load:
# https://app.example.com/events
# https://app.example.com/events/blerdcon-2024
# https://app.example.com/dashboard/assets (requires login)
```

### 4. Verify in Production
- [ ] Events page loads (`/events`)
- [ ] Can create event via admin API
- [ ] Can upload video with new metadata fields
- [ ] Can filter videos by style/tool/genre
- [ ] Can upload assets
- [ ] Creator verification badge displays on verified creators

## 🔄 Post-Deployment

### Monitoring
- [ ] Check error logs for any TypeScript or runtime errors
- [ ] Verify database queries complete within acceptable time (verify indexes used)
- [ ] Monitor R2 uploads for asset uploads

### Verification Queries
```sql
-- Verify migration ran
SELECT * FROM information_schema.tables 
WHERE table_name = 'events';  -- Should return 1 row

SELECT * FROM information_schema.tables 
WHERE table_name = 'assets';  -- Should return 1 row

-- Verify new columns added
SELECT column_name FROM information_schema.columns 
WHERE table_name = 'videos' AND column_name IN ('style', 'tool', 'genre', 'tags');
-- Should return 4 rows

-- Verify enums created
SELECT distinct enum_type FROM information_schema.constraint_column_usage 
WHERE table_name = 'videos';
-- Should include video_style_enum, video_tool_enum, video_genre_enum
```

### Data Validation
- [ ] Create test event and verify API returns it
- [ ] Upload test asset and verify download counter increments
- [ ] Upload video with metadata and verify stored correctly
- [ ] Filter videos by metadata and verify correct results

## ⚠️ Rollback Plan

If deployment fails:

### Rollback Database
```sql
-- Rollback migration
ALTER TABLE videos DROP COLUMN IF EXISTS tags;
ALTER TABLE videos DROP COLUMN IF EXISTS style;
ALTER TABLE videos DROP COLUMN IF EXISTS tool;
ALTER TABLE videos DROP COLUMN IF EXISTS genre;
ALTER TABLE videos DROP COLUMN IF EXISTS event_id;
ALTER TABLE videos DROP COLUMN IF EXISTS human_created_affirmed;
ALTER TABLE videos DROP COLUMN IF EXISTS watermark_enabled;

ALTER TABLE users DROP COLUMN IF EXISTS blerdart_verified;

DROP TABLE IF EXISTS assets;
DROP TABLE IF EXISTS events;

DROP TYPE IF EXISTS video_style_enum;
DROP TYPE IF EXISTS video_tool_enum;
DROP TYPE IF EXISTS video_genre_enum;
```

### Rollback Worker/Web
- [ ] Revert to previous commit with `git revert`
- [ ] Redeploy previous versions
- [ ] Clear Cloudflare cache if needed

## 📝 Sign-off

- [ ] Database migration tested locally and in staging
- [ ] All API routes tested and returning correct responses
- [ ] Frontend builds without errors
- [ ] TypeScript strict mode: all types correct
- [ ] Team reviewed GAP_ANALYSIS and IMPLEMENTATION_SUMMARY
- [ ] Documentation updated (this checklist, integration guide)
- [ ] Performance considerations addressed (indexes, query optimization)

**Deployment Date:** _____________  
**Deployed By:** _____________  
**Verified By:** _____________

---

## 📚 References

- [PHASE_2_IMPLEMENTATION_SUMMARY.md](./PHASE_2_IMPLEMENTATION_SUMMARY.md)
- [PHASE_2_INTEGRATION_GUIDE.md](./PHASE_2_INTEGRATION_GUIDE.md)
- [Migration File](../packages/db/src/migrations/0002_blerdart_phase2.sql)
- [Drizzle Schema](../packages/db/src/schema/)
