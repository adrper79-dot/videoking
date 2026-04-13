# NicheStream Phase 2: BlerdArt Niche Specialization

**Date:** April 13, 2026 | **Status:** Roadmap (Ready to Execute)

---

## Phase 2 Overview

Phase 1 (86% complete) built the generic interactive video platform. Phase 2 specializes it for **BlerdArt**, mapping all 8 creator pain points into a 4-week niche-entry roadmap.

**Principle:** Extend, don't rebuild. All infrastructure (video, monetization, real-time, auth, moderation) already exists. Phase 2 adds BlerdArt-specific features via schema extensions + UI layers.

---

## Pain Point → Feature Mapping (Phase 2 Roadmap)

| Pain Point | Feature | DB Changes | API Changes | Frontend Changes | Week | Priority |
|---|---|---|---|---|---|---|
| #1: Discovery Suppression | Video tagging (style, tool, genre) + filtered discovery | `videos.tags`, `videos.style`, `videos.tool`, `videos.genre` | `GET /api/videos?style=digital&genre=animation` | Tag select on upload; faceted search UI | 1–2 | ⭐⭐⭐ |
| #1, #7: Convention Integration | Virtual Artist Alley feed + event tagging | `videos.event_id`, new `events` table | `GET /api/events/{slug}/videos` | `/events/[slug]` page with artist alley view | 1–2 | ⭐⭐⭐ |
| #2: Monetization Transparency | Transparent dashboard (already built; just document) | None | None | Update copy in `/dashboard/earnings` | 1 | ⭐⭐⭐ |
| #3: Community & Feedback | Critique circle templates (extend watch party) | `video_rooms.critique_mode_enabled` (jsonb flag) | `POST /api/watch-parties/{id}/critique-circle` | "Start critique circle" button in watch party UI | 3 | ⭐⭐ |
| #4: IP & AI Concerns | Human-created affirmation flag + watermarking | `videos.human_created_affirmed`, `videos.watermark_enabled` | Extend upload endpoint; integrate Stream watermark API | Checkbox on upload form; badge on video cards | 1 | ⭐⭐⭐ |
| #5: Production Burden (Assets) | Asset library UI (backend ready) | New `assets` table; extend Neon asset catalog | `POST /assets/upload`, `GET /assets?category=brushes` | `/dashboard/assets`, `/assets` discovery page | 3–4 | ⭐⭐ |
| #5: Production Burden (Captions) | Auto-captions via Workers AI | `videos.captions_enabled` | On-video-ready: invoke Workers AI captioning | "AI Caption This" button in dashboard | 3–4 | ⭐⭐ |
| #6: Safe Spaces | Creator verification badge + BlerdArt guidelines | `users.blerdart_verified` | `POST /admin/verify-creator`, extend moderation | Badge on creator profiles; updated TOS/Guidelines | 1–2 | ⭐⭐⭐ |
| #6: Community Norms | Community Guidelines + restorative moderation | `moderation_reports.resolution_type` (enum) | Extend `/admin/moderation` to track resolution types | Add "1v1 dialogue" option for moderators | 3–4 | ⭐⭐ |
| #8: Promotion Fatigue | Social share generator (extend existing UI) | None | `/api/videos/{id}/share-preview` | Share preview generator on video detail page | 4 | ⭐ |

---

## Week 1–2: Foundation (Tier 1 — Ship-Ready)

### 1. BlerdArt Vertical Identity & Creator Verification

**What:** Position as BlerdArt-specific platform. Add creator verification badge.

**Work:**
- Update homepage copy, TOS, Community Guidelines (4 hours legal review)
- Add `users.blerdart_verified` boolean to schema (1 migration)
- New admin route: `POST /admin/verify-creator` (2 hours)
- Add creator profile badge UI (3 hours)

**Files to change:**
- `docs/` → Update platform positioning
- `packages/db/src/schema/users.ts` → Add `blerdart_verified`
- `apps/worker/src/routes/admin.ts` → Add verification endpoint
- `apps/web/src/components/CreatorProfile.tsx` → Display badge

**Ship date:** Day 3–5

---

### 2. Video Tagging System (Style, Tool, Genre)

