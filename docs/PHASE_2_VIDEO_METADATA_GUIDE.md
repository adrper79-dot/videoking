# Phase 2: Video Metadata & Discovery System

Complete guide to Phase 2's video metadata system for creators and platform developers.

---

## 🎨 Video Metadata Fields

Phase 2 extends the `videos` table with creative metadata that enables discovery and artist showcase:

### New Fields

| Field | Type | Values | Purpose |
|-------|------|--------|---------|
| `style` | enum | digital, traditional, mixed_media, 3d | Art style category |
| `tool` | enum | procreate, clip_studio, photoshop, krita, affinity, blender, maya, traditional_media, other | Primary creation tool |
| `genre` | enum | animation, comic, illustration, character_design, concept_art, afro_fantasy, sci_fi, animation_short, process_video, tutorial, speedart, other | Content genre |
| `tags` | jsonb array | user-defined strings | Flexible tagging system |
| `eventId` | UUID (FK) | events table | Links videos to BlerdCon events |
| `humanCreatedAffirmed` | boolean | true/false | Creator affirms original work (future moderation) |
| `watermarkEnabled` | boolean | true/false | Video has creator watermark |

---

## 📤 Uploading with Metadata

### Upload Form UI

When creators upload videos, they now see:

```
Video Upload Form
├─ Title (required)
├─ Description (optional)
├─ Visibility (public/subscribers/pay-per-view)
└─ Creative Details (optional)
   ├─ Art Style dropdown
   ├─ Primary Tool dropdown
   ├─ Genre dropdown
   └─ Tags text field (comma-separated)
```

### Code Example

```tsx
// UploadForm.tsx handles all metadata
const metadata = {
  style: 'digital',              // videoStyleEnum
  tool: 'procreate',             // videoToolEnum
  genre: 'character_design',     // videoGenreEnum
  tags: ['OC', 'character', 'digital art'],  // string array
};

// Sent to backend:
await api.patch(`/api/videos/${videoId}`, {
  title: 'My Character Design Process',
  description: '...',
  visibility: 'public',
  style: metadata.style,
  tool: metadata.tool,
  genre: metadata.genre,
  tags: metadata.tags,
});
```

---

## 🔍 Discovery System

### Filter by Creative Metadata

#### Art Style
Helps viewers find specific art mediums:
- **digital** — Computer-based art (Procreate, Photoshop, CLIP Studio)
- **traditional** — Pencil, ink, watercolor, physical media
- **mixed_media** — Combines digital and traditional
- **3d** — 3D modeling, rendering, sculpting

#### Primary Tool
Creators can display tool expertise:
- **procreate** — iPad drawing app
- **clip_studio** — Animation/comic tool
- **photoshop** — Raster graphics
- **krita** — Open-source digital painting
- **affinity** — Professional design suite
- **blender** — 3D modeling/animation
- **maya** — Professional 3D software
- **traditional_media** — Physical tools
- **other** — Custom tools

#### Genre
Content type taxonomy:
- **animation** — Animated shorts, explainers
- **comic** — Comic panels, webtoons
- **illustration** — Standalone artwork
- **character_design** — Character sheets, designs
- **concept_art** — Worldbuilding, environment design
- **afro_fantasy** — Afrofuturism, Black fantasy (BlerdArt specific)
- **sci_fi** — Science fiction themes
- **animation_short** — Short-form animation
- **process_video** — Time-lapses, speed art
- **tutorial** — Educational content
- **speedart** — Real-time creation
- **other** — Miscellaneous

#### Tags
User-defined searchable keywords (stored as JSONB array):
```json
["character design", "OC", "digital art", "Procreate"]
```

### Discovery UI

```tsx
import { DiscoveryFilters } from '@/components/DiscoveryFilters';

// In video feed pages:
<DiscoveryFilters
  onFilter={(filters) => {
    // Reloads video feed with:
    // - filters.style
    // - filters.tool
    // - filters.genre
    // - filters.search (text search)
    reloadVideos(filters);
  }}
  loading={isLoadingVideos}
/>
```

### Query Examples

```bash
# Find all digital art videos
GET /api/videos?style=digital

# Find Procreate tutorials
GET /api/videos?tool=procreate&genre=tutorial

# Find afrofuturism videos
GET /api/videos?genre=afro_fantasy

# Combined filters
GET /api/videos?style=digital&genre=character_design&tool=procreate

# Text search
GET /api/videos?search=anime+girl

# Event-specific videos
GET /api/events/blerdcon-2024  # Returns all videos from event
```

---

## 🏷️ Tagging Strategy

### Tag Format
Tags are stored as lowercase strings in a JSONB array:
```json
["character design", "oc", "digital", "procreate"]
```

### Tag Best Practices

**Do:**
- Use lowercase for consistency
- Separate multi-word tags: "character design", not "characterdesign"
- Use existing tags for consistency
- Include: character names, series, techniques, themes
- Comma-separated in UI: `"digital art, character, OC"`

**Don't:**
- Mix case: "Character Design" vs "character design"
- Use camelCase or snake_case for multi-word tags
- Over-tag: 5-10 tags is sufficient
- Use tags that duplicate genre/style/tool

