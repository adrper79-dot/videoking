DO $$ BEGIN
  CREATE TYPE video_style AS ENUM (
    'digital',
    'traditional',
    'mixed_media',
    '3d'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE video_tool AS ENUM (
    'procreate',
    'clip_studio',
    'photoshop',
    'krita',
    'affinity',
    'blender',
    'maya',
    'traditional_media',
    'other'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE video_genre AS ENUM (
    'animation',
    'comic',
    'illustration',
    'character_design',
    'concept_art',
    'afro_fantasy',
    'sci_fi',
    'animation_short',
    'process_video',
    'tutorial',
    'speedart',
    'other'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- Add BlerdArt-specific columns to videos table
ALTER TABLE videos
  ADD COLUMN IF NOT EXISTS tags jsonb DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS style video_style,
  ADD COLUMN IF NOT EXISTS tool video_tool,
  ADD COLUMN IF NOT EXISTS genre video_genre,
  ADD COLUMN IF NOT EXISTS event_id uuid,
  ADD COLUMN IF NOT EXISTS human_created_affirmed boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS watermark_enabled boolean NOT NULL DEFAULT false;

-- Add indexes for efficient discovery queries
CREATE INDEX IF NOT EXISTS videos_style_idx ON videos (style);
CREATE INDEX IF NOT EXISTS videos_genre_idx ON videos (genre);
CREATE INDEX IF NOT EXISTS videos_tool_idx ON videos (tool);

-- Add BlerdArt verification to users table
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS blerdart_verified boolean NOT NULL DEFAULT false;

-- Create events table for BlerdCon and other events
CREATE TABLE IF NOT EXISTS events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  slug text NOT NULL UNIQUE,
  description text,
  start_date timestamptz NOT NULL,
  end_date timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS events_slug_idx ON events (slug);

-- Create assets table for creator resource library
CREATE TABLE IF NOT EXISTS assets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  creator_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  filename text NOT NULL,
  category text NOT NULL,
  tags jsonb DEFAULT '[]'::jsonb,
  r2_path text NOT NULL,
  download_count integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS assets_creator_id_idx ON assets (creator_id);
CREATE INDEX IF NOT EXISTS assets_category_idx ON assets (category);

-- Add foreign key constraint for video events (if not already present)
ALTER TABLE videos
  ADD CONSTRAINT videos_event_id_fk FOREIGN KEY (event_id) REFERENCES events(id) ON DELETE SET NULL;
