import {
  boolean,
  index,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  integer,
} from "drizzle-orm/pg-core";
import { users } from "./users";
import { videos } from "./videos";

// ─── Chat Messages ────────────────────────────────────────────────────────────

export const chatMessageTypeEnum = pgEnum("chat_message_type", [
  "message",
  "reaction",
  "system",
]);

export const chatMessages = pgTable("chat_messages", {
  id: uuid("id").primaryKey().defaultRandom(),
  videoId: uuid("video_id")
    .notNull()
    .references(() => videos.id, { onDelete: "cascade" }),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  content: text("content").notNull(),
  type: chatMessageTypeEnum("type").notNull().default("message"),
  isDeleted: boolean("is_deleted").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  videoIdIdx: index("chat_messages_video_id_idx").on(table.videoId),
  userIdIdx: index("chat_messages_user_id_idx").on(table.userId),
}));

// ─── Polls ────────────────────────────────────────────────────────────────────

export const pollStatusEnum = pgEnum("poll_status", ["active", "closed"]);

export const polls = pgTable("polls", {
  id: uuid("id").primaryKey().defaultRandom(),
  videoId: uuid("video_id")
    .notNull()
    .references(() => videos.id, { onDelete: "cascade" }),
  creatorId: uuid("creator_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  question: text("question").notNull(),
  options: jsonb("options").$type<Array<{ id: string; text: string }>>().notNull(),
  status: pollStatusEnum("status").notNull().default("active"),
  endsAt: timestamp("ends_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  creatorIdIdx: index("polls_creator_id_idx").on(table.creatorId),
}));

export const pollVotes = pgTable(
  "poll_votes",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    pollId: uuid("poll_id")
      .notNull()
      .references(() => polls.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    optionId: text("option_id").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    pollUserUniqueIdx: uniqueIndex("poll_votes_poll_user_idx").on(table.pollId, table.userId),
    userIdIdx: index("poll_votes_user_id_idx").on(table.userId),
  }),
);

// ─── Video Unlocks ────────────────────────────────────────────────────────────

export const videoUnlocks = pgTable(
  "video_unlocks",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    videoId: uuid("video_id")
      .notNull()
      .references(() => videos.id, { onDelete: "cascade" }),
    stripePaymentIntentId: text("stripe_payment_intent_id").notNull(),
    amountCents: integer("amount_cents").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    userVideoUniqueIdx: uniqueIndex("video_unlocks_user_video_idx").on(
      table.userId,
      table.videoId,
    ),
    userIdIdx: index("video_unlocks_user_id_idx").on(table.userId),
    videoIdIdx: index("video_unlocks_video_id_idx").on(table.videoId),
  }),
);
