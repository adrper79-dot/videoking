# NicheStream for BlerdArt — Updated Documented Plan
**Date:** April 13, 2026  
**Founder:** Adrian  
**Core Vision:** Build a creator-owned, interactive video platform tailored to **BlerdArt** — the vibrant community of Black nerd (Blerd) creators in digital art, indie animation, comics, Afro-fantasy/sci-fi storytelling, illustration, and related creative work.

---

## CRITICAL ADJUSTMENT: Phase Naming & Build Status

**⚠️ IMPORTANT:** The proposed plan as originally stated assumes building from scratch. **This is incorrect.** The current codebase is 86% complete with Phase 1 (generic interactive video platform) already operational.

### Current State (Phase 1 – Complete)
- ✅ Video upload, playback, search, playlists
- ✅ Real-time chat, polls, reactions, watch parties (Durable Objects)
- ✅ Stripe Connect monetization (70–85% creator revenue share via destination charges)
- ✅ Creator dashboard (analytics, upload, earnings)
- ✅ User tier system (Free/Citizen/VIP)
- ✅ Authentication (BetterAuth)
- ✅ Moderation framework (reporting + admin queue)
- ✅ Asset storage infrastructure (R2 + Neon catalog)
- ✅ All TypeScript strict mode; 4 packages compile; 42/49 issues fixed

### What This Plan Actually Describes: Phase 2 (Niche Specialization)
This document describes **Phase 2: BlerdArt Niche Specialization**, which **appends to Phase 1**, not replaces it.

- Phase 2 extends existing infrastructure with BlerdArt-specific features
- No rebuilding of core platform
- Example: Don't rebuild Stripe integration; instead document 80%+ creator payouts for BlerdArt in onboarding

---

## Pain Points Addressed (Detailed Mapping — Adjusted for Phase 1 Reuse)

### 1. **Discovery & Algorithm Suppression**
**Pain:** Creators' work gets buried on mainstream platforms.

**Current (Phase 1):** Owned feed, search, basic tagging.

**Phase 2 Solution (Improvement):** 
- Add video tagging system: creators tag by **style** (digital/traditional/mixed media), **tool** (Procreate/Clip Studio/Photoshop/Krita), and **genre** (animation/comic/illustration/character design/Afro-fantasy/sci-fi/comics/cosplay-design) 
- Extend search endpoint to filter/facet by these dimensions
- Build UI: tag select on upload form + faceted search on feed
- **Effort:** 10 days (extend existing search, add 3 enum columns, UI components)
- **Impact:** Transforms discoverability from title-only to niche-specific; creators find peers

---

### 2. **Monetization Struggles (Low/Delayed Payouts, High Cuts, Subscription Fatigue)**
**Pain:** Difficulty turning art into sustainable income; reliance on likes over sales.

**Current (Phase 1):** Stripe Connect already integrated with 70–85% creator revenue share via destination charges. Earnings dashboard shows views, unlocks, tips by video.

**Phase 2 Solution (Documentation + Trust-Building):**
- Update creator onboarding + TOS to explicitly display: **"You keep 80%+ of all revenue. We keep 15–20%."**
- Create `/docs/creator-payouts.md`: How often payouts are processed, Stripe minimum thresholds, how to withdraw
- Add to `/dashboard/earnings`: Monthly payout schedule, real-time balance
- **Effort:** 2 days (copy + dashboard update)
- **Impact:** Trust-building; creators see they're not being exploited; differentiator vs. YouTube (55% cut) or Twitch (50% cut)

---

### 3. **Lack of Meaningful Community & Constructive Feedback**
**Pain:** Fragmented audiences; toxic or shallow comments; hard to get useful critique.

**Current (Phase 1):** Real-time chat, polls, reactions, watch parties all built. Chat history persisted to Neon asynchronously.

**Phase 2 Solution (Creator Controls + Norms):**
- Extend watch party UI: "Start Critique Circle" button → optionally enables structured mode
  - Critique mode: encourages threaded replies, reaction-only mode during presentation
  - Creator can mute/eject users, lock chat if needed
- Add moderation template options: "Constructive feedback only," "Creative feedback circle," etc.
- Update Community Guidelines (see below) to emphasize restorative-style critique
- **Effort:** 6 days (UI toggles + moderation templates + guidelines doc)
- **Impact:** Turns passive chat into meaningful peer review; reduces toxicity; increases retention

