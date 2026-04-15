import { index, pgTable, text, timestamp, uuid, integer, numeric } from "drizzle-orm/pg-core";
import { videos } from "./videos";
import { users } from "./users";

export const ads = pgTable("ads", {
  id: uuid("id").primaryKey().defaultRandom(),
  creatorId: uuid("creator_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const adEvents = pgTable(
  "ad_events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    adId: uuid("ad_id").references(() => ads.id, { onDelete: "cascade" }),
    videoId: uuid("video_id").notNull().references(() => videos.id, { onDelete: "cascade" }),
    creatorId: uuid("creator_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    eventType: text("event_type").notNull(),
    impressions: integer("impressions").notNull().default(0),
    clicks: integer("clicks").notNull().default(0),
    revenue: numeric("revenue", { precision: 12, scale: 4 }).notNull().default("0"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (table) => ({
    videoIdIdx: index("ad_events_video_id_idx").on(table.videoId),
    creatorIdIdx: index("ad_events_creator_id_idx").on(table.creatorId),
    adIdIdx: index("ad_events_ad_id_idx").on(table.adId),
    createdAtIdx: index("ad_events_created_at_idx").on(table.createdAt),
  })
);

export type AdEvent = typeof adEvents.$inferSelect;
