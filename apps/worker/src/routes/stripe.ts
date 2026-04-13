import { Hono } from "hono";
import { and, eq } from "drizzle-orm";
import type { Env } from "../types";
import { createDb } from "../lib/db";
import { createAuth } from "../lib/auth";
import { createStripeClient, createConnectAccountAndLink, calculateFees } from "../lib/stripe";
import { connectedAccounts, users, videoUnlocks, videos } from "@nichestream/db";

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
 * Routes platform fee and creator share via application_fee_amount.
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

    if (!body.creatorId || !body.priceId || !["monthly", "annual"].includes(body.plan)) {
      return c.json({ error: "ValidationError", message: "Invalid subscription request" }, 400);
    }

    const expectedPriceId =
      body.plan === "annual"
        ? c.env.STRIPE_CITIZEN_ANNUAL_PRICE
        : c.env.STRIPE_CITIZEN_MONTHLY_PRICE;

    if (expectedPriceId && body.priceId !== expectedPriceId) {
      return c.json({ error: "ValidationError", message: "Unexpected price selected" }, 400);
    }

    // Fetch creator username for cancel_url and their Stripe account for revenue routing
    const [creator] = await db
      .select({ username: users.username })
      .from(users)
      .where(eq(users.id, body.creatorId))
      .limit(1);

    if (!creator) {
      return c.json({ error: "NotFound", message: "Creator not found" }, 404);
    }

    const checkoutSession = await stripe.checkout.sessions.create({
      mode: "subscription",
      payment_method_types: ["card"],
      line_items: [{ price: body.priceId, quantity: 1 }],
      success_url: `${c.env.APP_BASE_URL}/dashboard?subscription=success`,
      cancel_url: `${c.env.APP_BASE_URL}/channel/${creator.username}`,
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
 * Amount and creator Stripe account ID are resolved server-side from the DB.
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

  if (!Number.isFinite(platformFeePercent) || platformFeePercent < 0 || platformFeePercent > 100) {
    return c.json({ error: "Misconfigured", message: "Invalid platform fee configuration" }, 500);
  }

  try {
    const body = await c.req.json<{ videoId: string }>();

    if (!body.videoId) {
      return c.json({ error: "ValidationError", message: "videoId required" }, 400);
    }

    // Fetch video with unlock price from DB — never trust client-supplied amount
    const [video] = await db
      .select({
        id: videos.id,
        visibility: videos.visibility,
        creatorId: videos.creatorId,
        unlockPriceCents: videos.unlockPriceCents,
      })
      .from(videos)
      .where(eq(videos.id, body.videoId))
      .limit(1);

    if (!video || video.visibility !== "unlocked_only") {
      return c.json({ error: "NotFound", message: "Video not found" }, 404);
    }

    if (!video.unlockPriceCents || video.unlockPriceCents < 50) {
      return c.json({ error: "Misconfigured", message: "Video unlock price not set" }, 400);
    }

    // Check if already unlocked
    const [existingUnlock] = await db
      .select()
      .from(videoUnlocks)
      .where(
        and(
          eq(videoUnlocks.videoId, body.videoId),
          eq(videoUnlocks.userId, session.user.id),
        ),
      )
      .limit(1);

    if (existingUnlock) {
      return c.json({ error: "AlreadyUnlocked", message: "Video already unlocked" }, 400);
    }

    // Fetch creator Stripe account from DB — never trust client-supplied account ID
    const [creatorAccount] = await db
      .select({ stripeAccountId: connectedAccounts.stripeAccountId })
      .from(connectedAccounts)
      .where(eq(connectedAccounts.userId, video.creatorId))
      .limit(1);

    if (!creatorAccount) {
      return c.json({ error: "Unavailable", message: "Creator payment account not set up" }, 400);
    }

    const { platformFeeCents } = calculateFees(video.unlockPriceCents, platformFeePercent);

    const paymentIntent = await stripe.paymentIntents.create({
      amount: video.unlockPriceCents,
      currency: "usd",
      application_fee_amount: platformFeeCents,
      transfer_data: { destination: creatorAccount.stripeAccountId },
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

/**
 * POST /api/stripe/tip
 * Creates a Stripe PaymentIntent for sending a tip to a creator.
 * Amount validation and creator Stripe account ID are resolved server-side.
 */
stripeRouter.post("/tip", async (c) => {
  const db = createDb(c.env);
  const auth = createAuth(db, c.env);

  const session = await auth.api.getSession({ headers: c.req.raw.headers });
  if (!session?.user) {
    return c.json({ error: "Unauthorized", message: "Authentication required" }, 401);
  }

  const stripe = createStripeClient(c.env);
  const platformFeePercent = Number(c.env.PLATFORM_FEE_PERCENT ?? 20);

  if (!Number.isFinite(platformFeePercent) || platformFeePercent < 0 || platformFeePercent > 100) {
    return c.json({ error: "Misconfigured", message: "Invalid platform fee configuration" }, 500);
  }

  try {
    const body = await c.req.json<{ creatorId: string; amountCents: number }>();

    if (!body.creatorId || !body.amountCents) {
      return c.json({ error: "ValidationError", message: "creatorId and amountCents required" }, 400);
    }

    // Validate amount: min 50 cents, max $999.99
    if (body.amountCents < 50 || body.amountCents > 99999) {
      return c.json({ error: "ValidationError", message: "Tip amount must be between $0.50 and $999.99" }, 400);
    }

    // Fetch creator's Stripe account from DB
    const [creatorAccount] = await db
      .select({ stripeAccountId: connectedAccounts.stripeAccountId })
      .from(connectedAccounts)
      .where(eq(connectedAccounts.userId, body.creatorId))
      .limit(1);

    if (!creatorAccount) {
      return c.json({ error: "Unavailable", message: "Creator payment account not set up" }, 400);
    }

    const { platformFeeCents } = calculateFees(body.amountCents, platformFeePercent);

    const paymentIntent = await stripe.paymentIntents.create({
      amount: body.amountCents,
      currency: "usd",
      application_fee_amount: platformFeeCents,
      transfer_data: { destination: creatorAccount.stripeAccountId },
      metadata: {
        creatorId: body.creatorId,
        userId: session.user.id,
        type: "tip",
      },
    });

    return c.json({
      clientSecret: paymentIntent.client_secret,
      paymentIntentId: paymentIntent.id,
    });
  } catch (err) {
    console.error("POST /api/stripe/tip error:", err);
    return c.json({ error: "InternalError", message: "Failed to create payment" }, 500);
  }
});

export { stripeRouter as stripeRoutes };
