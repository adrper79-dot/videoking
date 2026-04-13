import { index, pgTable, text, timestamp, uuid, integer } from "drizzle-orm/pg-core";

export const adEvents = pgTable(
  "ad_events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    videoId: uuid("video_id").notNull(),
    creatorId: uuid("creator_id").notNull(),
    adNetwork: text("ad_network").notNull().default("placeholder"),
    estimatedRevenueCents: integer("estimated_revenue_cents").default(0),
    impressionAt: timestamp("impression_at", { withTimezone: true }).defaultNow(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    creatorAtIdx: index("idx_ad_events_creator_at").on(table.creatorId, table.impressionAt),
    videoAtIdx: index("idx_ad_events_video_at").on(table.videoId, table.impressionAt),
    impressionAtIdx: index("idx_ad_events_impression_at").on(table.impressionAt),
  })
);

export type AdEvent = typeof adEvents.$inferSelect;