### Common Tag Examples
```
Character Design:     ["character", "sheet", "design", "OC"]
Process Video:        ["tutorial", "procreate", "speedart"]
Animation:            ["animation", "short", "2d"]
Comic:                ["comic", "webtoon", "panel"]
Concept Art:          ["concept", "environment", "worldbuilding"]
Fan Art:              ["fanart", "anime", "manga"]
```

---

## 📊 Metadata Usage Analytics

### Data Available for Analytics

```sql
-- Videos by art style
SELECT style, COUNT(*) as count 
FROM videos 
GROUP BY style 
ORDER BY count DESC;

-- Popular tools
SELECT tool, COUNT(*) as count 
FROM videos 
GROUP BY tool 
ORDER BY count DESC;

-- Most common tags
SELECT 
  JSONB_ARRAY_ELEMENTS_TEXT(tags) as tag,
  COUNT(*) as frequency
FROM videos
WHERE tags IS NOT NULL
GROUP BY tag
ORDER BY frequency DESC
LIMIT 20;

-- Event participation
SELECT 
  e.name, 
  COUNT(*) as video_count,
  SUM(v.view_count) as total_views
FROM events e
LEFT JOIN videos v ON v.event_id = e.id
GROUP BY e.id
ORDER BY video_count DESC;
```

---

## 🛡️ Content Moderation

### Human Created Affirmation

`humanCreatedAffirmed` boolean field (future implementation):
- Creator checks box: "I created this original content"
- Could trigger moderation review
- Protects from generated AI content disputes
- Future: combine with Workers AI to validate authenticity

### Watermark Verification

`watermarkEnabled` boolean field:
- Creator indicates video has watermark
- Used for copyright protection verification
- Could automatically detect watermarks (future AI feature)

---

## 🔗 Event Integration

Videos can be tagged with events:

```tsx
// In upload form (future enhancement):
// If creator is uploading for BlerdCon 2024:
selectedEvent = 'blerdcon-2024'  // Event slug or ID

// API call includes:
{
  title: '...',
  eventId: 'uuid-of-blerdcon-2024',  // Fetched from events table
}
```

### Event Pages

```tsx
// /events page lists all events
// /events/[slug] shows event detail + all videos from event
GET /api/events/blerdcon-2024
// Returns: { event: {...}, videos: [...] }
```

---

## 🧠 Machine Learning Integration (Future)

Phase 2 metadata enables future AI features:

### Auto-Tagging
```
Workers AI could analyze video content and suggest:
- Art style classification
- Tool detection from UI
- Genre inference
- Automatic tag extraction
```

### Content Recommendations
```
"Based on your uploads (digital character design in Procreate),
you might enjoy viewing: [animation], [speedart], [tutorial]"
```

### Trending Discovery
```
-- Find trending combinations
SELECT style, tool, genre, COUNT(*) as frequency
FROM videos
WHERE created_at > NOW() - INTERVAL '7 days'
GROUP BY style, tool, genre
ORDER BY frequency DESC;
```

---

## 🧪 Testing Metadata

### Manual Testing

```bash
# 1. Upload video with all metadata fields
curl -X PATCH http://localhost:8787/api/videos/{videoId} \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Character Design Tutorial",
    "style": "digital",
    "tool": "procreate",
    "genre": "tutorial",
    "tags": ["character", "design", "procreate"],
    "watermarkEnabled": true
  }'

# 2. Query by metadata
curl 'http://localhost:8787/api/videos?style=digital&genre=tutorial'

# 3. Verify stored data
SELECT id, title, style, tool, genre, tags, watermark_enabled 
FROM videos 
WHERE id = 'video-uuid';
```

### Test Cases

- [ ] Upload without metadata → defaults to NULL
- [ ] Query by style → returns only matching videos
- [ ] Query by multiple filters → returns intersection
- [ ] Update metadata → existing data updates correctly
- [ ] Tags with special characters → properly stored
- [ ] Event assignment → video linked to event
- [ ] Watermark toggle → persists across requests

---

## 🚀 Going Live

### Pre-Production Checklist
- [ ] Database migration applied
- [ ] UploadForm shows new fields
- [ ] Discovery filters render on video pages
- [ ] API endpoints tested with metadata
- [ ] Tag search working
- [ ] Event creation working
- [ ] Performance indexes in place

### Monitoring
- [ ] Watch tag cardinality (info on unique tags)
- [ ] Monitor query performance on filtered requests
- [ ] Track adoption of metadata fields
- [ ] Collect user feedback on discovery usefulness

---

## 📚 References

- [PHASE_2_IMPLEMENTATION_SUMMARY.md](./PHASE_2_IMPLEMENTATION_SUMMARY.md)
- [PHASE_2_INTEGRATION_GUIDE.md](./PHASE_2_INTEGRATION_GUIDE.md)
- [Database Schema](../packages/db/src/schema/videos.ts)
- [UploadForm Component](../apps/web/src/components/UploadForm.tsx)
- [Discovery Filters Component](../apps/web/src/components/DiscoveryFilters.tsx)
