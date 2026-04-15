import { boolean, index, pgEnum, pgTable, text, timestamp, uuid, integer } from "drizzle-orm/pg-core";
import { users } from "./users";
import { videos } from "./videos";

export const earningTypeEnum = pgEnum("earning_type", [
  "subscription_share",
  "unlock_purchase",
  "tip",
  "ad_impression",
]);

export const earningStatusEnum = pgEnum("earning_status", [
  "pending",
  "transferred",
  "failed",
]);

export const earnings = pgTable("earnings", {
  id: uuid("id").primaryKey().defaultRandom(),
  creatorId: uuid("creator_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  videoId: uuid("video_id").references(() => videos.id, { onDelete: "set null" }),
  type: earningTypeEnum("type").notNull(),
  grossAmountCents: integer("gross_amount_cents").notNull(),
  platformFeeCents: integer("platform_fee_cents").notNull(),
  netAmountCents: integer("net_amount_cents").notNull(),
  stripeTransferId: text("stripe_transfer_id"),
  stripePaymentIntentId: text("stripe_payment_intent_id"),
  status: earningStatusEnum("status").notNull().default("pending"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  creatorCreatedAtIdx: index("earnings_creator_created_at_idx").on(table.creatorId, table.createdAt),
  creatorStatusIdx: index("earnings_creator_status_idx").on(table.creatorId, table.status),
  videoIdIdx: index("earnings_video_id_idx").on(table.videoId),
}));

export const connectedAccounts = pgTable("connected_accounts", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id")
    .notNull()
    .unique()
    .references(() => users.id, { onDelete: "cascade" }),
  stripeAccountId: text("stripe_account_id").notNull().unique(),
  chargesEnabled: boolean("charges_enabled").notNull().default(false),
  payoutsEnabled: boolean("payouts_enabled").notNull().default(false),
  onboardingComplete: boolean("onboarding_complete").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

