ALTER TABLE "users" ADD COLUMN "last_ad_served_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "ad_frequency_limit_ms" integer DEFAULT 600000 NOT NULL;