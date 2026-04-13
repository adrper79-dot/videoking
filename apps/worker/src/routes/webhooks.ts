import { Hono } from "hono";
import type { Env } from "../types";
import { createDb } from "../lib/db";
import { createStripeClient, verifyStripeWebhook, calculateFees } from "../lib/stripe";
import { subscriptions, earnings, videoUnlocks, connectedAccounts } from "@nichestream/db";
import { eq } from "drizzle-orm";
import type Stripe from "stripe";

const webhooksRouter = new Hono<{ Bindings: Env }>();

/**
 * POST /api/webhooks/stripe
 * Handles Stripe webhook events. Verifies the signature before processing.
 */
webhooksRouter.post("/stripe", async (c) => {
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

  try {
    switch (event.type) {
      case "payment_intent.succeeded": {
        const pi = event.data.object as Stripe.PaymentIntent;
        await handlePaymentIntentSucceeded(db, pi, platformFeePercent);
        break;
      }

      case "customer.subscription.created":
      case "customer.subscription.updated": {
        const sub = event.data.object as Stripe.Subscription;
        await handleSubscriptionUpdated(db, stripe, sub);
        break;
      }

      case "customer.subscription.deleted": {
        const sub = event.data.object as Stripe.Subscription;
        await db
          .update(subscriptions)
          .set({ status: "canceled" })
          .where(eq(subscriptions.stripeSubscriptionId, sub.id));
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
  stripe: Stripe,
  sub: Stripe.Subscription,
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

  // If newly active, record a subscription_share earning for creator
  if (status === "active") {
    const platformFeePercent = 20;
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

  void stripe;
  void connectedAccounts;
}

export { webhooksRouter as webhookRoutes };
