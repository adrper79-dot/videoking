-- Phase 3a: Ad Events & Monetization

CREATE TABLE IF NOT EXISTS ad_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  video_id UUID NOT NULL,
  creator_id UUID NOT NULL,
  ad_network TEXT NOT NULL DEFAULT 'placeholder',
  estimated_revenue_cents INT DEFAULT 0,
  impression_at TIMESTAMP WITH TIMEZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIMEZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIMEZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ad_events_creator_at ON ad_events(creator_id, impression_at DESC);
CREATE INDEX IF NOT EXISTS idx_ad_events_video_at ON ad_events(video_id, impression_at DESC);
CREATE INDEX IF NOT EXISTS idx_ad_events_impression_at ON ad_events(impression_at DESC);

-- Update earnings table to track ad revenue
ALTER TABLE earnings 
ADD COLUMN IF NOT EXISTS ad_event_id UUID REFERENCES ad_events(id),
ADD COLUMN IF NOT EXISTS source TEXT DEFAULT 'stripe';

-- Update users table for frequency capping
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS last_ad_served_at TIMESTAMP WITH TIMEZONE,
ADD COLUMN IF NOT EXISTS ad_frequency_limit_ms INT DEFAULT 600000;
