# Workers AI Integration Guide: Auto-Captioning

## Overview

This guide covers integrating Cloudflare Workers AI for automatic video captioning in NicheStream Phase 2. This feature addresses creator pain point #5 (Production Burden) by auto-generating VTT captions using the Whisper model.

## Architecture

```
Video Uploaded → Stream Ready Event → Durable Object/Trigger
                                         ↓
                                   Workers AI (Whisper)
                                         ↓
                                   VTT File Generated
                                         ↓
                                   Upload to R2
                                         ↓
                                   Store URL in Database
                                         ↓
                                   VideoPlayer Loads Captions
```

## Implementation Steps

### Phase 1: Database Layer

Add caption fields to videos schema:

```typescript
// packages/db/src/schema/videos.ts
export const videos = pgTable("videos", {
  // ... existing fields ...
  captionsEnabled: boolean("captions_enabled").notNull().default(false),
  captionsUrl: text("captions_url"),
});
```

Create migration:

```sql
-- packages/db/src/migrations/0003_workers_ai_captions.sql
ALTER TABLE videos ADD COLUMN captions_enabled boolean NOT NULL DEFAULT false;
ALTER TABLE videos ADD COLUMN captions_url text;

CREATE INDEX videos_captions_enabled_idx 
ON videos(captions_enabled) 
WHERE captions_enabled = true;
```

Run migration:
```bash
cd packages/db
pnpm db:generate
pnpm db:migrate
```

### Phase 2: Worker Captions Library

Create caption generation service:

```typescript
// apps/worker/src/lib/captions.ts

import type { Env } from "../types";

interface CaptioningResult {
  success: boolean;
  captionsUrl?: string;
  error?: string;
}

/**
 * Generate captions using Workers AI Whisper model
 */
export async function generateCaptions(
  streamId: string,
  env: Env
): Promise<CaptioningResult> {
  try {
    // 1. Fetch video from Stream API to get download URL
    const videoData = await fetchStreamVideo(streamId, env);
    
    // 2. Call Workers AI Whisper model
    const transcript = await env.AI.run("@cf/openai/whisper", {
      audio: videoData.audioBuffer, // Must extract audio from video
    });
    
    // 3. Convert transcript to VTT format
    const vttContent = formatAsVTT(transcript);
    
    // 4. Upload VTT to R2
    const captionsUrl = await uploadToR2(streamId, vttContent, env);
    
    return {
      success: true,
      captionsUrl,
    };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Unknown error",
    };
  }
}

/**
 * Format whisper transcript as WebVTT
 */
function formatAsVTT(transcript: WhisperResponse): string {
  let vtt = "WEBVTT\n\n";
  
  for (const segment of transcript.segments) {
    const start = formatTime(segment.start);
    const end = formatTime(segment.end);
    vtt += `${start} --> ${end}\n${segment.text}\n\n`;
  }
  
  return vtt;
}

/**
 * Upload VTT file to R2
 */
async function uploadToR2(
  videoId: string,
  vttContent: string,
  env: Env
): Promise<string> {
  const fileName = `captions/${videoId}.vtt`;
  const bucket = env.R2_BUCKET;
  
  await bucket.put(fileName, vttContent, {
    httpMetadata: {
      contentType: "text/vtt",
      cacheControl: "public, max-age=86400",
    },
  });
  
  return `${env.R2_DOMAIN_URL}/${fileName}`;
}
```

### Phase 3: API Routes

Create captions endpoint:

```typescript
// apps/worker/src/routes/captions.ts

import { Hono } from "hono";
import { eq } from "drizzle-orm";
import type { Env } from "../types";
import { createDb } from "../lib/db";
import { generateCaptions } from "../lib/captions";
import { videos } from "@nichestream/db";
import { requireSession } from "../middleware/session";

const captionsRouter = new Hono<{ Bindings: Env }>();

/**
 * POST /captions/:videoId/generate
 * Trigger caption generation
 */
captionsRouter.post("/:videoId/generate", requireSession(), async (c) => {
  const db = createDb(c.env);
  const videoId = c.req.param("videoId");
  const user = c.get("user") as any;

  try {
    // Verify ownership
    const [video] = await db
      .select()
      .from(videos)
      .where(eq(videos.id, videoId));

    if (!video || video.creatorId !== user.id) {
      return c.json({ error: "Forbidden" }, 403);
    }

    // Generate captions
    const result = await generateCaptions(video.cloudflareStreamId, c.env);

    if (result.success) {
      // Update database
      await db
        .update(videos)
        .set({
          captionsEnabled: true,
          captionsUrl: result.captionsUrl,
        })
        .where(eq(videos.id, videoId));

      return c.json({
        success: true,
        captionsUrl: result.captionsUrl,
      });
    } else {
      return c.json(
        {
          error: "CaptioningFailed",
          message: result.error,
        },
        500
      );
    }
  } catch (err) {
    console.error("Caption generation error:", err);
    return c.json({ error: "InternalError" }, 500);
  }
});

export default captionsRouter;
```

### Phase 4: Frontend Integration

Add "Generate Captions" button to dashboard:

