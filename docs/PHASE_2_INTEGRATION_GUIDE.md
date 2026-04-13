# Phase 2: BlerdArt Specialization — Integration Guide

This document provides integration instructions for Phase 2 BlerdArt features now available in the codebase.

---

## 🎯 What's New in Phase 2

### Database
- **events table** — Store BlerdCon and curator events
- **assets table** — Creator resource library (Procreate brushes, Photoshop templates, etc.)
- **Extended videos table** — Metadata fields: style, tool, genre, tags, eventId
- **Creator verification** — `users.blerdart_verified` boolean flag

### APIs
- **`POST /api/admin/verify-creator`** — Verify creator (admin only)
- **`GET/POST /api/events`** — Browse and create events
- **`GET /api/events/:slug`** — Event detail with videos
- **`GET/POST/DELETE /api/assets`** — Creator asset CRUD
- **`GET /api/assets/:assetId/download`** — Asset download with tracking

### Frontend Components
- **`DiscoveryFilters`** — Filter videos by style, tool, genre, search
- **`CreatorVerification`** — Badge and profile components for verified creators
- **Enhanced `UploadForm`** — Video metadata fields for style, tool, genre, tags
- **`/events`** — Browse all events
- **`/events/[slug]`** — Event detail page
- **`/dashboard/assets`** — Creator asset library

---

## 🚀 Using Phase 2 Features

### 1. Video Upload with BlerdArt Metadata

Users uploading videos now see optional creative metadata fields:

```tsx
// UploadForm automatically includes:
- Art Style: digital, traditional, mixed_media, 3d
- Primary Tool: Procreate, Photoshop, Krita, Blender, etc.
- Genre: animation, illustration, character_design, etc.
- Tags: comma-separated text
```

**Location:** `apps/web/src/components/UploadForm.tsx`

### 2. Discovering Videos by Creative Style

Videos can be discovered by style, tool, or genre using new filters:

```tsx
import { DiscoveryFilters } from '@/components/DiscoveryFilters';

// In any video feed page:
<DiscoveryFilters 
  onFilter={(filters) => {
    // filters.style, filters.tool, filters.genre, filters.search
    // Reload video feed with filters
  }}
  loading={loading}
/>
```

**Location:** `apps/web/src/components/DiscoveryFilters.tsx`

### 3. Creator Verification Badges

Display verified creator badges on profiles:

```tsx
import { CreatorVerificationBadge, CreatorProfileHeader } from '@/components/CreatorVerification';

// Badge only:
<CreatorVerificationBadge verified={user.blerdart_verified} size="md" />

// Full profile header:
<CreatorProfileHeader
  displayName="Alex Thompson"
  username="alexthompson"
  verified={user.blerdart_verified}
  subscriberCount={2500}
  videoCount={48}
/>
```

**Location:** `apps/web/src/components/CreatorVerification.tsx`

### 4. Managing Creator Events

Admins can create and browse events:

```bash
# Browse all events
GET /api/events?search=blerdcon&limit=50

# Get event detail with videos
GET /api/events/blerdcon-2024

# Create event (admin)
POST /api/events
{
  "name": "BlerdCon 2024",
  "slug": "blerdcon-2024",
  "description": "Annual celebration of Black artists in tech",
  "startDate": "2024-06-01T00:00:00Z",
  "endDate": "2024-06-03T23:59:59Z"
}
```

**API Routes:** `apps/worker/src/routes/events.ts`  
**Pages:** `/events`, `/events/[slug]`

### 5. Creator Asset Library

Creators can upload and share design resources:

```bash
# Upload asset
POST /api/assets (multipart/form-data)
{
  "file": File,
  "category": "brushes",
  "filename": "watercolor.abr",
  "tags": '["watercolor", "natural"]'  // JSON string
}

# Download asset
GET /api/assets/{assetId}/download  # Increments download count

# Delete asset
DELETE /api/assets/{assetId}  # Owner only

# List assets
GET /api/assets?category=brushes&creatorId=uuid&limit=50
```

**API Routes:** `apps/worker/src/routes/assets.ts`  
**Page:** `/dashboard/assets`

---

## 📐 Architecture

### Database Schema

**events table:**
```sql
id (UUID, PK)
name (text, not null)
slug (text, unique, not null)
description (text)
startDate (timestamp with tz)
endDate (timestamp with tz)
createdAt, updatedAt
```

**assets table:**
```sql
id (UUID, PK)
creatorId (UUID, FK → users.id)
filename (text)
category (text)
tags (jsonb array)
r2Path (text)  -- Cloudflare R2 storage path
downloadCount (integer)
createdAt, updatedAt
```

