# NicheStream — Product & Monetization Plan

> **Version:** 2.0 (includes hybrid freemium addendum)  
> **Last updated:** April 2026  
> **Status:** Phase 1 built, Phase 2 in progress

---

## 1. Vision

NicheStream is a **hyper-niche interactive video platform** positioned at the intersection of three things no major platform does well simultaneously:

1. **Authentic community** — real-time interaction that turns passive viewers into participants
2. **Fair creator economics** — instant, transparent payouts with no algorithm or demonetization risk
3. **Accessible pricing** — free-by-default with a $1/month "Citizen" tier that feels like joining a club, not buying a subscription

The target is a single passionate vertical. General-audience competition with YouTube or Tubi is not the goal. Owning a niche deeply is.

---

## 2. Market Context (2026)

| Signal | Implication for NicheStream |
|---|---|
| Creator economy valued at ~$235B, 22.5% CAGR | Demand for creator-first platforms is structural, not cyclical |
| 74% of viewers have canceled a paid streaming service over price | Low-friction $1 entry outperforms high-price "premium" positioning |
| 76% prefer free-with-ads over paid for general content | Free tier with light ads is viable for casual viewers; paid is for community members |
| Live streaming market ~$97B, 27% CAGR | Real-time interactivity (the Citizen moat) is growing faster than VOD |
| YouTube creators citing algorithm opacity, low RPM, demonetization | There is creator-pull toward platforms that pay fairly and predictably |
| AI-generated content flooding feeds | Authentic, human-curated niche spaces become more valuable, not less |

**Biggest market gaps NicheStream exploits:**

- No dominant "interactive niche YouTube" for bootstrapped creators
- Platforms that do interactivity (Twitch, YouTube Live) don't do transparent payouts or fair splits
- Platforms that do fair payouts (Substack, Patreon) don't do video or real-time community
- Hybrid ad + subscription monetization is the industry-proven model but absent in most indie/niche tools

---

## 3. Strategic Positioning

```
            ┌────────────────────────────────────────────────────┐
            │                  INTERACTIVITY                      │
            │              (chat, polls, parties)                 │
            │                                                     │
            │          ◉ NicheStream                             │
            │                                                     │
            │  Twitch ●                                          │
            │                                                     │
CREATOR     ├────────────────────────────────────────────────────┤   CREATOR
HOSTILE     │                                            ● YouTube│   FRIENDLY
            │           ● Tubi         Nebula ●          ● Vimeo │
            │                                                     │
            │              (passive viewing)                      │
            └────────────────────────────────────────────────────┘
                              PASSIVE
```

NicheStream occupies the quadrant that is currently empty: high interactivity + creator-friendly economics.

---

## 4. Tier Model

### Free Tier (Guest / Non-Citizen)

Anyone can create an account and access:
- Full public video library (browse, search, watch)
- Basic discovery (feed, channels, playlists)
- Read-only or rate-limited chat (10-second cooldown between messages)
- Reaction counts (view only; emoji reactions limited)
- Standard video quality
- Light, non-intrusive ads (pre-roll, sponsored units)

**Goal:** Maximum acquisition and organic growth. No hard barrier. No email wall on browse.

### Citizen Tier — $1/month or $10/year

The "become a Citizen" entry. Positioned as joining a community, not subscribing to a product.

Unlocks:
- **Ad-free** (or near-ad-free) viewing
- **Full real-time interactivity**
  - Unlimited chat with Citizen badge and priority queue
  - Advanced polls (enabled creators can post; all Citizens can vote)
  - Synced watch parties (host or join)
  - Full emoji reactions with live counts
- Unlimited video access
- Personalized recommendations
- PWA offline progress sync
- 14-day free trial on first sign-up (auto-activated on account creation)

**Goal:** Predictable recurring revenue + deep retention via community identity.

### VIP Citizen Tier — $5–9/month (planned, not yet built)

For super-fans. Everything in Citizen, plus:
- Exclusive content (creator AMAs, private shows)
- Private room creation
- Faster chat rate limit (0.5-second cooldown vs. 1s for Citizen)
- Downloads / offline export
- Priority support
- Custom VIP badge

**Goal:** Lift ARPU from the most engaged 5–10% of the audience.

---

## 5. Revenue Model

### Revenue sources

| Source | Who pays | Revenue direction |
|---|---|---|
| Free-tier ad impressions | Advertisers | Platform → creator attribution |
| Citizen subscriptions ($1/mo or $10/yr) | Viewers | Platform, then creator share |
| VIP subscriptions ($5–9/mo) | Viewers | Platform, then creator share |
| One-time video unlocks | Viewers | Platform + direct creator |

### Revenue flow (current implementation)

