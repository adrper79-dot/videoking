DO $$ BEGIN
  CREATE TYPE user_tier AS ENUM ('free', 'citizen', 'vip');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE membership_status AS ENUM ('none', 'trial', 'active', 'canceled', 'past_due');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS user_tier user_tier NOT NULL DEFAULT 'free',
  ADD COLUMN IF NOT EXISTS subscription_status membership_status NOT NULL DEFAULT 'none',
  ADD COLUMN IF NOT EXISTS trial_ends_at timestamptz,
  ADD COLUMN IF NOT EXISTS has_seen_onboarding boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS ad_preferences jsonb NOT NULL DEFAULT '{"personalizedAds": true}'::jsonb;

ALTER TABLE subscriptions
  ADD COLUMN IF NOT EXISTS created_by_trial boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS trial_period_days integer NOT NULL DEFAULT 0;

CREATE UNIQUE INDEX IF NOT EXISTS poll_votes_poll_user_idx
  ON poll_votes (poll_id, user_id);

CREATE UNIQUE INDEX IF NOT EXISTS video_unlocks_user_video_idx
  ON video_unlocks (user_id, video_id);