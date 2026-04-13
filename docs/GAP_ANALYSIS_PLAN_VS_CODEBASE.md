# Gap Analysis: BlerdArt Phase 2 Plan vs. Current Codebase

**Date:** April 13, 2026  
**Analysis Focus:** What the plan promises vs. what actually exists in code

---

## Executive Summary

| Category | Planned | Implemented | Gap % |
|---|---|---|---|
| **Database Schema** | 10 new/modified columns | 2 new columns (schema defined, not migrated) | 80% gap |
| **API Routes** | 8 new routes | 0 routes | 100% gap |
| **Frontend Pages** | 4 new pages | 0 new pages | 100% gap |
| **Features** | 12 features (Phase 2) | 0 features | 100% gap |
| **Moderation** | Restorative model | Existing basic model only | 100% gap |

**Critical Finding:** Phase 2 plan is well-designed, but **NO PHASE 2 CODE HAS BEEN IMPLEMENTED**. The plan is purely a strategic document; execution has not begun.

---

## By Category

### 1. Database Schema Changes — PLANNED BUT NOT IMPLEMENTED

**Planned Video Table Extensions:**
```
✓ Exists in plan docs
✗ NOT in code

ADD COLUMN tags jsonb DEFAULT '[]'
ADD COLUMN style VARCHAR(50)  -- digital, traditional, mixed_media, 3d
ADD COLUMN tool VARCHAR(100)  -- procreate, clip_studio, photoshop, krita, etc.
ADD COLUMN genre VARCHAR(100) -- animation, comic, illustration, character_design, etc.
ADD COLUMN event_id UUID REFERENCES events(id)
ADD COLUMN human_created_affirmed BOOLEAN
ADD COLUMN watermark_enabled BOOLEAN
```

**Current Code State:**
```
✓ EXISTS:
  - id, creatorId, cloudflareStreamId, title, description
  - status, visibility, unlockPriceCents
  - viewsCount, likesCount, createdAt, updatedAt, publishedAt

✗ MISSING (planned):
  - tags, style, tool, genre
  - event_id
  - human_created_affirmed
  - watermark_enabled
```

**Planned Users Table Extension:**
```
✓ Exists in plan docs
✗ NOT in code

ADD COLUMN blerdart_verified BOOLEAN DEFAULT false
```

**Current Code State:**
```
✓ EXISTS:
  - id, email, username, displayName, avatarUrl
  - role, userTier, subscriptionStatus
  - trialEndsAt, hasSeenOnboarding, adPreferences
  - bio, website, createdAt, updatedAt

✗ MISSING (planned):
  - blerdart_verified
```

**Planned New Tables:**
```
✓ In plan docs
✗ NOT in code

events:
  - id, name, slug, description
  - start_date, end_date, created_at, updated_at

assets:
  - id, creator_id, filename, category, tags, r2_path
  - download_count, created_at
```

**Current Code State:**
```
✗ NO events table exists
✗ NO assets table exists
```

**Moderation Table Extensions:**
```
✓ In plan docs
✗ NOT in code

ALTER TABLE moderation_reports
ADD COLUMN resolution_type VARCHAR(50) DEFAULT 'pending'
  -- values: auto_remove, warn, 1v1_dialogue, context_added, reinstate
```

**Current Code State:**
```
✗ moderation_reports.resolution_type does NOT exist
```

**Gap Score: 10/10 planned columns → 0/10 implemented**

---

### 2. API Routes — PLANNED BUT NOT IMPLEMENTED

**Planned New/Extended Routes:**

