CREATE INDEX "videos_creator_status_visibility_idx" ON "videos" USING btree ("creator_id","status","visibility");--> statement-breakpoint
CREATE INDEX "earnings_creator_status_idx" ON "earnings" USING btree ("creator_id","status");--> statement-breakpoint
CREATE INDEX "earnings_video_id_idx" ON "earnings" USING btree ("video_id");--> statement-breakpoint
CREATE INDEX "chat_messages_user_id_idx" ON "chat_messages" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "poll_votes_user_id_idx" ON "poll_votes" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "polls_creator_id_idx" ON "polls" USING btree ("creator_id");--> statement-breakpoint
CREATE INDEX "video_unlocks_user_id_idx" ON "video_unlocks" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "video_unlocks_video_id_idx" ON "video_unlocks" USING btree ("video_id");--> statement-breakpoint
CREATE INDEX "playlist_videos_playlist_id_idx" ON "playlist_videos" USING btree ("playlist_id");--> statement-breakpoint
CREATE INDEX "playlist_videos_video_id_idx" ON "playlist_videos" USING btree ("video_id");--> statement-breakpoint
CREATE INDEX "playlists_creator_id_idx" ON "playlists" USING btree ("creator_id");--> statement-breakpoint
CREATE INDEX "moderation_reports_reporter_id_idx" ON "moderation_reports" USING btree ("reporter_id");--> statement-breakpoint
CREATE INDEX "accounts_user_id_idx" ON "accounts" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "sessions_user_id_idx" ON "sessions" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "notifications_user_id_idx" ON "notifications" USING btree ("user_id");