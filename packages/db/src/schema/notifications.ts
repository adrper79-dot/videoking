import { pgEnum, pgTable, text, timestamp, uuid, integer } from "drizzle-orm/pg-core";
import { users } from "./users";

export const notificationTypeEnum = pgEnum("notification_type", [
  "trial_ending_soon", // Trial ends in 3-7 days
  "trial_ended", // Trial just ended, downgrade imminent
  "subscription_upgrade_upsell", // Rate limit/ feature upsell
  "watch_party_invite", // Invited to private watch party
  "new_video", // Creator uploaded new video
  "milestone", // Creator hit milestone (1k views, etc)
  "referral_bonus", // Referral converted to paid
]);

export const notificationStatusEnum = pgEnum("notification_status", [
  "pending", // Not yet shown to user
  "shown", // Displayed to user
  "dismissed", // User dismissed the notification
  "actioned", // User clicked CTA (converted)
]);

/**
 * In-app notifications for trial expiry, upsells, and engagement
 * - Expires automatically after expiry_at timestamp
 * - Status tracks whether user has seen/acted on notification
 * - Metadata stores notification-specific data (e.g., days remaining, tier level)
 */
export const notifications = pgTable("notifications", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  type: notificationTypeEnum("type").notNull(),
  title: text("title").notNull(),
  message: text("message").notNull(),
  ctaUrl: text("cta_url"), // URL for call-to-action button (e.g., /pricing)
  ctaLabel: text("cta_label").default("Learn More"), // Button text
  status: notificationStatusEnum("status").notNull().default("pending"),
  priority: integer("priority").notNull().default(1), // 0=low, 1=normal, 2=urgent
  showAttempts: integer("show_attempts").notNull().default(0), // Track UI render attempts
  dismissedAt: timestamp("dismissed_at", { withTimezone: true }),
  actionedAt: timestamp("actioned_at", { withTimezone: true }),
  expiresAt: timestamp("expires_at", { withTimezone: true }), // Auto-purge after this date
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});