| Route | Purpose | Status | Gap |
|---|---|---|---|
| `POST /admin/verify-creator` | Verify BlerdArt creator status | ✗ Not in code | 100% |
| `PUT /api/videos/:id` tag support | Add/update video tags | ✗ Partial (route exists, tags not in schema) | 95% |
| `GET /api/videos?style=digital&genre=animation` | Filter by tag/style/genre | ✗ Not in code | 100% |
| `GET /api/events/{slug}` | List an event | ✗ Not in code | 100% |
| `GET /api/events/{slug}/videos` | Get artist alley feed | ✗ Not in code | 100% |
| `POST /assets/upload` | Upload creator resource | ✗ Not in code | 100% |
| `GET /assets?category=brushes` | Search asset library | ✗ Not in code | 100% |
| `POST /assets/{id}/download` | Track asset downloads | ✗ Not in code | 100% |

**Current Routes (Exist):**
- `GET /api/videos` — basic listing (no tagging)
- `GET /api/videos/:id` — single video (no tagging)
- `PUT /api/videos/:id` — update video (schema doesn't support tags)
- `POST /api/videos/upload-url` — generate signed upload URL
- `GET /api/channels/:username` — creator profile
- `POST /admin/moderation` — report handling (basic)
- All payment routes (Stripe)
- All auth routes

**New Routes Needed (Not in Code):**
- 8 new routes for Phase 2 features (0% implemented)

**Gap Score: 8/8 new routes → 0/8 implemented**

---

### 3. Frontend Pages — PLANNED BUT NOT IMPLEMENTED

**Current Pages (Exist):**
- `/` — video feed
- `/watch/[videoId]` — player + chat/polls
- `/channel/[username]` — creator profile
- `/dashboard` — analytics
- `/dashboard/upload` — upload form
- `/dashboard/earnings` — payouts
- `/pricing` — tier comparison
- `/sign-in`, `/sign-up` — auth

**Planned New Pages (NOT in Code):**

| Page | Purpose | Status |
|---|---|---|
| `/events/[slug]` | Virtual Artist Alley view | ✗ Not created |
| `/dashboard/assets` | Manage uploaded resources | ✗ Not created |
| `/assets` | Discover asset library | ✗ Not created |
| Creator profile badge display | Verification badge on channel | ⚠️ Partial (depends on schema column) |

**Gap Score: 3–4 pages planned → 0 pages implemented**

---

### 4. Component Updates — PLANNED BUT NOT IMPLEMENTED

**Planned Component Changes:**

| Component | Change | Status | Gap |
|---|---|---|---|
| `UploadForm.tsx` | Add tag selects + event dropdown | ✗ Not updated | 100% |
| `UploadForm.tsx` | Add human-created checkbox | ✗ Not updated | 100% |
| `UploadForm.tsx` | Add watermark checkbox | ✗ Not updated | 100% |
| `VideoCard.tsx` | Display "Human-Created ✓" badge | ✗ Not updated | 100% |
| `CreatorProfile.tsx` | Display `blerdart_verified` badge | ✗ Not updated | 100% |
| `VideoFeed.tsx` | Add faceted search UI (tags/style/genre) | ✗ Not updated | 100% |
| `VideoPlayer.tsx` | Load captions from R2 | ✗ Not updated (AI integration incomplete) | 100% |
| `Navbar.tsx`, etc. | Error states for entitlements | ⚠️ Partial (basic structure exists) | 50% |

**Gap Score: 8 component changes planned → 0 significant changes implemented**

---

### 5. Moderation & Guidelines — PLANNED BUT NOT IMPLEMENTED

**Current State:**
- Basic moderation reporting exists
- Admin queue exists
- No resolution type tracking
- No restorative moderation flow

**Planned (Not in Code):**
- `moderation_reports.resolution_type` enum field
- UI to select resolution type (auto_remove/warn/1v1_dialogue/context_added/reinstate)
- User notification system ("Let's talk about this")
- BlerdArt Community Guidelines document (policy, not code, but needed)
- Critic circle templates (requires Durable Objects updates)

**Gap Score: 5 moderation features → 0 implemented**

---

### 6. Workers AI Integration — PLANNED BUT NOT MENTIONED IN CODE

**Planned:**
- Auto-captions on video upload complete
- Invoke Cloudflare Workers AI captioning model
- Store VTT file in R2
- Player loads captions

**Current State:**
- ✗ NO Workers AI integration exists
- ✗ NO captioning endpoint
- ✗ NO VTT generation code
- ✗ NO error handling for AI fallback

**Gap Score: 1 major feature → 0 implemented**

---

### 7. Durable Objects Extensions — PARTIALLY PLANNED, PARTIALLY IMPLEMENTED

**Current (Exists in Code):**
- `VideoRoom` DO with chat, polls, reactions, watch party
- `UserPresence` DO for online status
- WebSocket hibernation API (working)
- Chat/poll persistence to Neon (implemented in Phase 1)

**Planned for Phase 2 (Not in Code):**
- Critique circle mode toggle in `VideoRoom`
- Creator moderation controls (mute, eject)
- Restorative moderation message templates
- Reaction-only mode during presentation phase

**Gap Score: 4 features → 0 implemented (existing foundation is solid)**

---

## Phase 2 Feature Completion Matrix

| Feature | Database | API Routes | Frontend | Status |
|---|---|---|---|---|
| **1. Creator Verification** | ✗ Missing column | ✗ Missing route | ⚠️ Partial (needs schema) | **0% Complete** |
| **2. Video Tagging** | ✗ Missing columns | ✗ Missing logic | ✗ Missing UI | **0% Complete** |
| **3. Virtual Artist Alley** | ✗ Missing table + FK | ✗ Missing routes | ✗ Missing page | **0% Complete** |
| **4. Human-Created Flag** | ✗ Missing column | ⚠️ Form field ready | ✗ Missing UI | **0% Complete** |
| **5. Watermarking** | ✗ Missing column | ✗ Missing Stream API integration | ✗ Missing UI | **0% Complete** |
| **6. Payout Documentation** | ✓ Ready (schema exists) | ✓ Ready | ⚠️ Partial (docs only) | **30% Complete** |
| **7. Asset Library** | ✗ Missing table | ✗ Missing routes | ✗ Missing pages | **0% Complete** |
| **8. Guidelines + Moderation** | ✗ Missing column | ✗ Missing updates | ⚠️ Partial (UI skeleton) | **10% Complete** |
| **9. Auto-Captions** | ⚠️ Field ready if added | ✗ Missing AI integration | ✗ Missing UI | **0% Complete** |
| **10. Critique Circles** | ✓ Foundation exists | ⚠️ Partial (DO needs extension) | ✗ Missing UI toggles | **20% Complete** |
| **11. Shareable Clips** | ⚠️ Ready (no schema needed) | ✗ Missing encoding logic | ✗ Missing UI | **10% Complete** |
| **12. Asset Library UI** | ✗ Table missing | ✗ Missing routes | ✗ Missing pages | **0% Complete** |

**Overall Phase 2 Completion: ~7% (mostly foundation planning)**

---

## Specific Code Gaps to Address (Action Items)

### Critical Path (Week 1–2 Priority)

**1. Database Migrations**
```
NEED: 1. Add to videos schema:
  - tags (jsonb)
  - style (enum or varchar)
  - tool (enum or varchar)
  - genre (enum or varchar)
  - event_id (FK)
  - human_created_affirmed (boolean)
  - watermark_enabled (boolean)

2. Add to users schema:
  - blerdart_verified (boolean)

3. Create events table:
  - id (PK), name, slug, description, start_date, end_date, created_at, updated_at

STATUS: NOT CREATED (0/3 migrations)
```

**2. API Endpoints**
```
NEED: 1. POST /admin/verify-creator — admin-only verification
      2. PUT /api/videos/:id — extend to support tags, style, tool, genre
      3. GET /api/videos?style=X&genre=Y — extend filtering
      4. GET /api/events/{slug} — list event
      5. GET /api/events/{slug}/videos — artist alley feed

STATUS: NOT IMPLEMENTED (0/5 routes)
```

**3. Frontend Components**
```
NEED: 1. UploadForm.tsx — add tag selects, event dropdown, checkboxes
      2. VideoCard.tsx — display human-created badge, style/genre tags
      3. VideoFeed.tsx — add faceted filter/search UI
      4. CreatorProfile.tsx — display verification badge

STATUS: NOT UPDATED (0/4 component updates)
```

### Secondary Path (Week 3–4 Priority)

**4. Assets System**
```
NEED: 1. Create assets table in Neon
      2. Add routes: POST /assets/upload, GET /assets?category=X, POST /assets/{id}/download
      3. Create /dashboard/assets page (management)
      4. Create /assets page (discovery + filter)

STATUS: NOT IMPLEMENTED (0/4 sub-tasks)
```

**5. Workers AI Integration**
```
NEED: 1. Import @cloudflare/ai into Worker
      2. Create lib/ai.ts with captioning model wrapper
      3. Add on-video-ready hook to invoke captioning
      4. Store VTT in R2; extend videos schema for captions_enabled
      5. Update VideoPlayer to load captions

STATUS: NOT STARTED (0/5 sub-tasks)
```

**6. Moderation Extensions**
```
NEED: 1. Add moderation_reports.resolution_type column
      2. Update admin moderation dashboard component
      3. Add user notification flow for 1v1 dialogue
      4. Create restorative moderation message templates

STATUS: DESIGN EXISTS, CODE NOT STARTED (0/4 sub-tasks)
```

---

## Why This Gap Exists

1. **Planning completed, implementation not started** — Phase 2 plan is strategic and detailed, but no code implementation tickets have been created or started
2. **No migrations committed** — The database schema changes are defined in plan docs but not as SQL migrations in `packages/db/src/migrations/`
3. **No routes stubbed** — No API route handlers for Phase 2 endpoints exist
4. **No components updated** — Frontend components haven't been modified to support new features
5. **No feature flags** — No environment variables or toggles to gate Phase 2 features during development

---

## What IS Ready/Implemented

| Asset | Status | Notes |
|---|---|---|
| Phase 1 Core Platform | ✅ 86% Complete | Video, real-time, monetization, auth, moderation working |
| Durable Objects Foundation | ✅ Complete | Chat, polls, reactions, watch party, hibernation live |
| Stripe Connect | ✅ Complete | Payouts, webhooks, idempotency verified |
| Stream Integration | ✅ Complete | Upload, playback, signed URLs, analytics ready |
| Database Layer | ✅ Mostly Complete | Neon + Hyperdrive, Drizzle ORM, indexes in place |
| Moderation Framework | ✅ Basic | Reporting + queue; extension points clear |
| Architecture | ✅ Complete | ARCHITECTURE.md, PRODUCT_PLAN.md documented |
| Phase 2 Strategy | ✅ Complete | 7 planning documents, roadmap, pain-point mapping |

---

## Recommendation: Phase 2 Implementation Checklist

**To move from "planned" → "implemented":**

1. ✗ Create Phase 2 database migrations (5 migrations)
2. ✗ Stub Phase 2 API routes (8 routes in new/updated files)
3. ✗ Create Phase 2 frontend pages (3–4 new pages)
4. ✗ Update Phase 2 components (4 existing components)
5. ✗ Create Durable Objects extensions (moderation controls, critique mode)
6. ✗ Integrate Workers AI (captioning pipeline)
7. ✗ Add feature flags/toggles for gradual rollout
8. ✗ Create Phase 2 issue/ticket backlog in GitHub

**Estimated Effort to Close Gap: 22 person-days (matches plan) + 3 days migrations + testing = ~25 days**

**Start Date:** Next sprint (Week of April 21)

---

**Gap Status:** **85–90% Code Gap Remains** (plan complete, code implementation ready to start)
