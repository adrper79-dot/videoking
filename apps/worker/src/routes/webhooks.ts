import { Hono } from "hono";
import type { Env } from "../types";
import { createDb } from "../lib/db";
import { createStripeClient, verifyStripeWebhook, calculateFees } from "../lib/stripe";
import { subscriptions, earnings, users, videoUnlocks, processedWebhookEvents } from "@nichestream/db";
import { and, eq } from "drizzle-orm";
import type Stripe from "stripe";
import { isTrialActive, syncUserMembershipStatus } from "../lib/entitlements";

const webhooksRouter = new Hono<{ Bindings: Env }>();

/**
 * POST /api/webhooks/stripe
 * Handles Stripe webhook events. Verifies the signature before processing.
 */
webhooksRouter.post("/stripe", async (c) => {
  if (!c.env.STRIPE_WEBHOOK_SECRET) {
    return c.json({ error: "Misconfigured", message: "Missing Stripe webhook secret" }, 500);
  }

  const signature = c.req.header("stripe-signature");

  if (!signature) {
    return c.json({ error: "Missing signature" }, 400);
  }

  const body = await c.req.text();
  const stripe = createStripeClient(c.env);

  let event: Stripe.Event;
  try {
    event = await verifyStripeWebhook(stripe, body, signature, c.env.STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    console.error("Webhook signature verification failed:", err);
    return c.json({ error: "Invalid signature" }, 400);
  }

  const db = createDb(c.env);
  const platformFeePercent = Number(c.env.PLATFORM_FEE_PERCENT ?? 20);

  // Idempotency: return 200 immediately if this event was already processed
  const [alreadyProcessed] = await db
    .select({ id: processedWebhookEvents.id })
    .from(processedWebhookEvents)
    .where(eq(processedWebhookEvents.id, event.id))
    .limit(1);

  if (alreadyProcessed) {
    return c.json({ received: true });
  }

  // Record this event as processed before handling (prevents duplicate processing on retry)
  try {
    await db.insert(processedWebhookEvents).values({ id: event.id });
  } catch {
    // Concurrent duplicate — another instance already inserted, safe to skip
    return c.json({ received: true });
  }

  try {
    switch (event.type) {
      case "payment_intent.succeeded": {
        const pi = event.data.object as Stripe.PaymentIntent;
        await handlePaymentIntentSucceeded(db, pi, platformFeePercent);
        break;
      }

      case "customer.subscription.created": {
        const sub = event.data.object as Stripe.Subscription;
        await handleSubscriptionUpdated(db, stripe, sub, platformFeePercent, true);
        break;
      }

      case "customer.subscription.updated": {
        const sub = event.data.object as Stripe.Subscription;
        // On updates, sync membership state but do NOT insert new earnings records
        await handleSubscriptionUpdated(db, stripe, sub, platformFeePercent, false);
        break;
      }

      case "customer.subscription.deleted": {
        const sub = event.data.object as Stripe.Subscription;
        const [existing] = await db
          .select({ subscriberId: subscriptions.subscriberId })
          .from(subscriptions)
          .where(eq(subscriptions.stripeSubscriptionId, sub.id))
          .limit(1);

        await db
          .update(subscriptions)
          .set({ status: "canceled" })
          .where(eq(subscriptions.stripeSubscriptionId, sub.id));

        if (existing?.subscriberId) {
          await refreshUserMembershipState(db, existing.subscriberId, "canceled");
        }
        break;
      }

      case "transfer.created": {
        const transfer = event.data.object as Stripe.Transfer;
        // Update earnings record with transfer ID
        if (transfer.metadata?.earningId) {
          await db
            .update(earnings)
            .set({ stripeTransferId: transfer.id, status: "transferred" })
            .where(eq(earnings.id, transfer.metadata.earningId));
        }
        break;
      }

      default:
        break;
    }

    return c.json({ received: true });
  } catch (err) {
    console.error(`Error handling webhook ${event.type}:`, err);
    return c.json({ error: "Processing failed" }, 500);
  }
});

async function handlePaymentIntentSucceeded(
  db: ReturnType<typeof createDb>,
  pi: Stripe.PaymentIntent,
  platformFeePercent: number,
): Promise<void> {
  const { videoId, userId, type } = pi.metadata ?? {};

  if (type === "unlock_purchase" && videoId && userId) {
    const { platformFeeCents, netAmountCents } = calculateFees(pi.amount, platformFeePercent);

    // Record the unlock
    await db.insert(videoUnlocks).values({
      userId,
      videoId,
      stripePaymentIntentId: pi.id,
      amountCents: pi.amount,
    });

    // Find creator ID from video
    const { videos } = await import("@nichestream/db");
    const [video] = await db
      .select({ creatorId: videos.creatorId })
      .from(videos)
      .where(eq(videos.id, videoId))
      .limit(1);

    if (video) {
      await db.insert(earnings).values({
        creatorId: video.creatorId,
        videoId,
        type: "unlock_purchase",
        grossAmountCents: pi.amount,
        platformFeeCents,
        netAmountCents,
        stripePaymentIntentId: pi.id,
        status: "pending",
      });
    }
  }
}

async function handleSubscriptionUpdated(
  db: ReturnType<typeof createDb>,
  _stripe: Stripe,
  sub: Stripe.Subscription,
  platformFeePercent: number,
  insertEarnings: boolean,
): Promise<void> {
  const { subscriberId, creatorId, plan } = sub.metadata ?? {};

  if (!subscriberId || !creatorId) return;

  const currentPeriodEnd = new Date(sub.current_period_end * 1000);
  const status =
    sub.status === "active"
      ? "active"
      : sub.status === "past_due"
        ? "past_due"
        : "canceled";

  const [existing] = await db
    .select()
    .from(subscriptions)
    .where(eq(subscriptions.stripeSubscriptionId, sub.id))
    .limit(1);

  if (existing) {
    await db
      .update(subscriptions)
      .set({ status, currentPeriodEnd })
      .where(eq(subscriptions.stripeSubscriptionId, sub.id));
  } else {
    await db.insert(subscriptions).values({
      subscriberId,
      creatorId,
      stripeSubscriptionId: sub.id,
      stripeCustomerId: String(sub.customer),
      plan: (plan as "monthly" | "annual") ?? "monthly",
      status,
      currentPeriodEnd,
    });
  }

  await refreshUserMembershipState(db, subscriberId, status);

  // Only insert earnings on subscription.created (insertEarnings flag), not on every renewal
  if (insertEarnings && status === "active") {
    const grossAmountCents =
      (sub.items.data[0]?.price.unit_amount ?? 0) * (sub.items.data[0]?.quantity ?? 1);

    if (grossAmountCents > 0) {
      const { platformFeeCents, netAmountCents } = calculateFees(
        grossAmountCents,
        platformFeePercent,
      );

      await db.insert(earnings).values({
        creatorId,
        type: "subscription_share",
        grossAmountCents,
        platformFeeCents,
        netAmountCents,
        status: "pending",
      });
    }
  }
}

async function refreshUserMembershipState(
  db: ReturnType<typeof createDb>,
  subscriberId: string,
  fallbackStatus: "active" | "canceled" | "past_due",
): Promise<void> {
  const [activeSubscription] = await db
    .select({ id: subscriptions.id })
    .from(subscriptions)
    .where(
      and(
        eq(subscriptions.subscriberId, subscriberId),
        eq(subscriptions.status, "active"),
      ),
    )
    .limit(1);

  if (activeSubscription) {
    await syncUserMembershipStatus(db, subscriberId, {
      userTier: "citizen",
      subscriptionStatus: "active",
    });
    return;
  }

  const [user] = await db
    .select({ trialEndsAt: users.trialEndsAt })
    .from(users)
    .where(eq(users.id, subscriberId))
    .limit(1);

  const nextStatus = isTrialActive(user?.trialEndsAt) ? "trial" : fallbackStatus;
  await syncUserMembershipStatus(db, subscriberId, {
    userTier: "free",
    subscriptionStatus: nextStatus,
  });
}

export { webhooksRouter as webhookRoutes };