**What:** Creators tag videos by style (digital/traditional/mixed), tool (Procreate/Clip Studio/etc.), genre (animation/comic/illustration/Afro-fantasy/etc.). Search is filterable.

**Work:**
- Add `tags` (jsonb), `style`, `tool`, `genre` to videos table (1 migration)
- Extend `PUT /api/videos/{id}` to accept tags (3 hours)
- Extend `GET /api/videos` with filter params: `?style=digital&genre=animation` (4 hours, use WHERE clause + Neon queries)
- Frontend: Add tag select UI to upload form (6 hours React components)
- Frontend: Add faceted search UI to feed (8 hours)

**Files to change:**
- `packages/db/src/schema/videos.ts` → Add columns
- `packages/db/src/migrations/` → New migration file
- `apps/worker/src/routes/videos.ts` → Extend update + list endpoints
- `apps/web/src/app/upload/page.tsx` → Add tag selects
- `apps/web/src/components/VideoFeed.tsx` → Add faceted filter UI

**Ship date:** Day 8–15

---

### 3. Virtual Artist Alley Feed (Event Tagging)

**What:** Tie platform to BlerdCon. New `/events/[slug]` page shows all videos tagged with that event.

**Work:**
- Create `events` table (id, name, slug, start_date, end_date) (1 migration)
- Add `videos.event_id` FK (1 migration)
- New route: `GET /api/events/{slug}` → return event metadata (2 hours)
- New route: `GET /api/events/{slug}/videos?status=ready` → filtered feed (2 hours)
- New Neon records: Create BlerdCon 2026 event (1 hour via SQL or admin UI)
- Frontend: New `/events/[slug]` page (8 hours)
- Upload form: Add event select dropdown (3 hours)

**Files to change:**
- `packages/db/src/schema/` → New events table
- `packages/db/src/migrations/` → New migration file
- `apps/worker/src/routes/events.ts` (new file)
- `apps/web/src/app/events/[slug]/page.tsx` (new file)
- `apps/web/src/components/UploadForm.tsx` → Add event select

**Ship date:** Day 12–18

---

### 4. Human-Created Affirmation + Watermarking

**What:** Checkbox on upload: "I affirm this is human-created." Optional watermark. Deters AI art, IP theft.

**Work:**
- Add `videos.human_created_affirmed` boolean (1 migration)
- Add `videos.watermark_enabled` boolean (1 migration)
- Extend upload form: 2 checkboxes (2 hours)
- Extend `POST /api/stream/upload-url` to pass watermark flag to Stream API (3 hours)
- Add badge "Human-Created ✓" to video cards if affirmed (2 hours)
- Update TOS: "By uploading, you affirm this is human-created. AI art must be labeled as such."

**Files to change:**
- `packages/db/src/schema/videos.ts` → Add booleans
- `packages/db/src/migrations/` → New migration file
- `apps/worker/src/routes/videos.ts` → Extend upload-url endpoint
- `apps/web/src/components/UploadForm.tsx` → Add checkboxes
- `apps/web/src/components/VideoCard.tsx` → Add badge

**Ship date:** Day 5–10

---

## Week 3–4: Community & Creation (Tier 2 — Nice-to-Have)

### 5. Community Guidelines + Restorative Moderation

**What:** BlerdArt-specific TOS. Moderation emphasizes dialogue over removal.

**Work:**
- Write comprehensive Community Guidelines (8 hours, legal review 4 hours)
- Extend `moderation_reports` table: add `resolution_type` (enum: `auto_remove`, `warn`, `1v1_dialogue`, `context_added`, `reinstate`) (1 migration)
- Extend admin moderation dashboard: UI to select resolution type (6 hours)
- Add user notification system: "We flagged content. Let's talk." (4 hours)

**Files to change:**
- `docs/COMMUNITY_GUIDELINES.md` (new file)
- `packages/db/src/schema/moderation.ts` → Add resolution_type
- `packages/db/src/migrations/` → New migration file
- `apps/worker/src/routes/moderation.ts` → Extend resolution flow
- `apps/web/src/components/AdminModeration.tsx` (new) → Dashboard UI

**Ship date:** Day 20–25

---

### 6. Asset Library UI

**What:** Creators upload reusable brushes, backgrounds, templates. Searchable by category + tags. Organized by tool (Procreate, Clip Studio, etc.).

