-- Phase 4: In-app notifications system
-- Supports trial expiry alerts, upsells, and engagement notifications

CREATE TYPE notification_type AS ENUM (
  'trial_ending_soon',
  'trial_ended',
  'subscription_upgrade_upsell',
  'watch_party_invite',
  'new_video',
  'milestone',
  'referral_bonus'
);

CREATE TYPE notification_status AS ENUM (
  'pending',
  'shown',
  'dismissed',
  'actioned'
);

CREATE TABLE IF NOT EXISTS notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type notification_type NOT NULL,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  cta_url TEXT,
  cta_label TEXT DEFAULT 'Learn More',
  status notification_status NOT NULL DEFAULT 'pending',
  priority INT NOT NULL DEFAULT 1,
  show_attempts INT NOT NULL DEFAULT 0,
  dismissed_at TIMESTAMP WITH TIME ZONE,
  actioned_at TIMESTAMP WITH TIME ZONE,
  expires_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Index for fast lookup of pending notifications for a user
CREATE INDEX IF NOT EXISTS idx_notifications_user_status
  ON notifications(user_id, status)
  WHERE status IN ('pending', 'shown');

-- Index for expired notifications (purge job)
CREATE INDEX IF NOT EXISTS idx_notifications_expires_at
  ON notifications(expires_at)
  WHERE expires_at IS NOT NULL AND status != 'actioned';

-- Index for notification type (analytics)
CREATE INDEX IF NOT EXISTS idx_notifications_type_created
  ON notifications(type, created_at);
