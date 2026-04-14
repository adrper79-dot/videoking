# Phase 4 Remaining Work - Implementation Plan

**Current Status**: Infrastructure complete (referrals API, analytics API, payout engine)  
**Remaining Work**: Frontend integration, UI features, VIP tier, email notifications

---

## 1. Trial Expiry Countdown (NEXT - High Impact)

**Why First**: Directly improves conversion rate, quick win  
**Impact**: Expected 5-10% improvement in post-trial conversions  
**Effort**: 1-2 story points  
**Files**: 
- `apps/web/src/components/Navbar.tsx` — Add trial banner
- `apps/web/src/lib/utils.ts` — Calculate days remaining

**Implementation**:
```typescript
// 1. Get user's trial_started_at from session
// 2. Calculate: days_remaining = 14 - (today - trial_started_at)  
// 3. Show banner when days_remaining <= 3
// 4. Banner text: "Your trial ends in X days — subscribe for $1/month"
// 5. Banner CTA links to subscribe page
```

**Database Query Needed**: User trial info already available via entitlements

---

## 2. Post-Trial Downgrade Messaging  

**Why Next**: Captures churning users with retention messaging  
**Impact**: Expected 10-15% recovery rate for post-trial users  
**Effort**: 2-3 story points  
**Files**:
- `apps/worker/src/routes/webhooks.ts` — Stripe trial_end event
- `apps/web/src/components/Notifications.tsx` — In-app messaging UI
- `packages/db/src/schema/users.ts` — Track trial_ended_at timestamp

**Implementation**:
```typescript
// 1. Listen for Stripe webhook: customer.subscription.trial_will_end
// 2. Create notification: "Your trial ends in 3 days! Keep access for just $1/month"
// 3. Store notification in DB with 7-day expiry
// 4. Show in-app banner with CTA to subscribe
// 5. Track: banner_shown, cta_clicked, converted_post_trial
```

---

## 3. Chat Rate-Limit Upsell Modal

**Why Next**: Monetize existing engaged free users  
**Impact**: Expected 3-5% conversion rate on engaged free users  
**Effort**: 1-2 story points  
**Files**:
- `apps/web/src/components/InteractivityOverlay.tsx` — Modal trigger

**Implementation**:
```typescript
// On CHAT_RATE_LIMITED event:
// 1. Check if free user (no subscription)
// 2. Show modal: "Upgrade to Citizen ($1/month) for unlimited chat"
// 3. Include upsell copy about community benefits
// 4. Track: modal_impressions, cta_clicks, conversions
```

---

## 4. VIP Tier Implementation

**Why Fourth**: Enables monetization for high-engagement users  
**Impact**: Expected $100-500/month ARR per creator  
**Effort**: 5-8 story points  
**Files**:
- `packages/db/src/schema/subscriptions.ts` — Add VIP tier
- `apps/worker/src/routes/stripe.ts` — Create VIP price/checkout
- `apps/web/src/components/PricingClient.tsx` — Show VIP option
- `apps/web/src/components/EntitlementsContext.tsx` — VIP perks logic
- `apps/worker/src/lib/entitlements.ts` — Add VIP benefits

**VIP Perks** (vs Citizen):
- Private watch parties (1:1 video call)
- Video downloads (saved locally)
- Creator AMA/Q&A sessions
- VIP-only chat badge
- Exclusive merchandise deals
- Priority support

**Implementation**:
```typescript
// 1. Add VIP subscription at $5-9/month
// 2. Update entitlements context to return: tier = 'free' | 'citizen' | 'vip'
// 3. Add VIP-only features to video player UI
// 4. Implement private room access control
// 5. Add download button in video player
```

---

## 5. Referral Frontend Integration

**Why Fifth**: Monetize word-of-mouth growth  
**Impact**: Expected 5-10% viral coefficient  
**Effort**: 3-4 story points  
**Files**:
- `apps/web/src/components/ShareModal.tsx` — New component
- `apps/web/src/components/CreatorDashboard.tsx` — Referral stats section
- `apps/web/src/lib/copyToClipboard.ts` — Utility

**Implementation**:
```typescript
// 1. Add "Invite Friends" button to creator dashboard
// 2. Show referral link: nichestream.com?ref=USER_CODE
// 3. Show stats: total_clicks, total_signups, total_conversions
// 4. Show earned credits: $2 per converted referral
// 5. "Share on Social" buttons (Twitter, Facebook, copy link)
```

---

## 6. Email Notifications

**Why Sixth**: Engagement and retention via out-of-app messaging  
**Impact**: Expected 20-30% improvement in weekly active users  
**Effort**: 5-6 story points  
**Files**:
- `apps/worker/src/lib/email.ts` — New email sender
- `apps/worker/src/routes/webhooks.ts` — Trigger points
- `packages/db/src/schema/users.ts` — Email preferences/log

**Email Types**:
1. **Payout Milestone** — "Your creator earnings have reached $100!"
2. **New Video** — "New video from [creator] you follow"
3. **Watch Party Invite** — "[Friend] invited you to watch [video]"
4. **Trial Ending** — "Your trial ends in 3 days — subscribe for $1/month"
5. **Post-Trial** — "We miss you — come back for $1/month"

**Implementation**:
```typescript
// 1. Use SendGrid or similar email provider
// 2. Store email preferences in users table
// 3. Track email sends in audit log
// 4. Add unsubscribe links in all emails
// 5. A/B test different subject lines/timing
```

---

## Priority Ranking

1. **Trial Expiry Countdown** ✅ NEXT (quick win, high conversion impact)
2. **Post-Trial Messaging** (captures churning users)
3. **Chat Rate-Limit Upsell** (monetizes engaged users)
4. **VIP Tier** (high-engagement monetization)
5. **Referral Frontend** (viral growth)
6. **Email Notifications** (retention & re-engagement)

---

## Success Metrics Post-Implementation

| Metric | Target | Current |
|--------|--------|---------|
| Post-trial conversion rate | 15% | TBD |
| Trial-to-Citizen conversion | 20% | TBD |
| Chat rate-limit upsell conversion | 5% | TBD |
| VIP adoption rate | 2-3% of Citizens | TBD |
| Referral viral coefficient | 1.5x | TBD |
| Weekly email open rate | 30%+ | TBD |
| Trial user retention day 7 | 40% | TBD |
| Trial user retention day 14 | 25% | TBD |

---

## Total Effort Estimate

- Trial Countdown: 1-2 pts
- Post-Trial Messaging: 2-3 pts  
- Chat Upsell: 1-2 pts
- VIP Tier: 5-8 pts
- Referral Frontend: 3-4 pts
- Email Notifications: 5-6 pts

**Total: 17-25 story points (~4-6 weeks for 2 engineers)**

---

## Dependencies & Blockers

- ✅ Referral API ready (done)
- ✅ Analytics API ready (done)
- ✅ Payout engine ready (done)
- ⏳ Stripe Connect OAuth needs completion
- ✅ Database schema ready
- ◐ Need email provider setup (SendGrid, Mailgun, etc.)
- ◐ Need Stripe VIP tier pricing configuration

---

## Deployment Sequence

1. Deploy Trial Countdown (low risk, high reward)
2. Deploy Post-Trial Messaging (monitor conversion improvement)
3. Deploy Chat Upsell (A/B test messaging)
4. Deploy VIP Tier (introduce new revenue stream)
5. Deploy Referral Frontend (drive viral growth)
6. Deploy Email Notifications (polish implementation)

Each phase should be monitored for 1-2 weeks before proceeding to next.
