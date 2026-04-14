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
import { eq } from "drizzle-orm";
import { createDb } from "../lib/db";
import { createAuth } from "../lib/auth";
import type { Env } from "../types";
import { users } from "@nichestream/db";

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

    const referralCode = `${user.username}_${Math.random().toString(36).slice(2, 8).toUpperCase()}`;

    // TODO: Insert into referrals table when schema is ready
    // await db.insert(referrals).values({
    //   referred_by_user_id: userId,
    //   referral_code: referralCode,
    // });

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

    const _userId = session.user.id;

    // TODO: Query referrals table
    // const referral = await db.query.referrals.findFirst({
    //   where: (referrals, { eq }) => eq(referrals.referred_by_user_id, userId),
    // });

    // For now, return placeholder
    return c.json({
      referral_code: "placeholder_code",
      share_url: `${c.env.APP_BASE_URL}?ref=placeholder_code`,
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
 *   total_clicks: 42,
 *   total_signups: 12,
 *   total_conversions: 3,
 *   conversion_rate: 0.25,
 *   total_bonuses_earned_cents: 1500
 * }
 */
router.get("/stats", async (c) => {
  try {
    const _db = createDb(c.env);
    const auth = createAuth(_db, c.env);
    const session = await auth.api.getSession({ headers: c.req.raw.headers });

    if (!session) {
      return c.json({ error: "Unauthorized" }, 401);
    }

    // TODO: Query referral stats from database
    // Implement aggregation query on referrals table

    return c.json({
      total_clicks: 0,
      total_signups: 0,
      total_conversions: 0,
      conversion_rate: 0,
      total_bonuses_earned_cents: 0,
    });
  } catch (error) {
    console.error("Error fetching referral stats:", error);
    return c.json({ error: "Failed to fetch referral stats" }, 500);
  }
});

/**
 * POST /api/referrals/apply
 * Apply a referral code during sign-up
 * 
 * Request:
 * { referral_code: "user_123_ABC123", user_id: "new_user_id" }
 * 
 * Side effects:
 * - Validate referral code exists and is not expired
 * - Grant both users 7 extra trial days OR credit bonus
 * - Create earning records for both users
 */
router.post("/apply", async (c) => {
  try {
    const { referral_code, user_id } = await c.req.json<{
      referral_code: string;
      user_id: string;
    }>();

    if (!referral_code || !user_id) {
      return c.json({ error: "Missing referral_code or user_id" }, 400);
    }

    const _db = createDb(c.env);

    // TODO: Implement referral application logic
    // 1. Query referrals table for matching code
    // 2. Validate not expired
    // 3. Update users trial_extended_days for both referrer and referee
    // 4. Create earnings records with type='referral_bonus'
    // 5. Return success

    return c.json({
      success: true,
      message: "Referral applied successfully",
      bonus: "7 extra trial days for you and your friend",
    });
  } catch (error) {
    console.error("Error applying referral:", error);
    return c.json({ error: "Failed to apply referral code" }, 500);
  }
});

export default router;