```
Viewer pays $1/month via Stripe Checkout
  → Stripe Billing creates subscription
  → Webhook: customer.subscription.created
  → Worker updates users.user_tier = 'citizen', subscription_status = 'active'
  → Monthly earnings allocation:
      - Gross: $1.00 per subscriber
      - Stripe fee: ~$0.30 + 2.9% ≈ $0.33
      - Net to platform + creators: ~$0.67
      - Creator share (60-70%): attributed by engagement weight
      - Platform share (30-40%): operations + growth reinvestment
  → Stripe Connect Transfer to creator's bank account
```

### Revenue flow (planned — ad tier)

```
Free user watches video
  → VAST tag served in Stream player
  → Ad impression recorded in ad_events table
  → Creator credited: ad_revenue × engagement_share
  → Monthly payout rollup includes ad attribution
```

### Platform fee

`PLATFORM_FEE_PERCENT` environment variable (default: 20%). Deducted via Stripe Connect `application_fee_amount` on destination charges. Adjust per business needs as scale grows.

---

## 6. Creator Economics

### Onboarding

Creators go through Stripe Connect Express onboarding (`POST /api/stripe/connect/onboard`). Stripe handles:
- Bank account collection
- KYC / identity verification
- Tax form collection (1099-K for US creators)
- Global bank payouts (40+ countries)

No manual payout processing required on the platform side.

### Earnings attribution (current)

Earnings are recorded per `(creator_id, video_id, type)` in the `earnings` table. Each record captures:
- `gross_amount_cents` — viewer payment
- `platform_fee_cents` — platform cut
- `net_amount_cents` — creator's share

### Earnings attribution (target model — pending implementation)

Platform-level recuring membership revenue should be distributed across all contributing creators based on a weighted engagement score per payout period:

```
creator_share_pct = creator_video_weighted_time / total_platform_weighted_time

creator_net = (total_subscription_revenue × creator_share_pct) × (1 - PLATFORM_FEE_PERCENT)
```

Where `weighted_time` = watch_minutes + (chat_messages × 2) + (poll_votes × 1.5)

This model incentivizes creators to produce interactive content and is fully calculable from Neon data.

### Payout schedule

- Default: monthly via Stripe's automatic payout schedule
- Optional: weekly or on-demand via Stripe Connect dashboard
- Instant payouts available (extra Stripe fee; can be offered as a VIP creator perk)

---

## 7. Retention & Conversion Mechanics

| Mechanism | Status | Notes |
|---|---|---|
| 14-day Citizen trial on sign-up | ✓ Built | Auto-activated via entitlements endpoint |
| Annual billing ($10/year) | ✓ Built (Stripe price exists) | ~17% discount vs. monthly |
| In-app upgrade nudges | ✓ Built | Shown when free users hit chat limits, watch party gate, poll gate |
| Trial expiry countdown UI | ✗ Planned | Show "X days left" banner as trial approaches expiry |
| Post-trial downgrade messaging | ✗ Planned | "Your trial ended — keep the community for $1" |
| Churn-tracking analytics | ✗ Planned | Track free→paid, paid→canceled cohorts in Neon |
| Referral system | ✗ Planned | "Invite a friend, both get 7 extra trial days" |
| Community events | ✗ Planned | Creator-hosted watch parties as conversion moments |

---

## 8. Ad Tech Roadmap

### Phase 1 (current target — not yet implemented)

- Integrate VAST tags in the Cloudflare Stream player iframe for `adFree = false` sessions
- Partner with one programmatic ad network (e.g., Google IMA SDK or lightweight alternative)
- Track impression events in a new `ad_events` table
- Exclude all users with `effectiveTier ∈ {citizen, vip}` from ad load

### Phase 2

- Worker-managed frequency capping (store last-ad-served timestamp in Neon or KV)
- Sponsored interactive units (branded polls, sponsored reactions)
- Higher CPM through niche audience data (privacy-compliant; user controls in `ad_preferences` JSONB column)

### Phase 3

- Server-side ad insertion optimizations for higher fill rates
- Direct advertiser relationships (niche audiences command $15–35 CPM)
- Potentially build a self-serve ad booking UI for niche advertisers

---

## 9. Financial Model (Indicative)

### Unit economics at $1/month Citizen tier

| Item | Per subscriber/month |
|---|---|
| Gross revenue | $1.00 |
| Stripe processing fee | ~$0.33 |
| Net to platform+creators | ~$0.67 |
| Creator share (65%) | ~$0.44 |
| Platform margin | ~$0.23 |
| Cloudflare Stream delivery (avg) | ~$0.10–$0.25 |
| Net platform after costs | ~$0.00–$0.13 |

