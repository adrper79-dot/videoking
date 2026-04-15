import { index, integer, pgTable, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { users } from "./users";
import { videos } from "./videos";

export const playlists = pgTable("playlists", {
  id: uuid("id").primaryKey().defaultRandom(),
  creatorId: uuid("creator_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  description: text("description"),
  thumbnailUrl: text("thumbnail_url"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  creatorIdIdx: index("playlists_creator_id_idx").on(table.creatorId),
}));

export const playlistVideos = pgTable("playlist_videos", {
  playlistId: uuid("playlist_id")
    .notNull()
    .references(() => playlists.id, { onDelete: "cascade" }),
  videoId: uuid("video_id")
    .notNull()
    .references(() => videos.id, { onDelete: "cascade" }),
  position: integer("position").notNull().default(0),
  addedAt: timestamp("added_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  uniquePlaylistVideo: uniqueIndex("playlist_videos_unique_idx").on(table.playlistId, table.videoId),
  playlistIdIdx: index("playlist_videos_playlist_id_idx").on(table.playlistId),
  videoIdIdx: index("playlist_videos_video_id_idx").on(table.videoId),
}));
