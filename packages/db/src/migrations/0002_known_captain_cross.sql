CREATE TYPE "public"."notification_status" AS ENUM('pending', 'shown', 'dismissed', 'actioned');--> statement-breakpoint
CREATE TYPE "public"."notification_type" AS ENUM('trial_ending_soon', 'trial_ended', 'subscription_upgrade_upsell', 'watch_party_invite', 'new_video', 'milestone', 'referral_bonus');--> statement-breakpoint
CREATE TABLE "notifications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"type" "notification_type" NOT NULL,
	"title" text NOT NULL,
	"message" text NOT NULL,
	"cta_url" text,
	"cta_label" text DEFAULT 'Learn More',
	"status" "notification_status" DEFAULT 'pending' NOT NULL,
	"priority" integer DEFAULT 1 NOT NULL,
	"show_attempts" integer DEFAULT 0 NOT NULL,
	"dismissed_at" timestamp with time zone,
	"actioned_at" timestamp with time zone,
	"expires_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;