---

### 4. **IP, Plagiarism & Inspiration Theft Concerns (Including AI Pressure)**
**Pain:** Fear of art theft, unauthorized use, and AI-generated competition; communities banning AI art.

**Phase 2 Solution (Multi-Layer Protection):**

**a) Human-Created Affirmation Flag**
- Add `human_created_affirmed` boolean to videos table
- Checkbox on upload form: "I affirm this is human-created" (required for upload)
- Badge on video cards: "Human-Created ✓"
- Community Guidelines explicitly discourage AI-generated content (or require "AI Tool Demo" label)
- **Effort:** 3 days (DB column, form checkbox, badge UI)
- **Impact:** Deters AI art; signals artist community is "human-first"

**b) Watermarking**
- Add `watermark_enabled` boolean to videos table
- Checkbox on upload form: "Add watermark to video (recommended)"
- Integration with Cloudflare Stream's native watermark API (or post-processing via Workers)
- **Effort:** 4 days (DB column, Stream API integration, UI)
- **Impact:** Reduces unauthorized reposting; simple but powerful deterrent

**c) Basic Similarity Checking (Future; Workers AI)**
- On upload: extract video keyframe → run Workers AI image description model
- Hash descriptions; flag if similar to recent uploads (basic plagiarism alert)
- Give creators & mods visibility into potential dupes
- **Effort:** 8 days (AI model integration, hashing, UI)
- **Impact:** Proactive plagiarism detection; trust-building
- **Timeline:** Phase 2 Sprint 3 (optional, lower priority)

**Partially solvable via code; rest via policy and moderation.**

---

### 5. **Time & Production Burdens (Rendering, Backgrounds, Consistency, Promotion Fatigue)**
**Pain:** Solo creators handle everything; heavy technical/promotion workload.

**Phase 2 Solutions:**

**a) Asset Library (Backend Ready; UI Needed)**
- Current: R2 stores assets; Neon schema ready for asset catalog
- Phase 2: Build UI for `/dashboard/assets` (upload) and `/assets` (discovery)
  - Categorized: brushes, backgrounds, templates, tools
  - Taggable by tool (Procreate, Clip Studio, etc.) and license (free/paid/CC-BY, etc.)
  - Download tracking (metrics on popular assets)
- **Effort:** 12 days (backend routes + UI components + search/filter)
- **Impact:** Shared resource ecosystem; reduces solo burden; fosters collaboration

**b) Auto-Captions via Workers AI**
- On video upload complete: invoke Cloudflare Workers AI captioning model
- Generate VTT file; store in R2 under video ID
- Extended video player loads captions automatically
- Dashboard "Re-Caption" button for manual improvements
- Error handling: graceful fallback if AI unavailable
- **Effort:** 8 days (AI integration, VTT storage, player update, error handling)
- **Impact:** Accessibility + reduced production burden; 508 compliance

**c) Auto-Thumbnail Suggestions**
- On upload: extract keyframe → Workers AI image description
- Suggest title based on scene context (future; lower priority)
- **Effort:** 5 days
- **Timeline:** Phase 2 Sprint 3 (optional)

**Cloudflare Stream already handles effortless uploading, auto-encoding, and live streaming (is already operational).**

---

### 6. **Representation & Safe Spaces**
**Pain:** Desire for culturally affirming environments without mainstream judgment or suppression.

**Phase 2 Solutions:**

**a) Creator Verification & BlerdArt Badge**
- Add `blerdart_verified` boolean to users table
- Admin endpoint: `POST /admin/verify-creator` (manual verification)
- Verification flow: self-attestation + manual review by founder/community manager
- Display badge on creator profile: "BlerdArt Verified ✓"
- **Effort:** 5 days (DB column, admin route, profile UI)
- **Impact:** Trust signal; prevents impersonation; builds credibility

**b) Community Guidelines + Restorative Moderation**
- Write comprehensive TOS + Community Guidelines (8 hours writing, 4 hours legal)
- Emphasize: IP protection, human-first collaboration, anti-plagiarism, restorative-style dialogue
- Extend moderation schema: add `resolution_type` enum (auto_remove / warn / 1v1_dialogue / context_added / reinstate)
- Update `/admin/moderation` dashboard: UI to assign resolution type
- Add user notification: "We flagged content. Let's talk about it." instead of silent removal
- **Effort:** 12 days (legal review, schema, dashboard UI, messaging)
- **Impact:** Safe space via policy + culture; reduces toxicity; emphasizes growth over punishment

