# Implementation Audit

## Scope

This audit compares the current repository against the product plan in README, with emphasis on the hybrid freemium model, entitlement gating, creator monetization, and real-time interactivity. It also records which gaps were fixed immediately in this pass and which still need follow-up work.

## Executed Fixes

### 1. Tier model added to the schema

The data model now has explicit membership state instead of leaving all viewers effectively untyped.

- Added `user_tier`, `subscription_status`, `trial_ends_at`, `has_seen_onboarding`, and `ad_preferences` to the user schema.
- Added `created_by_trial` and `trial_period_days` to subscriptions.
- Added unique indexes to prevent duplicate video unlocks and duplicate poll votes.
- Added migration file `packages/db/src/migrations/0001_hybrid_freemium_entitlements.sql`.

Why this matters:

- The previous code had no canonical place to represent Free vs. Citizen vs. VIP.
- Access checks, pricing UX, and real-time privileges were all impossible to enforce consistently.

### 2. Stripe and webhook flow now update user entitlements

The webhook path now moves membership state instead of only recording subscription rows.

- Added validation for missing Stripe webhook secrets.
- Subscription webhook updates now recompute user membership state.
- Users are promoted to `citizen` when they have an active subscription and downgraded when they do not.
- Trial state is preserved when present.

Why this matters:

- Before this change, successful Stripe subscription events never changed the viewer's effective product tier.
- The platform could collect payment without unlocking paid features.

### 3. Protected video access is now enforced

The watch endpoint no longer returns protected videos to everyone who is not the creator.

- `subscribers_only` videos now check active subscriptions and paid entitlements.
- `unlocked_only` videos now check unlock purchases and paid entitlements.
- Creator access still bypasses these restrictions.

Why this matters:

- The route previously had a TODO in the core access branch.
- This was a direct product and revenue leak.

### 4. Real-time interactivity is now tier-aware

The Durable Object room no longer treats all users as equal.

- WebSocket connections now derive identity and tier from the authenticated session when available.
- Chat messages now carry tier metadata.
- Free-tier chat uses a slower rate limit than paid tiers.
- Free-tier users are blocked from poll creation and watch-party hosting.

Why this matters:

- The plan positions interactivity as the conversion moat.
- Without differentiated privileges, there was no premium product to sell.

### 5. Frontend surfaces now reflect the entitlement model

- Added `GET /api/auth/entitlements` for client-safe entitlement reads.
- Navbar now shows the active tier and an upgrade CTA for free members.
- Subscribe flow now supports monthly vs. annual plan selection.
- Chat shows Citizen and VIP badges.
- Chat surfaces rate-limit expectations for free members.
- Poll and watch-party panels now explain premium gating instead of silently failing.

Why this matters:

- Monetization depends on users understanding what is free, what is premium, and why.
- The original UI gave almost no visibility into product tiering.

### 6. Trial activation and pricing funnel are now materially improved

- Added a dedicated pricing page with Free, Citizen, and VIP positioning.
- Replaced the raw sign-up form with a client flow that signs up, activates the trial, and routes users into pricing.
- Added a worker route to activate trials safely for authenticated users.
- Added fallback trial activation to the entitlement read path so older auth flows still receive the promised onboarding benefit.
- Repointed upgrade CTAs from generic sign-up links to the pricing surface.

Why this matters:

- The product now has a real upgrade destination instead of scattering users across auth screens.
- The 14-day Citizen trial is no longer just a schema field; it is activated in the live flow.

## Remaining Gaps

### Critical

#### Platform subscription economics are still creator-centric

Current checkout still accepts a `creatorId` and creates a subscription attached to a creator. That is structurally different from the updated plan, which describes a platform-level Citizen membership with creator revenue shares allocated later.

Impact:

- A user can become a global Citizen because of any subscription, but the revenue model underneath is still channel-oriented.
- This is a partial bridge, not a full implementation of the monetization strategy.

Recommended follow-up:

- Introduce a platform membership product distinct from creator subscriptions.
- Treat creator payout attribution as an allocation layer on top of shared platform revenue instead of direct subscription ownership.

#### Ad insertion is still not implemented

The plan now promises light ads for the free tier, but there is still no VAST tag wiring, ad configuration service, or Stream player integration for ad decisions.

Impact:

- The free tier currently drives usage but no ad revenue.
- The hybrid monetization model is only partially live.

Recommended follow-up:

- Add ad config env vars to the worker and web app.
- Inject VAST tags into the video player for free users only.
- Track impressions and completions for payout attribution.

### High

#### Trial conversion lifecycle is only partially complete

Trial activation now happens, but there is still no dedicated expiry messaging, conversion countdown UI, or post-trial downgrade flow.

Impact:

- New users receive the promised trial, but the retention and conversion loop still lacks the final nudges that usually drive paid conversion.

Recommended follow-up:

- Add in-product countdown messaging as trial expiry approaches.
- Add post-trial downgrade messaging and “resume Citizen” prompts.

#### Analytics still do not measure conversion or ad performance

Dashboard analytics remain view/watch-time oriented and do not cover trial conversion, ad impressions, or interaction depth.

Impact:

- The platform cannot evaluate churn, free-to-paid conversion, or creator allocation quality.

Recommended follow-up:

- Add an analytics events table for ad, poll, reaction, and chat events.
- Extend the dashboard with free vs. paid funnel metrics.

### Medium

#### Pricing now exists, but checkout is still not platform-native

Upgrade CTAs now route to a dedicated pricing page, but the actual paid checkout still depends on creator-linked subscription entry points.

Impact:

- The middle-of-funnel experience is improved.
- The last step of the funnel is still constrained by the creator-centric billing model.

Recommended follow-up:

- Convert the pricing page into a direct platform-membership checkout once the billing model is changed.

#### Creator dashboard does not yet break down revenue by source and payer tier

Earnings summaries still aggregate by earnings type only.

Impact:

- The plan calls for transparent creator reporting across ad and subscription sources.

Recommended follow-up:

- Add payer-tier attribution on earnings records.
- Surface source and tier splits in dashboard reporting.

## Recommended Next Execution Order

1. Convert subscriptions from creator-specific access into platform membership plus creator allocation.
2. Implement free-tier ad insertion and ad event tracking.
3. Add automatic trial issuance and a dedicated pricing/upgrade funnel.
4. Expand analytics for churn, conversion, and payout attribution.