-- Add foreign key constraint from videos.event_id to events.id
-- Uses SET NULL on delete so removing an event doesn't cascade-delete its videos.
DO $$ BEGIN
 ALTER TABLE "videos" ADD CONSTRAINT "videos_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
