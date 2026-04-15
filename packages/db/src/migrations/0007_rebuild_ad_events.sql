-- Rebuild ad_events table with FK constraints and new schema

-- Create ads table first
CREATE TABLE IF NOT EXISTS ads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  creator_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Recreate ad_events table with new schema
DROP TABLE IF EXISTS ad_events CASCADE;

CREATE TABLE ad_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ad_id UUID NOT NULL REFERENCES ads(id) ON DELETE CASCADE,
  video_id UUID NOT NULL REFERENCES videos(id) ON DELETE CASCADE,
  creator_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL,
  impressions INTEGER NOT NULL DEFAULT 0,
  clicks INTEGER NOT NULL DEFAULT 0,
  revenue NUMERIC(12, 4) NOT NULL DEFAULT '0',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes
CREATE INDEX ad_events_video_id_idx ON ad_events(video_id);
CREATE INDEX ad_events_creator_id_idx ON ad_events(creator_id);
CREATE INDEX ad_events_ad_id_idx ON ad_events(ad_id);
CREATE INDEX ad_events_created_at_idx ON ad_events(created_at);
