CREATE TYPE "public"."video_genre" AS ENUM('animation', 'comic', 'illustration', 'character_design', 'concept_art', 'afro_fantasy', 'sci_fi', 'animation_short', 'process_video', 'tutorial', 'speedart', 'other');--> statement-breakpoint
CREATE TYPE "public"."video_style" AS ENUM('digital', 'traditional', 'mixed_media', '3d');--> statement-breakpoint
CREATE TYPE "public"."video_tool" AS ENUM('procreate', 'clip_studio', 'photoshop', 'krita', 'affinity', 'blender', 'maya', 'traditional_media', 'other');--> statement-breakpoint
CREATE TYPE "public"."referral_conversion_status" AS ENUM('pending', 'trial_started', 'converted', 'expired');--> statement-breakpoint
ALTER TYPE "public"."earning_type" ADD VALUE 'ad_impression';--> statement-breakpoint
CREATE TABLE "events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"description" text,
	"start_date" timestamp with time zone NOT NULL,
	"end_date" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "events_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "assets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"creator_id" uuid NOT NULL,
	"filename" text NOT NULL,
	"category" text NOT NULL,
	"tags" jsonb DEFAULT '[]'::jsonb,
	"r2_path" text NOT NULL,
	"download_count" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ad_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"video_id" uuid NOT NULL,
	"creator_id" uuid NOT NULL,
	"ad_network" text DEFAULT 'placeholder' NOT NULL,
	"estimated_revenue_cents" integer DEFAULT 0,
	"impression_at" timestamp with time zone DEFAULT now(),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "churn_tracking" (
	"user_id" uuid PRIMARY KEY NOT NULL,
	"signup_date" date NOT NULL,
	"trial_activated_date" date,
	"trial_ended_date" date,
	"converted_date" date,
	"first_canceled_date" date,
	"total_watched_minutes" integer DEFAULT 0 NOT NULL,
	"total_chat_messages" integer DEFAULT 0 NOT NULL,
	"total_poll_votes" integer DEFAULT 0 NOT NULL,
	"inactivity_days" integer DEFAULT 0 NOT NULL,
	"is_at_risk" integer DEFAULT 0 NOT NULL,
	"churned" integer DEFAULT 0 NOT NULL,
	"last_activity_at" timestamp with time zone,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "cohorts_daily" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"cohort_date" date NOT NULL,
	"cohort_week" date NOT NULL,
	"user_id" uuid NOT NULL,
	"days_since_signup" integer NOT NULL,
	"current_tier" text DEFAULT 'free' NOT NULL,
	"is_active" integer DEFAULT 1 NOT NULL,
	"watched_minutes" integer DEFAULT 0 NOT NULL,
	"chat_messages" integer DEFAULT 0 NOT NULL,
	"poll_votes" integer DEFAULT 0 NOT NULL,
	"engagement_score" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "payout_runs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"payout_period_start" date NOT NULL,
	"payout_period_end" date NOT NULL,
	"creator_id" uuid NOT NULL,
	"total_gross_cents" integer NOT NULL,
	"platform_fee_cents" integer NOT NULL,
	"creator_net_cents" integer NOT NULL,
	"stripe_transfer_id" text,
	"transfer_status" text DEFAULT 'pending' NOT NULL,
	"processed_at" timestamp with time zone,
	"paid_at" timestamp with time zone,
	"failed_reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "payout_runs_stripe_transfer_id_unique" UNIQUE("stripe_transfer_id")
);
--> statement-breakpoint
CREATE TABLE "referrals" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"referred_user_id" uuid,
	"referred_by_user_id" uuid NOT NULL,
	"referral_code" text NOT NULL,
	"conversion_status" "referral_conversion_status" DEFAULT 'pending' NOT NULL,
	"trial_days_bonus" integer DEFAULT 7,
	"credit_bonus_cents" integer DEFAULT 0,
	"signed_up_at" timestamp with time zone,
	"trial_started_at" timestamp with time zone,
	"converted_at" timestamp with time zone,
	"expired_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "referrals_referral_code_unique" UNIQUE("referral_code")
);
--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "blerdart_verified" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "account_credits_cents" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "trial_extended_days" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "videos" ADD COLUMN "tags" jsonb DEFAULT '[]'::jsonb;--> statement-breakpoint
ALTER TABLE "videos" ADD COLUMN "style" "video_style";--> statement-breakpoint
ALTER TABLE "videos" ADD COLUMN "tool" "video_tool";--> statement-breakpoint
ALTER TABLE "videos" ADD COLUMN "genre" "video_genre";--> statement-breakpoint
ALTER TABLE "videos" ADD COLUMN "event_id" uuid;--> statement-breakpoint
ALTER TABLE "videos" ADD COLUMN "human_created_affirmed" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "videos" ADD COLUMN "watermark_enabled" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "assets" ADD CONSTRAINT "assets_creator_id_users_id_fk" FOREIGN KEY ("creator_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "churn_tracking" ADD CONSTRAINT "churn_tracking_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cohorts_daily" ADD CONSTRAINT "cohorts_daily_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payout_runs" ADD CONSTRAINT "payout_runs_creator_id_users_id_fk" FOREIGN KEY ("creator_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "referrals" ADD CONSTRAINT "referrals_referred_user_id_users_id_fk" FOREIGN KEY ("referred_user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "referrals" ADD CONSTRAINT "referrals_referred_by_user_id_users_id_fk" FOREIGN KEY ("referred_by_user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "events_slug_idx" ON "events" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "assets_creator_id_idx" ON "assets" USING btree ("creator_id");--> statement-breakpoint
CREATE INDEX "assets_category_idx" ON "assets" USING btree ("category");--> statement-breakpoint
CREATE INDEX "idx_ad_events_creator_at" ON "ad_events" USING btree ("creator_id","impression_at");--> statement-breakpoint
CREATE INDEX "idx_ad_events_video_at" ON "ad_events" USING btree ("video_id","impression_at");--> statement-breakpoint
CREATE INDEX "idx_ad_events_impression_at" ON "ad_events" USING btree ("impression_at");--> statement-breakpoint
CREATE INDEX "churn_tracking_is_at_risk_idx" ON "churn_tracking" USING btree ("is_at_risk");--> statement-breakpoint
CREATE INDEX "churn_tracking_churned_idx" ON "churn_tracking" USING btree ("churned");--> statement-breakpoint
CREATE INDEX "churn_tracking_updated_at_idx" ON "churn_tracking" USING btree ("updated_at");--> statement-breakpoint
CREATE INDEX "cohorts_daily_cohort_date_idx" ON "cohorts_daily" USING btree ("cohort_date");--> statement-breakpoint
CREATE INDEX "cohorts_daily_user_id_idx" ON "cohorts_daily" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "cohorts_daily_days_since_signup_idx" ON "cohorts_daily" USING btree ("days_since_signup");--> statement-breakpoint
CREATE INDEX "payout_runs_creator_id_idx" ON "payout_runs" USING btree ("creator_id");--> statement-breakpoint
CREATE INDEX "payout_runs_transfer_status_idx" ON "payout_runs" USING btree ("transfer_status");--> statement-breakpoint
CREATE INDEX "referrals_referred_by_idx" ON "referrals" USING btree ("referred_by_user_id");--> statement-breakpoint
CREATE INDEX "referrals_conversion_status_idx" ON "referrals" USING btree ("conversion_status");--> statement-breakpoint
CREATE INDEX "videos_style_idx" ON "videos" USING btree ("style");--> statement-breakpoint
CREATE INDEX "videos_genre_idx" ON "videos" USING btree ("genre");--> statement-breakpoint
CREATE INDEX "videos_tool_idx" ON "videos" USING btree ("tool");