**c) Hyper-Niche Onboarding**
- Launch invite-only or "application-based" beta; request self-attestation of Blerd identity
- Manual approval for first 100 creators; builds community cohesion
- **Effort:** 2 days (onboarding flow + landing page)
- **Impact:** Curated launch; word-of-mouth in Blerd spaces; organic growth

**Not solvable purely via code, but structurally built into niche and moderation approach.**

---

### 7. **Convention/Event Integration (Artist Alley Disorganization, Traffic, Logistics)**
**Pain:** Physical artist alleys at BlerdCon suffer from split locations, traffic jams, limited visibility; creators want better.

**Phase 2 Solution:**

**a) Virtual Artist Alley Feed**
- Create `events` table (id, name, slug, start_date, end_date)
- Add `videos.event_id` foreign key
- New route: `GET /api/events/{slug}/videos?status=ready` → filtered, curated feed
- New frontend page: `/events/[slug]` → "BlerdCon 2026 Artist Alley"
- Upload form: Add event select dropdown (auto-populate for current events)
- Create Neon record: `events.blerdcon_2026` with Apr–Sep 2026 timeframe
- **Effort:** 10 days (schema, routes, UI)
- **Impact:** Extends physical events online; drives discovery; ties platform to BlerdCon

**b) Live Watch Parties for Events**
- Enable creators to stream live drawing/process sessions during BlerdCon
- Automatically tag as event content
- Integration with Cloudflare Stream live RTMPS/SRT ingestion
- **Effort:** 5 days (integration + event-specific UI)
- **Timeline:** Phase 2 Sprint 2

**Extends physical events online without replacing them (hybrid model).**

---

### 8. **Promotion & Audience Building Fatigue**
**Pain:** Constant external marketing drain; creators need help reaching audiences.

**Phase 2 Solutions:**

**a) Shareable Clip Generator**
- Extend watch party: "Create Share Clip" button
- Extracts 15–30 second segment with creator's choice of audio
- Generates MP4 + OG tags (title, image, description)
- Returns shareable link + embeddable HTML
- **Effort:** 10 days (clip encoding, OG generation, share UI)
- **Impact:** Viral loop; creators promote within social circles

**b) Social Preview Generator**
- On share: auto-generate OG image (video thumbnail + creator name + title)
- Customize text overlay: "Check out [creator]'s latest on NicheStream"
- **Effort:** 5 days (image generation, OG meta tags)
- **Timeline:** Phase 2 Sprint 2

**c) PWA + Installability**
- Manifest.json already configured
- Service worker for offline progress tracking (already implemented)
- Easy mobile sharing via web app icon
- **Effort:** 0 days (already shipped)
- **Impact:** One-click install on mobile; seamless sharing

**Partially solvable via code (tools exist); creators still handle some external reach.**

---

## Tech Stack (Locked for Maximum Leverage) — Reusing Phase 1

- **Cloudflare:** Stream (video/live/clipping *already integrated*), Workers (API/logic *already complete*), Durable Objects (real-time with hibernation *already live*), Pages (Next.js 15+ frontend *already deployed*), Hyperdrive (fast Neon *already operational*), R2 (assets/thumbnails *backend ready*).
- **Neon Postgres:** Users, video metadata, tags (style/tool/genre *adding Phase 2*), earnings, chat/poll history, progress tracking, asset catalog (*backend ready for Phase 2 UI*). Use Drizzle ORM (*already in use*).
- **Stripe:** Subscriptions, one-time unlocks, Connect (Express accounts) for payouts (*all operational*), webhooks (*all verified idempotent*).
- **Claude:** Agent-teaming for rapid Phase 2 builds.

**No new third-party services. Leverage existing Cloudflare stack.**

---

## Core Features (Prioritized by Pain-Point Impact & Implementation Order)

### Phase 1 (Already Shipped — 86% Complete)
- ✅ Auth + creator onboarding
- ✅ Video upload/playback (Stream)
- ✅ Basic feed/search/playlists
- ✅ Stripe Connect + payouts + earnings dashboard
- ✅ Asset upload (R2) basics
- ✅ Real-time chat, polls, reactions, watch parties (Durable Objects)
- ✅ Moderation reporting
- ✅ Creator dashboard

