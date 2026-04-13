// Re-export all schema tables and relations from a single entry point
export * from "./users";
export * from "./videos";
export * from "./subscriptions";
export * from "./earnings";
export * from "./interactions";
export * from "./playlists";
export * from "./moderation";
export * from "./auth";
// Phase 2: BlerdArt niche features
export * from "./events";
export * from "./assets";

// ─── Drizzle Relations (defined here to avoid circular imports) ───────────────
import { relations } from "drizzle-orm";
import { users } from "./users";
import { videos } from "./videos";
import { subscriptions } from "./subscriptions";
import { earnings, connectedAccounts } from "./earnings";
import { chatMessages, polls, pollVotes, videoUnlocks } from "./interactions";
import { playlists, playlistVideos } from "./playlists";
import { moderationReports } from "./moderation";

export const usersRelations = relations(users, ({ many }) => ({
  videos: many(videos),
  subscriptionsAsSubscriber: many(subscriptions, { relationName: "subscriber" }),
  subscriptionsAsCreator: many(subscriptions, { relationName: "creator" }),
  earnings: many(earnings),
  connectedAccount: many(connectedAccounts),
  chatMessages: many(chatMessages),
  pollVotes: many(pollVotes),
  playlists: many(playlists),
  moderationReports: many(moderationReports),
}));

export const videosRelations = relations(videos, ({ one, many }) => ({
  creator: one(users, { fields: [videos.creatorId], references: [users.id] }),
  chatMessages: many(chatMessages),
  polls: many(polls),
  playlistVideos: many(playlistVideos),
  videoUnlocks: many(videoUnlocks),
}));

export const subscriptionsRelationsExt = relations(subscriptions, ({ one }) => ({
  subscriber: one(users, {
    fields: [subscriptions.subscriberId],
    references: [users.id],
    relationName: "subscriber",
  }),
  creator: one(users, {
    fields: [subscriptions.creatorId],
    references: [users.id],
    relationName: "creator",
  }),
}));

export const earningsRelationsExt = relations(earnings, ({ one }) => ({
  creator: one(users, { fields: [earnings.creatorId], references: [users.id] }),
  video: one(videos, { fields: [earnings.videoId], references: [videos.id] }),
}));

export const connectedAccountsRelationsExt = relations(connectedAccounts, ({ one }) => ({
  user: one(users, { fields: [connectedAccounts.userId], references: [users.id] }),
}));

export const chatMessagesRelationsExt = relations(chatMessages, ({ one }) => ({
  video: one(videos, { fields: [chatMessages.videoId], references: [videos.id] }),
  user: one(users, { fields: [chatMessages.userId], references: [users.id] }),
}));

export const pollsRelationsExt = relations(polls, ({ one, many }) => ({
  video: one(videos, { fields: [polls.videoId], references: [videos.id] }),
  creator: one(users, { fields: [polls.creatorId], references: [users.id] }),
  votes: many(pollVotes),
}));

export const pollVotesRelationsExt = relations(pollVotes, ({ one }) => ({
  poll: one(polls, { fields: [pollVotes.pollId], references: [polls.id] }),
  user: one(users, { fields: [pollVotes.userId], references: [users.id] }),
}));

export const videoUnlocksRelationsExt = relations(videoUnlocks, ({ one }) => ({
  user: one(users, { fields: [videoUnlocks.userId], references: [users.id] }),
  video: one(videos, { fields: [videoUnlocks.videoId], references: [videos.id] }),
}));

export const playlistsRelationsExt = relations(playlists, ({ one, many }) => ({
  creator: one(users, { fields: [playlists.creatorId], references: [users.id] }),
  playlistVideos: many(playlistVideos),
}));

export const playlistVideosRelationsExt = relations(playlistVideos, ({ one }) => ({
  playlist: one(playlists, {
    fields: [playlistVideos.playlistId],
    references: [playlists.id],
  }),
  video: one(videos, { fields: [playlistVideos.videoId], references: [videos.id] }),
}));

export const moderationReportsRelationsExt = relations(moderationReports, ({ one }) => ({
  reporter: one(users, {
    fields: [moderationReports.reporterId],
    references: [users.id],
  }),
}));