**videos table extensions:**
```sql
tags (jsonb array)
style (enum: digital, traditional, mixed_media, 3d)
tool (enum: procreate, clip_studio, ... [9 values])
genre (enum: animation, comic, ... [11 values])
eventId (UUID, FK → events.id)
humanCreatedAffirmed (boolean)
watermarkEnabled (boolean)
```

**users table extension:**
```sql
blerdart_verified (boolean, default false)
```

### API Patterns

All new API routes follow REST conventions:

- **GET** — Read/list operations  
- **POST** — Create operations (admin routes require `requireAdmin()` middleware)
- **PATCH/DELETE** — Update/delete operations
- **Error responses:** `{ error: "ErrorCode", message: "..." }`
- **Success responses:** `{ success: true, data: {...} }`

### Frontend Patterns

- Uses `EntitlementsContext` for auth (single fetch per app)
- Uses `api.get/post/patch/delete` helpers for API calls
- Components are "use client" where needed
- Responsive design with Tailwind CSS

---

## 🔗 Integration Checklist

### To Add Phase 2 Features to Existing Pages

**Video Feed Page with Discovery:**
```tsx
import { DiscoveryFilters } from '@/components/DiscoveryFilters';
// Pass showFilters={true} prop to VideoFeed
<VideoFeed initialData={data} showFilters={true} />
```

**Creator Channel Page:**
```tsx
import { CreatorProfileHeader } from '@/components/CreatorVerification';
// Display creator with verification badge
<CreatorProfileHeader
  displayName={creator.displayName}
  username={creator.username}
  verified={creator.blerdart_verified}
/>
```

**Admin Panel (Not yet implemented):**
```tsx
// Create form for creator verification
// POST /api/admin/verify-creator with userId
// DELETE /api/admin/verify-creator/:userId to revoke
```

---

## 🛠️ Development Tips

### Adding New Art Styles

To add a new video style (e.g., "pixel_art"):

1. Update `videoStyleEnum` in `packages/db/src/schema/videos.ts`
2. Create migration: `ALTER TYPE video_style_enum ADD VALUE 'pixel_art'`
3. Update `VIDEO_STYLES` in components where needed
4. Update API filters to support new value

### Querying Videos by Metadata

```sql
-- Find all digital art videos
SELECT * FROM videos WHERE style = 'digital' ORDER BY created_at DESC;

-- Find all Procreate tutorials
SELECT * FROM videos 
WHERE tool = 'procreate' AND genre = 'tutorial'
ORDER BY view_count DESC;

-- Find videos from BlerdCon 2024
SELECT * FROM videos 
WHERE event_id = (SELECT id FROM events WHERE slug = 'blerdcon-2024')
ORDER BY created_at DESC;

-- Find videos with specific tags
SELECT * FROM videos 
WHERE tags @> '["character_design"]' 
ORDER BY created_at DESC;
```

### Asset Upload Flow

1. CreateR2 gets upload URL from Cloudflare Stream (existing)
2. Client uploads file directly to Stream
3. Worker updates video metadata via PATCH with style/tool/genre/tags
4. For assets: Client uploads FormData to POST /api/assets
5. Server stores in R2, saves record with r2Path

---

## 📊 Remaining Phase 2 Work

See [PHASE_2_IMPLEMENTATION_SUMMARY.md](./PHASE_2_IMPLEMENTATION_SUMMARY.md) for:
- UI/UX components still needed
- Workers AI integration (auto-captioning)
- Moderation enhancements
- Testing coverage

---

## 🚨 Important Notes

1. **Admin Verification:** Creator verification is admin-only. Implement admin UI panel separately.
2. **File Limits:** Assets are limited to 100MB. Videos limited to 10GB (Cloudflare Stream default).
3. **R2 Configuration:** Ensure R2 bucket is configured in `wrangler.toml` with proper permissions.
4. **Tags:** Video tags are JSONB arrays but frontend sends comma-separated strings (UploadForm handles splitting).
5. **Events:** Event slugs must be unique. Consider slugify library for auto-generation if needed.

---

## 📚 Related Files

- Database: `packages/db/src/schema/videos.ts`, `assets.ts`, `events.ts`
- Migrations: `packages/db/src/migrations/0002_blerdart_phase2.sql`
- APIs: `apps/worker/src/routes/admin.ts`, `events.ts`, `assets.ts`
- Components: `apps/web/src/components/DiscoveryFilters.tsx`, `CreatorVerification.tsx`
- Pages: `apps/web/src/app/events/`, `/dashboard/assets/`

---

**Last Updated:** Phase 2 implementation (commit 8aa532e)  
**Status:** Core features complete, UI polish and E2E tests pending