### Phase 2 MVP: BlerdArt Niche Specialization (4 Weeks)

#### Week 1–2: Foundation (Ready-to-Ship)
| Feature | Pain Points Solved | Effort | Ship Date |
|---|---|---|---|
| Creator verification + badge | #6 | 5 days | Day 5 |
| Video tagging (style, tool, genre) | #1, #7 | 10 days | Day 15 |
| Virtual Artist Alley (event integration) | #7 | 10 days | Day 15 |
| Human-created affirmation flag | #4 | 3 days | Day 8 |
| Watermarking on upload | #4 | 4 days | Day 10 |
| Transparent payout docs + TOS | #2, #6 | 2 days | Day 3 |

**By end of Week 2:** 6/8 pain points addressed; ready for closed beta

#### Week 3–4: Community & Creation (Nice-to-Have)
| Feature | Pain Points Solved | Effort | Ship Date |
|---|---|---|---|
| Community Guidelines + restorative moderation | #3, #6 | 12 days | Day 25 |
| Asset library UI (backend ready) | #5 | 12 days | Day 25 |
| Auto-captions via Workers AI | #5 | 8 days | Day 20 |
| Shareable clip generator | #8 | 10 days | Day 25 |
| Critique circle templates | #3 | 6 days | Day 18 |

**By end of Week 4:** All 8 pain points fully addressed; production-ready launch

---

## Database Schema Changes (Phase 2)

```sql
-- Videos table extensions
ALTER TABLE videos ADD COLUMN tags jsonb DEFAULT '[]';
ALTER TABLE videos ADD COLUMN style VARCHAR(50); -- digital, traditional, mixed_media, 3d
ALTER TABLE videos ADD COLUMN tool VARCHAR(100); -- procreate, clip_studio, photoshop, krita, etc.
ALTER TABLE videos ADD COLUMN genre VARCHAR(100); -- animation, comic, illustration, character_design, afro_fantasy, sci_fi, etc.
ALTER TABLE videos ADD COLUMN event_id UUID REFERENCES events(id) ON DELETE SET NULL;
ALTER TABLE videos ADD COLUMN human_created_affirmed BOOLEAN DEFAULT false;
ALTER TABLE videos ADD COLUMN watermark_enabled BOOLEAN DEFAULT false;

-- New events table
CREATE TABLE events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  slug VARCHAR(255) UNIQUE NOT NULL,
  description TEXT,
  start_date TIMESTAMP NOT NULL,
  end_date TIMESTAMP NOT NULL,
  created_at TIMESTAMP DEFAULT now(),
  updated_at TIMESTAMP DEFAULT now()
);
CREATE INDEX idx_events_slug ON events(slug);

-- New assets table (for creator resource sharing)
CREATE TABLE assets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  creator_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  filename VARCHAR(255) NOT NULL,
  category VARCHAR(50) NOT NULL, -- brushes, backgrounds, templates, tools
  tags jsonb DEFAULT '[]',
  r2_path VARCHAR(512) NOT NULL,
  download_count INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT now()
);
CREATE INDEX idx_assets_creator ON assets(creator_id);
CREATE INDEX idx_assets_category ON assets(category);

-- Users table extension
ALTER TABLE users ADD COLUMN blerdart_verified BOOLEAN DEFAULT false;

-- Moderation extensions
ALTER TABLE moderation_reports ADD COLUMN resolution_type VARCHAR(50) DEFAULT 'pending'; -- auto_remove, warn, 1v1_dialogue, context_added, reinstate
```

---

## Operations, Legal & Risk

### Launch Strategy
- **Timeline:** Closed beta (20–50 Blerd creators) in Week 2–3; public launch end of Week 4
- **Recruitment:** Direct outreach via BlerdCon organizers, Instagram Blerd art communities, existing contacts
- **Launch angle:** "BlerdArt-first platform built *by* creators *for* creators. 80%+ revenue share. Real-time community. No algorithm suppression."

### Moderation & Community Standards
- Flagging queue + manual review (as in Phase 1)
- New restorative-style approach: dialogue before removal
- Community Guidelines emphasize: human-created focus, anti-plagiarism, constructive feedback, inclusive culture
- Founder/community manager manual verification for BlerdArt badge

