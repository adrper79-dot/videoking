-- Phase 4: Creator Payouts, Referrals, and Cohort Analytics

-- 1. Connected Accounts table (for Stripe Connect OAuth tracking)
-- Already exists but ensure it's present:
-- CREATE TABLE connected_accounts (
--   id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
--   user_id UUID NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
--   stripe_account_id TEXT NOT NULL UNIQUE,
--   charges_enabled BOOLEAN NOT NULL DEFAULT FALSE,
--   payouts_enabled BOOLEAN NOT NULL DEFAULT FALSE,
--   onboarding_complete BOOLEAN NOT NULL DEFAULT FALSE,
--   created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
--   updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
-- );

-- 2. Referrals table (track referral links and conversions)
CREATE TABLE IF NOT EXISTS referrals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  referred_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  referred_by_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  referral_code TEXT NOT NULL UNIQUE,
  conversion_status TEXT NOT NULL DEFAULT 'pending',
    -- pending | trial_started | converted | expired
  trial_days_bonus INT DEFAULT 7,
  credit_bonus_cents INT DEFAULT 0,
  signed_up_at TIMESTAMP WITH TIME ZONE,
  trial_started_at TIMESTAMP WITH TIME ZONE,
  converted_at TIMESTAMP WITH TIME ZONE,
  expired_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  INDEX referrals_referred_by_idx (referred_by_user_id),
  INDEX referrals_conversion_status_idx (conversion_status)
);

-- 3. User account credits (for referral bonuses or promotions)
ALTER TABLE users ADD COLUMN IF NOT EXISTS account_credits_cents INT DEFAULT 0;
ALTER TABLE users ADD COLUMN IF NOT EXISTS trial_extended_days INT DEFAULT 0;

-- 4. Earnings tracking for referral bonuses
-- The earning_type enum already includes types; ensure 'referral_bonus' is included
-- UPDATE: This is in the TypeScript schema; migrations handle via Drizzle

-- 5. Cohorts daily tracking table (for analytics)
CREATE TABLE IF NOT EXISTS cohorts_daily (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cohort_date DATE NOT NULL,
  cohort_week DATE NOT NULL, -- Monday of the week for weekly cohorts
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  days_since_signup INT NOT NULL,
  current_tier TEXT NOT NULL DEFAULT 'free',
    -- free | citizen | vip
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  watched_minutes INT NOT NULL DEFAULT 0,
  chat_messages INT NOT NULL DEFAULT 0,
  poll_votes INT NOT NULL DEFAULT 0,
  engagement_score FLOAT NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  UNIQUE (cohort_date, user_id),
  INDEX cohorts_daily_cohort_date_idx (cohort_date),
  INDEX cohorts_daily_user_id_idx (user_id),
  INDEX cohorts_daily_days_since_signup_idx (days_since_signup)
);

-- 6. Churn tracking table (aggregate snapshot per user)
CREATE TABLE IF NOT EXISTS churn_tracking (
  user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  signup_date DATE NOT NULL,
  trial_activated_date DATE,
  trial_ended_date DATE,
  converted_date DATE,
  first_canceled_date DATE,
  total_watched_minutes INT NOT NULL DEFAULT 0,
  total_chat_messages INT NOT NULL DEFAULT 0,
  total_poll_votes INT NOT NULL DEFAULT 0,
  inactivity_days INT NOT NULL DEFAULT 0,
  is_at_risk BOOLEAN NOT NULL DEFAULT FALSE,
  churned BOOLEAN NOT NULL DEFAULT FALSE,
  last_activity_at TIMESTAMP WITH TIME ZONE,
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  INDEX churn_tracking_is_at_risk_idx (is_at_risk),
  INDEX churn_tracking_churned_idx (churned),
  INDEX churn_tracking_updated_at_idx (updated_at)
);

-- 7. Payout history tracking (for Stripe Transfer status)
CREATE TABLE IF NOT EXISTS payout_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  payout_period_start DATE NOT NULL,
  payout_period_end DATE NOT NULL,
  creator_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  total_gross_cents INT NOT NULL,
  platform_fee_cents INT NOT NULL,
  creator_net_cents INT NOT NULL,
  stripe_transfer_id TEXT UNIQUE,
  transfer_status TEXT NOT NULL DEFAULT 'pending',
    -- pending | processing | paid | failed
  processed_at TIMESTAMP WITH TIME ZONE,
  paid_at TIMESTAMP WITH TIME ZONE,
  failed_reason TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  INDEX payout_runs_creator_id_idx (creator_id),
  INDEX payout_runs_transfer_status_idx (transfer_status),
  INDEX payout_runs_period_idx (payout_period_start, payout_period_end)
);

-- 8. Add trial expiry tracking to users table
ALTER TABLE users ADD COLUMN IF NOT EXISTS trial_expires_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS trial_expired_notified BOOLEAN DEFAULT FALSE;

-- 9. Indexes for performance
CREATE INDEX IF NOT EXISTS users_trial_expires_at_idx ON users(trial_expires_at) WHERE trial_expires_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS earnings_creator_id_created_at_idx ON earnings(creator_id, created_at);
CREATE INDEX IF NOT EXISTS interactions_video_id_user_tier_idx ON interactions(video_id, (user_tier));
