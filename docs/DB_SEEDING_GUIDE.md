# NicheStream Database Seeding Guide

## Overview

Seed files populate sample data for testing and demos. All seed files are in `packages/db/src/seeds/`.

## Running Seeds

### Prerequisites
- Database migrations applied: `pnpm db:migrate`
- Neon/PostgreSQL connection available
- `.env` configured with `DATABASE_URL`

### Run Single Seed
```bash
# From repo root
NEON_DATABASE_URL="postgresql://..." psql -f packages/db/src/seeds/blerdcon-2026.sql
```

### Run All Seeds (Future Automation)
```bash
# Once seed runner is configured
pnpm db:seed
```

## Available Seeds

### 1. BlerdCon 2026 Event (`blerdcon-2026.sql`)

**Purpose:** Create sample event for testing Virtual Artist Alley feature

**What It Creates:**
- Event: "BlerdCon 2026"
- Slug: `blerdcon-2026`
- Dates: August 1-3, 2026
- Status: Active (immediately queryable)

**SQL:**
```sql
INSERT INTO events (id, name, slug, start_date, end_date, description, created_at, updated_at)
VALUES (
  'blerdcon-2026',
  'BlerdCon 2026',
  'blerdcon-2026',
  '2026-08-01'::timestamptz,
  '2026-08-03'::timestamptz,
  'BlerdCon 2026 Virtual Artist Alley - The premier Black nerd culture convention',
  NOW(),
  NOW()
);
```

**Test It:**
```bash
# In psql or any client
SELECT * FROM events WHERE slug = 'blerdcon-2026';
```

**Use In Frontend:**
- URL: `http://localhost:3000/events/blerdcon-2026`
- Expected: Event detail page loads, ready for videos tagged with this event

## Planning Additional Seeds

### Sample Creators
```sql
INSERT INTO users (
  email, username, display_name, role, user_tier,
  blerdart_verified, created_at, updated_at
) VALUES
  ('creator1@test.com', 'digitalartist', 'Digital Artist', 'creator', 'free', true, NOW(), NOW()),
  ('creator2@test.com', 'animationstudio', 'Animation Studio', 'creator', 'citizen', false, NOW(), NOW());
```

### Sample Videos (With BlerdArt Metadata)
```sql
INSERT INTO videos (
  id, creator_id, cloudflare_stream_id, title, description,
  status, visibility, style, tool, genre, tags, event_id,
  human_created_affirmed, watermark_enabled, created_at, updated_at
) VALUES (
  'video-001',
  'creator-1-id',
  'stream-id-from-cloudflare',
  'Digital Character Design Process',
  'Watch my process designing a character for BlerdCon',
  'ready',
  'public',
  'digital',
  'procreate',
  'character_design',
  '["character", "design", "process", "tutorial"]'::jsonb,
  'blerdcon-2026',
  true,
  false,
  NOW(),
  NOW()
);
```

### Sample Verified Badge (Admin Action)
Already created via `POST /api/admin/verify-creator` endpoint. Can be tested via:
```bash
curl -X POST http://localhost:8787/api/admin/verify-creator \
  -H "Authorization: Bearer {admin-token}" \
  -H "Content-Type: application/json" \
  -d '{"userId": "creator-1-id"}'
```

## Database Snapshots (Production)

For production migrations, consider:
1. **Export staging data** with sensitive info removed
2. **Commit as backup** for disaster recovery
3. **Test restores** in development before production incidents

Example:
```bash
# Export current events
pg_dump --data-only --table events $DATABASE_URL > db-backup-events-20260415.sql

# Restore to fresh database
psql $DATABASE_URL < db-backup-events-20260415.sql
```

## Idempotency

All seeds use `ON CONFLICT DO NOTHING` or `INSERT ... WHERE NOT EXISTS` to prevent duplicate errors when run multiple times.

**Good Seed:**
```sql
INSERT INTO events (id, name, slug, ...)
VALUES ('blerdcon-2026', 'BlerdCon 2026', ...)
ON CONFLICT (slug) DO NOTHING;
```

**Verify:**
```sql
SELECT COUNT(*) FROM events WHERE slug = 'blerdcon-2026';
-- Should return 1, even if seed runs twice
```

## Future Improvements

1. **Seed Runner Script:** `pnpm db:seed` to run all seeds in `seeds/` directory
2. **Faker Integration:** Generate realistic test data (names, descriptions, etc.)
3. **Staging Kit:** Pre-configured dataset for QA testing
4. **Backup/Restore:** Automated daily backups of seed reference data

