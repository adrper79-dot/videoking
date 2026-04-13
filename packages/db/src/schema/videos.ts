import { index, pgEnum, pgTable, text, timestamp, uuid, integer } from "drizzle-orm/pg-core";
import { users } from "./users";

export const videoStatusEnum = pgEnum("video_status", [
  "processing",
  "ready",
  "live",
  "unlisted",
  "deleted",
]);

export const videoVisibilityEnum = pgEnum("video_visibility", [
  "public",
  "subscribers_only",
  "unlocked_only",
]);

export const videos = pgTable("videos", {
  id: uuid("id").primaryKey().defaultRandom(),
  creatorId: uuid("creator_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  cloudflareStreamId: text("cloudflare_stream_id").notNull(),
  title: text("title").notNull(),
  description: text("description"),
  thumbnailUrl: text("thumbnail_url"),
  durationSeconds: integer("duration_seconds"),
  status: videoStatusEnum("status").notNull().default("processing"),
  visibility: videoVisibilityEnum("visibility").notNull().default("public"),
  unlockPriceCents: integer("unlock_price_cents"),
  viewsCount: integer("views_count").notNull().default(0),
  likesCount: integer("likes_count").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  publishedAt: timestamp("published_at", { withTimezone: true }),
}, (table) => ({
  creatorIdIdx: index("videos_creator_id_idx").on(table.creatorId),
  statusVisibilityIdx: index("videos_status_visibility_idx").on(table.status, table.visibility, table.publishedAt),
}));

