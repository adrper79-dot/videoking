import { index, integer, jsonb, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { users } from "./users";

export const assets = pgTable("assets", {
  id: uuid("id").primaryKey().defaultRandom(),
  creatorId: uuid("creator_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  filename: text("filename").notNull(),
  category: text("category").notNull(), // brushes, backgrounds, templates, tools
  tags: jsonb("tags").$type<string[]>().default([]),
  r2Path: text("r2_path").notNull(),
  downloadCount: integer("download_count").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  creatorIdIdx: index("assets_creator_id_idx").on(table.creatorId),
  categoryIdx: index("assets_category_idx").on(table.category),
}));
