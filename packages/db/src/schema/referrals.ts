import { pgEnum, pgTable, uuid, text, integer, date, timestamp, index } from "drizzle-orm/pg-core";
import { users } from "./users";

export const referralConversionStatusEnum = pgEnum("referral_conversion_status", [
  "pending",
  "trial_started",
  "converted",
  "expired",
]);

export const referrals = pgTable(
  "referrals",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    referredUserId: uuid("referred_user_id").references(() => users.id, {
      onDelete: "cascade",
    }),
    referredByUserId: uuid("referred_by_user_id")
      .notNull()
      .references(() => users.id, {
        onDelete: "cascade",
      }),
    referralCode: text("referral_code").notNull().unique(),
    conversionStatus: referralConversionStatusEnum("conversion_status")
      .notNull()
      .default("pending"),
    trialDaysBonus: integer("trial_days_bonus").default(7),
    creditBonusCents: integer("credit_bonus_cents").default(0),
    signedUpAt: timestamp("signed_up_at", { withTimezone: true }),
    trialStartedAt: timestamp("trial_started_at", { withTimezone: true }),
    convertedAt: timestamp("converted_at", { withTimezone: true }),
    expiredAt: timestamp("expired_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => ({
    referredByIdx: index("referrals_referred_by_idx").on(
      table.referredByUserId
    ),
    conversionStatusIdx: index("referrals_conversion_status_idx").on(
      table.conversionStatus
    ),
  })
);

export const cohortTracking = pgTable(
  "cohorts_daily",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    cohortDate: date("cohort_date").notNull(),
    cohortWeek: date("cohort_week").notNull(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, {
        onDelete: "cascade",
      }),
    daysSinceSignup: integer("days_since_signup").notNull(),
    currentTier: text("current_tier").notNull().default("free"),
    isActive: integer("is_active").notNull().default(1), // SQLite style: 0 or 1
    watchedMinutes: integer("watched_minutes").notNull().default(0),
    chatMessages: integer("chat_messages").notNull().default(0),
    pollVotes: integer("poll_votes").notNull().default(0),
    engagementScore: integer("engagement_score").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => ({
    cohortDateIdx: index("cohorts_daily_cohort_date_idx").on(table.cohortDate),
    userIdIdx: index("cohorts_daily_user_id_idx").on(table.userId),
    daysSinceSignupIdx: index("cohorts_daily_days_since_signup_idx").on(
      table.daysSinceSignup
    ),
  })
);

export const churnTracking = pgTable(
  "churn_tracking",
  {
    userId: uuid("user_id")
      .primaryKey()
      .references(() => users.id, {
        onDelete: "cascade",
      }),
    signupDate: date("signup_date").notNull(),
    trialActivatedDate: date("trial_activated_date"),
    trialEndedDate: date("trial_ended_date"),
    convertedDate: date("converted_date"),
    firstCanceledDate: date("first_canceled_date"),
    totalWatchedMinutes: integer("total_watched_minutes").notNull().default(0),
    totalChatMessages: integer("total_chat_messages").notNull().default(0),
    totalPollVotes: integer("total_poll_votes").notNull().default(0),
    inactivityDays: integer("inactivity_days").notNull().default(0),
    isAtRisk: integer("is_at_risk").notNull().default(0), // SQLite style
    churned: integer("churned").notNull().default(0), // SQLite style
    lastActivityAt: timestamp("last_activity_at", { withTimezone: true }),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => ({
    isAtRiskIdx: index("churn_tracking_is_at_risk_idx").on(table.isAtRisk),
    churnedIdx: index("churn_tracking_churned_idx").on(table.churned),
    updatedAtIdx: index("churn_tracking_updated_at_idx").on(table.updatedAt),
  })
);

export const payoutRuns = pgTable(
  "payout_runs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    payoutPeriodStart: date("payout_period_start").notNull(),
    payoutPeriodEnd: date("payout_period_end").notNull(),
    creatorId: uuid("creator_id")
      .notNull()
      .references(() => users.id, {
        onDelete: "cascade",
      }),
    totalGrossCents: integer("total_gross_cents").notNull(),
    platformFeeCents: integer("platform_fee_cents").notNull(),
    creatorNetCents: integer("creator_net_cents").notNull(),
    stripeTransferId: text("stripe_transfer_id").unique(),
    transferStatus: text("transfer_status").notNull().default("pending"),
    processedAt: timestamp("processed_at", { withTimezone: true }),
    paidAt: timestamp("paid_at", { withTimezone: true }),
    failedReason: text("failed_reason"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => ({
    creatorIdIdx: index("payout_runs_creator_id_idx").on(table.creatorId),
    transferStatusIdx: index("payout_runs_transfer_status_idx").on(
      table.transferStatus
    ),
  })
);
