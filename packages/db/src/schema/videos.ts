import { index, pgEnum, pgTable, text, timestamp, uuid, integer, boolean, jsonb } from "drizzle-orm/pg-core";
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

export const videoStyleEnum = pgEnum("video_style", [
  "digital",
  "traditional",
  "mixed_media",
  "3d",
]);

export const videoToolEnum = pgEnum("video_tool", [
  "procreate",
  "clip_studio",
  "photoshop",
  "krita",
  "affinity",
  "blender",
  "maya",
  "traditional_media",
  "other",
]);

export const videoGenreEnum = pgEnum("video_genre", [
  "animation",
  "comic",
  "illustration",
  "character_design",
  "concept_art",
  "afro_fantasy",
  "sci_fi",
  "animation_short",
  "process_video",
  "tutorial",
  "speedart",
  "other",
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
  // Phase 2: BlerdArt niche features
  tags: jsonb("tags").$type<string[]>().default([]),
  style: videoStyleEnum("style"),
  tool: videoToolEnum("tool"),
  genre: videoGenreEnum("genre"),
  eventId: uuid("event_id"),
  humanCreatedAffirmed: boolean("human_created_affirmed").notNull().default(false),
  watermarkEnabled: boolean("watermark_enabled").notNull().default(false),
}, (table) => ({
  creatorIdIdx: index("videos_creator_id_idx").on(table.creatorId),
  statusVisibilityIdx: index("videos_status_visibility_idx").on(table.status, table.visibility, table.publishedAt),
  creatorStatusVisibilityIdx: index("videos_creator_status_visibility_idx").on(table.creatorId, table.status, table.visibility),
  styleIdx: index("videos_style_idx").on(table.style),
  genreIdx: index("videos_genre_idx").on(table.genre),
  toolIdx: index("videos_tool_idx").on(table.tool),
}));