```typescript
// apps/web/src/components/CaptionGenerator.tsx

"use client";

import { useState } from "react";
import { api } from "@/lib/api";

interface CaptionGeneratorProps {
  videoId: string;
  hasCaptions: boolean;
}

export function CaptionGenerator({
  videoId,
  hasCaptions,
}: CaptionGeneratorProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleGenerateCaptions = async () => {
    setLoading(true);
    setError(null);

    try {
      const result = await api.post(`/api/captions/${videoId}/generate`, {});
      
      if (result.success) {
        // Refresh video data or show success
        window.location.reload();
      }
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to generate captions"
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <button
      onClick={handleGenerateCaptions}
      disabled={loading || hasCaptions}
      className={`px-4 py-2 rounded ${
        hasCaptions
          ? "bg-gray-600 text-gray-300 cursor-not-allowed"
          : "bg-blue-600 text-white hover:bg-blue-700"
      }`}
    >
      {loading
        ? "Generating..."
        : hasCaptions
          ? "✓ Captions Ready"
          : "Generate AI Captions"}
    </button>
  );
}
```

### Phase 5: Video Player Enhancement

Load captions in VideoPlayer:

```typescript
// apps/web/src/components/VideoPlayer.tsx

export function VideoPlayer({ videoId, captionsUrl }: Props) {
  return (
    <video controls>
      <source src={videoSrc} type="video/mp4" />
      {captionsUrl && (
        <track
          kind="captions"
          src={captionsUrl}
          srcLang="en"
          label="English"
          default
        />
      )}
    </video>
  );
}
```

## Environment Configuration

Add to `wrangler.toml`:

```toml
[env.production]
# Workers AI binding
ai = { binding = "AI" }

# Existing bindings
r2_bucket = { bucket_name = "nichestream-content" }

# Configuration
vars = { R2_DOMAIN_URL = "https://cdn.nichestream.example.com" }

# Set Cloudflare Account ID for Stream API calls
account_id = "your-account-id"
```

Also in Worker environment type:

```typescript
// apps/worker/src/types.ts
export interface Env {
  // ... existing ...
  AI: any; // Cloudflare Workers AI binding
  ACCOUNT_ID: string;
  R2_DOMAIN_URL: string;
}
```

## Model Capabilities

### Whisper Model (@cf/openai/whisper)

**Pros:**
- Multilingual (99+ languages)
- High accuracy on audio
- Supports various audio formats
- ~$0.0001 per minute of audio

**Limitations:**
- Requires audio extraction from video first
- ~30-60 second latency per call
- File size limits (~25MB per request)

**Alternative Models:**
- `@cf/openai/whisper-tiny` - Faster, lower accuracy
- Custom models via Hugging Face integration

## Testing

###Integration Test:

```bash
curl -X POST http://localhost:8787/api/captions/{videoId}/generate \
  -H "Authorization: Bearer {token}" \
  -H "Content-Type: application/json"
```

### End-to-End Flow:

1. Upload video → Stream status becomes "ready"
2. Call POST `/api/captions/:videoId/generate`
3. Wait 30-60 seconds
4. Fetch GET `/api/captions/:videoId` to check status
5. Load video with `<track>` tag pointing to `captionsUrl`
6. Test caption display in browser

## Error Handling

```typescript
// Graceful fallback if AI unavailable
if (!env.AI) {
  // Show "Captions unavailable" UI
  // Don't block video playback
  return { success: false, error: "AI model unavailable" };
}

// Handle model overload
if (result.error.includes("overloaded")) {
  // Retry with exponential backoff
  // Or queue for later processing
}
```

## Performance Considerations

- **Async Processing:** Use Durable Objects to track captioning progress
- **Caching:** VTT files cached aggressively in R2 and CDN
- **Rate Limiting:** Limit concurrent caption jobs to 10-50 per account
- **Cost:** Monitor API usage; ~$0.001 per video at volume

## Deployment Checklist

- [ ] Database migration applied (`pnpm db:migrate`)
- [ ] Worker AI binding configured in `wrangler.toml`
- [ ] `@cf/openai/whisper` model available in account
- [ ] R2 bucket public access configured
- [ ] Caption routes deployed to Worker
- [ ] Frontend button added to dashboard
- [ ] VideoPlayer `<track>` element added
- [ ] VTT files loading correctly in browser
- [ ] Error messages shown to users
- [ ] Cost monitoring set up

## Future Enhancements

- **Batch Processing:** Queue multiple videos for caption generation
- **Auto-Captions on Upload:** Automatically trigger when video enters "ready" status
- **Multilingual:** Detect audio language, generate captions in original + English
- **Custom Branding:** Add creator watermark to caption timing
- **Editing UI:** Allow creators to edit generated captions
- **Pricing Integration:** Charge VIP users for captions feature

## Resources

- [Cloudflare Workers AI Docs](https://developers.cloudflare.com/ai/)
- [Whisper Model Card](https://huggingface.co/openai/whisper-base)
- [WebVTT Specification](https://w3c.github.io/webvtt1/)
- [Drizzle ORM Docs](https://orm.drizzle.team/)

