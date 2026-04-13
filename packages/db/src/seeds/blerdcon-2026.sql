-- Sample BlerdCon 2026 event seed data
-- Run this after migrations: pnpm db:migrate
-- Then: psql $NEON_DATABASE_URL -f packages/db/src/seeds/blerdcon-2026.sql

-- Insert BlerdCon 2026 event
INSERT INTO events (
  id,
  name,
  slug,
  start_date,
  end_date,
  description,
  created_at,
  updated_at
) VALUES (
  'blerdcon-2026',
  'BlerdCon 2026',
  'blerdcon-2026',
  '2026-08-01'::timestamptz,
  '2026-08-03'::timestamptz,
  'BlerdCon 2026 Virtual Artist Alley - The premier Black nerd culture convention',
  NOW(),
  NOW()
) ON CONFLICT DO NOTHING;

-- Verify insertion
SELECT id, name, slug, start_date, end_date FROM events WHERE slug = 'blerdcon-2026';
