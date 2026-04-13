import { Hono } from "hono";
import { eq } from "drizzle-orm";
import type { Env } from "../types";
import { createDb } from "../lib/db";
import { createAuth } from "../lib/auth";
import { createStripeClient, createConnectAccountAndLink, calculateFees } from "../lib/stripe";
import { connectedAccounts, users, earnings, videoUnlocks, videos } from "@nichestream/db";

const stripeRouter = new Hono<{ Bindings: Env }>();

/**
 * POST /api/stripe/connect/onboard
 * Starts Stripe Connect Express onboarding for a creator.
 * Creates a Stripe account if none exists, returns the onboarding URL.
 */
stripeRouter.post("/connect/onboard", async (c) => {
  const db = createDb(c.env);
  const auth = createAuth(db, c.env);

  const session = await auth.api.getSession({ headers: c.req.raw.headers });
  if (!session?.user) {
    return c.json({ error: "Unauthorized", message: "Authentication required" }, 401);
  }

  const stripe = createStripeClient(c.env);

  try {
    // Check for existing connected account
    const [existing] = await db
      .select()
      .from(connectedAccounts)
      .where(eq(connectedAccounts.userId, session.user.id))
      .limit(1);

    let stripeAccountId: string;

    if (existing) {
      stripeAccountId = existing.stripeAccountId;
    } else {
      const [user] = await db
        .select({ email: users.email })
        .from(users)
        .where(eq(users.id, session.user.id))
        .limit(1);

      const returnUrl = `${c.env.APP_BASE_URL}/dashboard?stripe=success`;
      const refreshUrl = `${c.env.APP_BASE_URL}/dashboard?stripe=refresh`;

      const { accountId, onboardingUrl } = await createConnectAccountAndLink(
        stripe,
        user?.email ?? "",
        returnUrl,
        refreshUrl,
      );

      await db.insert(connectedAccounts).values({
        userId: session.user.id,
        stripeAccountId: accountId,
      });

      return c.json({ onboardingUrl });
    }

    // Existing account — create a new account link
    const accountLink = await stripe.accountLinks.create({
      account: stripeAccountId,
      refresh_url: `${c.env.APP_BASE_URL}/dashboard?stripe=refresh`,
      return_url: `${c.env.APP_BASE_URL}/dashboard?stripe=success`,
      type: "account_onboarding",
    });

    return c.json({ onboardingUrl: accountLink.url });
  } catch (err) {
    console.error("POST /api/stripe/connect/onboard error:", err);
    return c.json({ error: "InternalError", message: "Failed to start onboarding" }, 500);
  }
});

/**
 * GET /api/stripe/connect/status
 * Returns the connected account status for the authenticated creator.
 */
stripeRouter.get("/connect/status", async (c) => {
  const db = createDb(c.env);
  const auth = createAuth(db, c.env);

  const session = await auth.api.getSession({ headers: c.req.raw.headers });
  if (!session?.user) {
    return c.json({ error: "Unauthorized", message: "Authentication required" }, 401);
  }

  const stripe = createStripeClient(c.env);

  try {
    const [account] = await db
      .select()
      .from(connectedAccounts)
      .where(eq(connectedAccounts.userId, session.user.id))
      .limit(1);

    if (!account) {
      return c.json({ connected: false });
    }

    // Sync status from Stripe
    const stripeAccount = await stripe.accounts.retrieve(account.stripeAccountId);

    await db
      .update(connectedAccounts)
      .set({
        chargesEnabled: stripeAccount.charges_enabled,
        payoutsEnabled: stripeAccount.payouts_enabled,
        onboardingComplete: stripeAccount.details_submitted,
        updatedAt: new Date(),
      })
      .where(eq(connectedAccounts.userId, session.user.id));

    return c.json({
      connected: true,
      chargesEnabled: stripeAccount.charges_enabled,
      payoutsEnabled: stripeAccount.payouts_enabled,
      onboardingComplete: stripeAccount.details_submitted,
    });
  } catch (err) {
    console.error("GET /api/stripe/connect/status error:", err);
    return c.json({ error: "InternalError", message: "Failed to get connect status" }, 500);
  }
});