**Work:**
- Create `assets` table: (id, creator_id, filename, category, tags, r2_path, download_count) (1 migration)
- New route: `POST /assets/upload` (validate file, store in R2, catalog in Neon) (6 hours)
- New route: `GET /assets?category=brushes&tool=procreate&sort=popular` (4 hours)
- New route: `POST /assets/{id}/download` (track downloads) (2 hours)
- Frontend: `/dashboard/assets` page (manage + upload) (8 hours)
- Frontend: `/assets` discovery page (browse, filter, download) (10 hours)

**Files to change:**
- `packages/db/src/schema/assets.ts` (new file)
- `packages/db/src/migrations/` → New migration file
- `apps/worker/src/routes/assets.ts` (new file)
- `apps/worker/src/lib/r2.ts` → Add asset upload method
- `apps/web/src/app/dashboard/assets/page.tsx` (new)
- `apps/web/src/app/assets/page.tsx` (new)
- `apps/web/src/components/AssetCard.tsx` (new)

**Ship date:** Day 22–28

---

### 7. Auto-Captions via Workers AI

**What:** On video upload complete, Cloudflare Workers AI generates captions (VTT file). Stored in R2. Playable in video player.

**Work:**
- Integrate `@cloudflare/ai` into Worker (2 hours)
- Add Durable Object or cron trigger: on video status = ready, invoke AI captioning model (6 hours)
- Store VTT output in R2 under video ID (2 hours)
- Extend Stream iframe player to load captions from R2 URL (3 hours)
- Add "Re-caption" button in dashboard (2 hours)
- Handle AI fallback gracefully (no captions if model unavailable) (2 hours)

**Files to change:**
- `apps/worker/src/lib/ai.ts` (new file) → AI model wrappers
- `apps/worker/src/routes/videos.ts` → On-ready hook for captioning
- `apps/worker/src/lib/r2.ts` → Add VTT storage method
- `apps/web/src/components/VideoPlayer.tsx` → Load and display captions
- `apps/web/src/app/dashboard/page.tsx` → "Re-caption" button

**Ship date:** Day 20–25

---

## Summary: Phase 2 Execution Plan

| Week | Deliverables | Pain Points Addressed | Effort (person-days) |
|---|---|---|---|
| **Week 1** | Identity, verification, human-created flag, watermarking | #1, #4, #6 | 4 |
| **Week 2** | Video tagging, virtual artist alley | #1, #7 | 6 |
| **Week 3** | Asset library, auto-captions, community guidelines | #5, #6 | 8 |
| **Week 4** | Polish, testing, launch prep | All | 4 |
| **Total** | — | All 8 pain points | 22 person-days (~4 weeks, 1 FTE + 1 PT) |

---

## Success Metrics (Post-Launch)

| Pain Point | Metric | Target | Measured Via |
|---|---|---|---|
| #1 Discovery | Avg time to 1st view after upload | < 2 hours | Analytics event |
| #2 Monetization | Avg monthly creator earnings | $500+ | Stripe dashboard |
| #3 Community | Avg chat messages per watch session | 20+ | Durable Objects logs |
| #4 IP Safety | % videos human-created affirmed | > 70% | Query: `COUNT(*) WHERE human_created_affirmed=true` |
| #5 Production | % creators using asset library | > 30% | DAU on assets page |
| #6 Safe Spaces | % flagged content resolved via dialogue | > 60% | Moderation dashboard |
| #7 Events | BlerdCon 2026 uploads | 100+ | Event page view counts |
| #8 Promotion | % shares via platform tool | > 40% | Share preview clicks |

---

## Launch Timeline

- **Week 1 (Apr 14–20):** Identity + verification + flags shipped
- **Week 2 (Apr 21–27):** Tagging + artist alley shipped; closed beta begins with 20 Blerd creators
- **Week 3 (Apr 28–May 4):** Community guidelines + asset library shipped
- **Week 4 (May 5–11):** Polish + testing; open for public sign-up

**Public launch: May 15, 2026 (timed to BlerdCon pre-season buzz)**

---

**Owner:** Adrian  
**Status:** Ready for implementation  
**Next:** Green-light Week 1 execution; assign roles (Product, Backend, Frontend, Legal)