### Legal & Compliance
- **TOS:** Include IP protections, anti-plagiarism, human-created standards, Creator Payout terms
- **Community Guidelines:** Include BlerdArt-specific norms, restorative justice approach, anti-toxicity, feedback culture
- **Compliance:** DMCA process, Section 230 alignment, Georgia/US governing law (as in Phase 1)
- **Stripe:** Connect Express account terms; creator attestation required

### Risk Mitigation
- **AI/Plagiarism Risk:** Human-created flag + watermarking + community guidelines reduce risk
- **Creator Trust Risk:** Transparent payout docs + real-time earnings dashboard build confidence
- **Moderation Risk:** Restorative approach + community guidelines reduce punitive backlash
- **Event Integration Risk:** Start with BlerdCon 2026; if successful, expand to other Blerd conventions/events

---

## Launch & Growth Strategy

### Beta (Weeks 2–3)
- 20–50 handpicked Blerd creators
- Collect feedback on tag system, event integration, moderation approach
- Iterate on Community Guidelines
- Measure: chat volume, asset uploads, creator retention

### Public Launch (Week 4)
- Announcement via BlerdCon networks + social
- Metrics dashboard live: uploads/day, session engagement, creator earnings
- Tie to BlerdCon pre-season buzz (May–July)

### Growth Drivers
1. **Word-of-mouth in Blerd spaces** (Instagram, Twitter, TikTok, Blerd Discord/Reddit)
2. **Embed virality** (shareable clips + OG tags)
3. **Event tie-ins** (BlerdCon artist alley, virtual panels)
4. **Creator-to-creator recruitment** (referral bonus system — *Phase 3*)
5. **Educational content** (founder posts tutorials, hosts watch parties)

### Success Metrics
| Metric | Target | Measured Via |
|---|---|---|
| Creator uploads (beta) | 50+ videos | Stream API |
| Creator uploads (public, Week 4) | 200+ videos | Stream API |
| Avg upload-to-1st-view time | < 2 hours | Analytics event |
| Avg session duration | 20+ minutes | Durable Objects logs |
| Chat messages per session | 15+ | DO logs |
| Creator retention (30-day) | > 60% | Neon queries |
| Avg monthly creator earnings | $300+ (beta), $500+ (public) | Stripe dashboard |
| Citizens (paid tier) | 100+ by end of Week 4 | Neon queries |

---

## Cost & Resource Plan

| Phase | Cost | Effort | Timeline |
|---|---|---|---|
| **Phase 1 (Already Shipped)** | ~$200/month infrastructure (CF, Neon, Stripe) | 42 person-days completed | Done (86%) |
| **Phase 2 (BlerdArt Specialization)** | Same + ~$50/month for Workers AI | 22 person-days | 4 weeks (1 FTE + 1 PT) |
| **Phase 3+ (Growth)** | ~$500/month (increased Scale, CDN, AI) | TBD | Q3 2026 onward |

**Phase 2 team:** 1 FTE engineer (backend + frontend), 1 PT designer/PM, founder for legal/community.

---

## Success Definition

**Phase 2 Complete** when:

✅ All 8 pain points explicitly mapped to working features  
✅ 50+ BlerdArt creators onboarded and verified  
✅ 200+ videos published; tagging + event integration live  
✅ Chat, polls, watch parties, asset sharing actively used  
✅ Average creator earning $500+/month (Citizen tier proving point)  
✅ 60%+ 30-day creator retention  
✅ Community Guidelines enforced; zero major moderation incidents  
✅ TBD ready for full public launch end of Q2 2026

---

## Conclusion

**This plan explicitly addresses all identified pain points** from BlerdArt creators with code-driven mitigations, cultural positioning, and curated launch strategy. It builds on an already-mature Phase 1 foundation, extending (not rebuilding) core infrastructure with niche-specific features and community norms.

**~ 80–90% of pain points are solvable via code.** The remaining 10–20% (representation, safe spaces, cultural affirmation) are solved via policy, moderation, and community-first operations — all supported by the phase structure.

**By May 15, 2026: Production-ready BlerdArt platform, 50–100 active creators, $10K+ in monthly payouts, and a thriving interactive community.**

---

**Owner:** Adrian  
**Last Updated:** April 13, 2026  
**Status:** Ready for Phase 2 execution
