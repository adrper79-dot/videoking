/**
 * Referral Program Routes
 * 
 * Manages referral link generation, tracking, and reward distribution.
 * 
 * Endpoints:
 * - POST /api/referrals/create — Generate referral link
 * - GET /api/referrals/my-link — Get user's referral link
 * - GET /api/referrals/stats — Referral performance stats
 * - POST /api/referrals/apply — Apply referral code on sign-up
 */

import { Hono } from "hono";
import { eq, sql } from "drizzle-orm";
import { createDb } from "../lib/db";
import { createAuth } from "../lib/auth";
import type { Env } from "../types";
import { users, referrals } from "@nichestream/db";

const router = new Hono<{ Bindings: Env }>();

/**
 * POST /api/referrals/create
 * Generate a unique referral link for the authenticated user
 * 
 * Response:
 * { referral_code: "user_123", share_url: "https://nichestream.com?ref=user_123" }
 */
router.post("/create", async (c) => {
  try {
    const db = createDb(c.env);
    const auth = createAuth(db, c.env);
    const session = await auth.api.getSession({ headers: c.req.raw.headers });

    if (!session) {
      return c.json({ error: "Unauthorized" }, 401);
    }

    const userId = session.user.id;
    
    // Generate referral code (username + random suffix)
    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    if (!user) {
      return c.json({ error: "User not found" }, 404);
    }

    const referralCode = `${user.username}_${crypto.randomUUID().replace(/-/g, "").slice(0, 8).toUpperCase()}`;

    // Insert into referrals table
    await db.insert(referrals).values({
      referredUserId: null, // Will be set when someone signs up with this code
      referredByUserId: userId,
      referralCode: referralCode,
      conversionStatus: "pending",
      trialDaysBonus: 7,
      creditBonusCents: 0,
    });

    const shareUrl = `${c.env.APP_BASE_URL}?ref=${referralCode}`;

    return c.json({
      success: true,
      referral_code: referralCode,
      share_url: shareUrl,
    });
  } catch (error) {
    console.error("Error creating referral:", error);
    return c.json({ error: "Failed to create referral link" }, 500);
  }
});

/**
 * GET /api/referrals/my-link
 * Retrieve the authenticated user's referral link
 */
router.get("/my-link", async (c) => {
  try {
    const db = createDb(c.env);
    const auth = createAuth(db, c.env);
    const session = await auth.api.getSession({ headers: c.req.raw.headers });

    if (!session) {
      return c.json({ error: "Unauthorized" }, 401);
    }

    const userId = session.user.id;

    // Query referrals table for this user's referral code
    const [referral] = await db
      .select()
      .from(referrals)
      .where(eq(referrals.referredByUserId, userId))
      .limit(1);

    if (!referral) {
      return c.json({
        referral_code: null,
        message: "No referral code created yet",
      }, 404);
    }

    const shareUrl = `${c.env.APP_BASE_URL}?ref=${referral.referralCode}`;

    return c.json({
      referral_code: referral.referralCode,
      share_url: shareUrl,
      created_at: referral.createdAt,
    });
  } catch (error) {
    console.error("Error fetching referral link:", error);
    return c.json({ error: "Failed to fetch referral link" }, 500);
  }
});

/**
 * GET /api/referrals/stats
 * Get referral performance statistics for the authenticated user
 * 
 * Response:
 * {
 *   total_signups: 12,
 *   total_conversions: 3,
 *   conversion_rate: 0.25,
 * }
 */
router.get("/stats", async (c) => {
  try {
    const db = createDb(c.env);
    const auth = createAuth(db, c.env);
    const session = await auth.api.getSession({ headers: c.req.raw.headers });

    if (!session) {
      return c.json({ error: "Unauthorized" }, 401);
    }

    const userId = session.user.id;

    // Query referral stats from database
    const referralStats = await db
      .select()
      .from(referrals)
      .where(eq(referrals.referredByUserId, userId));

    const totalSignups = referralStats.filter(r => r.referredUserId !== null).length;
    const totalConversions = referralStats.filter(
      r => r.conversionStatus === "converted"
    ).length;
    const conversionRate = totalSignups > 0 ? totalConversions / totalSignups : 0;

    return c.json({
      total_signups: totalSignups,
      total_conversions: totalConversions,
      conversion_rate: conversionRate,
    });
  } catch (error) {
    console.error("Error fetching referral stats:", error);
    return c.json({ error: "Failed to fetch referral stats" }, 500);
  }
});

/**
 * POST /api/referrals/apply
 * Apply a referral code. The caller must be authenticated; the referred user is
 * always the currently-signed-in user (not a client-supplied `user_id`).
 *
 * Request:
 * { referral_code: "user_123_ABC123" }
 *
 * Side effects:
 * - Validates code is pending and not expired
 * - Prevents self-referral
 * - Grants both users trial extension and credit bonus (via SQL increment)
 */
router.post("/apply", async (c) => {
  try {
    const db = createDb(c.env);
    const auth = createAuth(db, c.env);
    const session = await auth.api.getSession({ headers: c.req.raw.headers });

    if (!session?.user?.id) {
      return c.json({ error: "Unauthorized" }, 401);
    }

    const userId = session.user.id;

    const { referral_code } = await c.req.json<{
      referral_code: string;
    }>();

    if (!referral_code) {
      return c.json({ error: "Missing referral_code" }, 400);
    }

    // Query referrals table for matching code
    const [referral] = await db
      .select()
      .from(referrals)
      .where(eq(referrals.referralCode, referral_code))
      .limit(1);

    if (!referral) {
      return c.json({ error: "Referral code not found" }, 404);
    }

    // Prevent self-referral
    if (referral.referredByUserId === userId) {
      return c.json({ error: "You cannot use your own referral code" }, 400);
    }

    // Validate referral is still pending (not already used or expired)
    if (referral.conversionStatus !== "pending") {
      return c.json({
        error: "Referral code already used or expired",
        status: referral.conversionStatus,
      }, 400);
    }

    // Check if referral is time-expired (e.g., after 90 days)
    const createdDate = referral.createdAt?.getTime() || 0;
    const daysSinceCreated = (Date.now() - createdDate) / (1000 * 60 * 60 * 24);
    if (daysSinceCreated > 90) {
      return c.json({ error: "Referral code expired" }, 400);
    }

    // Update referral record
    await db
      .update(referrals)
      .set({
        referredUserId: userId,
        conversionStatus: "trial_started",
        signedUpAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(referrals.id, referral.id));

    const creditBonus = referral.creditBonusCents || 0;
    const trialDays = referral.trialDaysBonus || 7;

    // Grant trial extension and credit bonus to referred user (increment credits, don't overwrite)
    await db
      .update(users)
      .set({
        accountCreditsCents: sql`COALESCE(account_credits_cents, 0) + ${creditBonus}`,
        trialExtendedDays: trialDays,
      })
      .where(eq(users.id, userId));

    // Grant credit bonus to referrer (increment, don't overwrite)
    if (creditBonus > 0) {
      await db
        .update(users)
        .set({
          accountCreditsCents: sql`COALESCE(account_credits_cents, 0) + ${creditBonus}`,
        })
        .where(eq(users.id, referral.referredByUserId));
    }

    return c.json({
      success: true,
      message: "Referral applied successfully",
      bonus: `${trialDays} extra trial days granted`,
    });
  } catch (error) {
    console.error("Error applying referral:", error);
    return c.json({ error: "Failed to apply referral code" }, 500);
  }
});

export { router as referralRoutes };
