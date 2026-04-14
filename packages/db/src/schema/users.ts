import { boolean, integer, jsonb, pgEnum, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

export const userRoleEnum = pgEnum("user_role", ["viewer", "creator", "admin"]);
export const userTierEnum = pgEnum("user_tier", ["free", "citizen", "vip"]);
export const membershipStatusEnum = pgEnum("membership_status", [
  "none",
  "trial",
  "active",
  "canceled",
  "past_due",
]);

export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  email: text("email").notNull().unique(),
  username: text("username").notNull().unique(),
  displayName: text("display_name").notNull(),
  avatarUrl: text("avatar_url"),
  role: userRoleEnum("role").notNull().default("viewer"),
  userTier: userTierEnum("user_tier").notNull().default("free"),
  subscriptionStatus: membershipStatusEnum("subscription_status").notNull().default("none"),
  trialEndsAt: timestamp("trial_ends_at", { withTimezone: true }),
  hasSeenOnboarding: boolean("has_seen_onboarding").notNull().default(false),
  adPreferences: jsonb("ad_preferences")
    .$type<{ personalizedAds: boolean }>()
    .notNull()
    .default({ personalizedAds: true }),
  bio: text("bio"),
  website: text("website"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  // Phase 2: BlerdArt niche features
  blerdartVerified: boolean("blerdart_verified").notNull().default(false),
  // Phase 4: Referral program and trial extensions
  accountCreditsCents: integer("account_credits_cents").notNull().default(0),
  trialExtendedDays: integer("trial_extended_days").notNull().default(0),
  // Phase 4: Email notification preferences
  emailPreferences: jsonb("email_preferences")
    .$type<{
      trial_alerts: boolean;
      new_videos: boolean;
      watch_party_invites: boolean;
      payout_milestones: boolean;
      referral_bonuses: boolean;
      community_updates: boolean;
    }>()
    .notNull()
    .default({
      trial_alerts: true,
      new_videos: true,
      watch_party_invites: true,
      payout_milestones: true,
      referral_bonuses: true,
      community_updates: false,
    }),
});