/**
 * POST /api/stripe/subscriptions
 * Creates a Stripe Checkout Session for subscribing to a creator.
 */
stripeRouter.post("/subscriptions", async (c) => {
  const db = createDb(c.env);
  const auth = createAuth(db, c.env);

  const session = await auth.api.getSession({ headers: c.req.raw.headers });
  if (!session?.user) {
    return c.json({ error: "Unauthorized", message: "Authentication required" }, 401);
  }

  const stripe = createStripeClient(c.env);

  try {
    const body = await c.req.json<{
      creatorId: string;
      plan: "monthly" | "annual";
      priceId: string;
    }>();

    const checkoutSession = await stripe.checkout.sessions.create({
      mode: "subscription",
      payment_method_types: ["card"],
      line_items: [{ price: body.priceId, quantity: 1 }],
      success_url: `${c.env.APP_BASE_URL}/dashboard?subscription=success`,
      cancel_url: `${c.env.APP_BASE_URL}/channel/${body.creatorId}`,
      metadata: {
        subscriberId: session.user.id,
        creatorId: body.creatorId,
        plan: body.plan,
      },
    });

    return c.json({
      checkoutUrl: checkoutSession.url,
      sessionId: checkoutSession.id,
    });
  } catch (err) {
    console.error("POST /api/stripe/subscriptions error:", err);
    return c.json({ error: "InternalError", message: "Failed to create subscription" }, 500);
  }
});

/**
 * POST /api/stripe/unlock
 * Creates a Stripe PaymentIntent for unlocking a pay-per-view video.
 */
stripeRouter.post("/unlock", async (c) => {
  const db = createDb(c.env);
  const auth = createAuth(db, c.env);

  const session = await auth.api.getSession({ headers: c.req.raw.headers });
  if (!session?.user) {
    return c.json({ error: "Unauthorized", message: "Authentication required" }, 401);
  }

  const stripe = createStripeClient(c.env);
  const platformFeePercent = Number(c.env.PLATFORM_FEE_PERCENT ?? 20);

  try {
    const body = await c.req.json<{
      videoId: string;
      amountCents: number;
      creatorStripeAccountId: string;
    }>();

    if (!body.videoId || !body.amountCents || body.amountCents < 50) {
      return c.json({ error: "ValidationError", message: "Invalid amount" }, 400);
    }

    // Check video exists and is unlocked_only
    const [video] = await db
      .select()
      .from(videos)
      .where(eq(videos.id, body.videoId))
      .limit(1);

    if (!video || video.visibility !== "unlocked_only") {
      return c.json({ error: "NotFound", message: "Video not found" }, 404);
    }

    // Check if already unlocked
    const [existingUnlock] = await db
      .select()
      .from(videoUnlocks)
      .where(eq(videoUnlocks.videoId, body.videoId))
      .limit(1);

    if (existingUnlock && existingUnlock.userId === session.user.id) {
      return c.json({ error: "AlreadyUnlocked", message: "Video already unlocked" }, 400);
    }

    const { platformFeeCents } = calculateFees(body.amountCents, platformFeePercent);

    const paymentIntent = await stripe.paymentIntents.create({
      amount: body.amountCents,
      currency: "usd",
      application_fee_amount: platformFeeCents,
      transfer_data: { destination: body.creatorStripeAccountId },
      metadata: {
        videoId: body.videoId,
        userId: session.user.id,
        type: "unlock_purchase",
      },
    });

    return c.json({
      clientSecret: paymentIntent.client_secret,
      paymentIntentId: paymentIntent.id,
    });
  } catch (err) {
    console.error("POST /api/stripe/unlock error:", err);
    return c.json({ error: "InternalError", message: "Failed to create payment" }, 500);
  }
});

export { stripeRouter as stripeRoutes };