**Implication:** The $1 tier is designed for acquisition and retention, not margin. Margin comes from:
- Free-tier ad revenue (high volume × moderate CPM)
- VIP tier ARPU lift
- Platform fee on video unlocks
- Scale (fixed costs don't grow proportionally)

### Break-even sensitivity

| Monthly Active Citizens | Monthly gross | Monthly platform net (est.) |
|---|---|---|
| 1,000 | $1,000 | Covers basic infrastructure |
| 5,000 | $5,000 | Covers ads infra + part-time moderation |
| 20,000 | $20,000 | Meaningful one-person business |
| 50,000 | $50,000 | Small team viable |

These numbers improve significantly with VIP tier and ad revenue layered in.

### Hybrid ARPU target (steady state)

```
Blended ARPU = (subscription_revenue + ad_revenue) / total_MAU

Target: $0.50–$2.00 blended ARPU at scale
(Tubi achieves ~$9–11 ARPU via pure ads at 100M MAU scale;
 a niche platform with engaged users can exceed this with hybrid)
```

---

## 10. Phased Build Plan

### Phase 1 — Core Platform (✓ Complete)

- [x] User accounts + auth (BetterAuth)
- [x] Video upload → Cloudflare Stream
- [x] Video feed, search, channels, playlists
- [x] Custom video player with signed URL access control
- [x] Stripe subscriptions (Citizen monthly + annual)
- [x] Stripe Connect creator onboarding
- [x] Basic creator dashboard (earnings, analytics)
- [x] Tier model + entitlements (Free / Citizen / VIP schema)
- [x] Stripe webhook → entitlement update pipeline
- [x] Trial activation on sign-up
- [x] Pricing page + upgrade CTAs
- [x] Basic moderation queue

### Phase 2 — Interactivity Moat (✓ Complete)

- [x] Real-time chat (VideoRoom Durable Object, WebSocket hibernation)
- [x] Live polls with real-time vote tallying
- [x] Emoji reactions with live counts
- [x] Watch party (host-controlled synced playback)
- [x] Tier-aware privileges in the DO (rate limits, badge, poll/party gating)
- [x] Chat history persistence across DO hibernation

### Phase 3 — Monetization Completion (In Progress)

- [ ] Platform-level subscription billing (decouple from creator-specific subscriptions)
- [ ] VAST ad insertion for free-tier users
- [ ] Ad event tracking table + creator attribution
- [ ] Trial expiry countdown + post-downgrade messaging
- [ ] Conversion & churn analytics dashboard
- [ ] Creator earnings breakdown by revenue source + payer tier

### Phase 4 — Polish & Growth (Planned)

- [ ] VIP Citizen tier (pricing, perks, checkout)
- [ ] Referral / invite system
- [ ] Email notifications (payout milestones, new videos from followed creators, watch party invites)
- [ ] AI enhancements (auto-captions, smart thumbnails, feed personalization)
- [ ] Mobile PWA polish + push notifications
- [ ] Self-serve ad booking for niche advertisers

---

## 11. Competitive Differentiation Summary

| Dimension | YouTube | Tubi | Twitch | NicheStream |
|---|---|---|---|---|
| Video hosting | ✓ | ✓ | ✓ | ✓ (Cloudflare Stream) |
| Real-time interactivity | Basic | None | Strong (live only) | **Strong (VOD + live)** |
| Creator payout transparency | Opaque | Varies | Complex | **Instant, transparent** |
| Creator payout speed | Monthly | Varies | Monthly | **On-demand via Connect** |
| Viewer price | Free (ads) | Free (ads) | Free (ads) + $10+/mo | **Free or $1/month** |
| Niche/community focus | None | None | Gaming-heavy | **Hyper-niche first** |
| Infrastructure cost | Very high | High | Very high | **Ultra-low (serverless)** |
| Indie-founder viable | No | No | No | **Yes** |

---

## 12. Claude Agent-Teaming Prompt (for ongoing development)

See [CLAUDE_AGENT_PROMPT.md](./CLAUDE_AGENT_PROMPT.md) for the full copy-paste ready prompt to use with Claude when implementing new features or phases.

The monetization addendum to include with any architecture or implementation prompt:

```
MONETIZATION ADDENDUM (implement this hybrid model exactly):

- Free Tier: Light ads (VAST/dynamic via Stream Player), limited chat/reactions.
- Citizen Tier: $1/month recurring via Stripe Billing (with annual $10 option).
  Unlocks: ad-free + full interactivity (unlimited chat with badges, advanced polls,
  watch parties, unlimited access).
- Optional VIP Tier: $5-9/month for exclusive perks (private rooms, downloads, AMAs).
- Creator payouts: Stripe Connect across all revenue sources (ads + subs),
  attributed by engagement weight (watch_minutes + chat + poll participation).
- Gating: Neon roles + signed Stream URLs + Durable Object tier permissions.
- Retention: 14-day trial, upgrade nudges at feature gates, annual plan discount,
  trial expiry messaging, churn tracking.
- Platform fee: PLATFORM_FEE_PERCENT env var (default 20%).

Update all architecture, schema, frontend, and dashboard sections to support
this hybrid model. Start Phase 1 with the improved monetization from day one.
```
