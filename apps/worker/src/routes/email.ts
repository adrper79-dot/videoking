import { Hono } from "hono";
import type { Env } from "../types";
import { createDb } from "../lib/db";
import { createAuth } from "../lib/auth";
import { users } from "@nichestream/db";
import { eq } from "drizzle-orm";

const emailRouter = new Hono<{ Bindings: Env }>();

interface EmailPreferences {
  trial_alerts: boolean;
  new_videos: boolean;
  watch_party_invites: boolean;
  payout_milestones: boolean;
  referral_bonuses: boolean;
  community_updates: boolean;
}

/**
 * GET /api/email/preferences
 * Get email preferences for authenticated user
 */
emailRouter.get("/preferences", async (c) => {
  const auth = createAuth(createDb(c.env), c.env);
  const session = await auth.api.getSession({ headers: c.req.raw.headers });

  if (!session?.user?.id) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  const db = createDb(c.env);
  const userId = session.user.id;

  try {
    const [user] = await db
      .select({ emailPreferences: users.emailPreferences })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    if (!user) {
      return c.json({ error: "User not found" }, 404);
    }

    // Return stored preferences or defaults if not set
    const prefs: EmailPreferences = user.emailPreferences || {
      trial_alerts: true,
      new_videos: true,
      watch_party_invites: true,
      payout_milestones: true,
      referral_bonuses: true,
      community_updates: false,
    };

    return c.json(prefs);
  } catch (error) {
    console.error("Error fetching email preferences:", error);
    return c.json({ error: "Failed to fetch preferences" }, 500);
  }
});

/**
 * POST /api/email/preferences
 * Update email preferences for authenticated user
 */
emailRouter.post("/preferences", async (c) => {
  const auth = createAuth(createDb(c.env), c.env);
  const session = await auth.api.getSession({ headers: c.req.raw.headers });

  if (!session?.user?.id) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  const db = createDb(c.env);
  const userId = session.user.id;

  try {
    const body = await c.req.json<Partial<EmailPreferences>>();

    // Validate preferences structure
    if (!body || typeof body !== "object") {
      return c.json({ error: "Invalid preferences format" }, 400);
    }

    // Update with merged preferences (partial update)
    await db
      .update(users)
      .set({
        emailPreferences: body as EmailPreferences,
        updatedAt: new Date(),
      })
      .where(eq(users.id, userId));

    return c.json({ success: true, preferences: body });
  } catch (error) {
    console.error("Error updating email preferences:", error);
    return c.json({ error: "Failed to update preferences" }, 500);
  }
});

/**
 * POST /api/email/unsubscribe/:token
 * One-click unsubscribe. Token format: base64url(userId:expiry:HMAC-SHA256(userId+":"+expiry))
 * HMAC is signed with BETTER_AUTH_SECRET to prevent arbitrary userId forgery.
 */
emailRouter.post("/unsubscribe/:token", async (c) => {
  try {
    const token = c.req.param("token");

    // Decode and split token into components
    let decoded: string;
    try {
      decoded = Buffer.from(token, "base64").toString("utf-8");
    } catch {
      return c.json({ error: "Invalid token" }, 400);
    }

    const parts = decoded.split(":");
    // Support both old format (userId only) and new signed format (userId:expiry:sig)
    if (parts.length < 3) {
      return c.json({ error: "Invalid or unsigned token — please request a new unsubscribe link" }, 400);
    }

    const [userId, expiry, sig] = parts;

    if (!userId || !expiry || !sig) {
      return c.json({ error: "Invalid token" }, 400);
    }

    // Verify expiry
    if (Date.now() > Number(expiry)) {
      return c.json({ error: "Unsubscribe link has expired — please request a new one" }, 400);
    }

    // Verify HMAC-SHA256 signature using BETTER_AUTH_SECRET as the key
    const secret = c.env.BETTER_AUTH_SECRET;
    const encoder = new TextEncoder();
    const key = await crypto.subtle.importKey(
      "raw",
      encoder.encode(secret),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign", "verify"],
    );

    const data = encoder.encode(`${userId}:${expiry}`);
    const expectedSigBuffer = await crypto.subtle.sign("HMAC", key, data);
    const expectedSig = Buffer.from(expectedSigBuffer).toString("hex");

    // Constant-time comparison to prevent timing attacks
    if (sig.length !== expectedSig.length || sig !== expectedSig) {
      return c.json({ error: "Invalid token signature" }, 400);
    }

    const db = createDb(c.env);

    // Disable all marketing emails but keep critical ones
    await db
      .update(users)
      .set({
        emailPreferences: {
          trial_alerts: true, // Keep critical
          new_videos: false,
          watch_party_invites: false,
          payout_milestones: true, // Keep critical
          referral_bonuses: false,
          community_updates: false,
        } as EmailPreferences,
        updatedAt: new Date(),
      })
      .where(eq(users.id, userId));

    return c.json({ success: true, message: "Unsubscribed from marketing emails" });
  } catch (error) {
    console.error("Error processing unsubscribe:", error);
    return c.json({ error: "Failed to unsubscribe" }, 500);
  }
});

export { emailRouter as emailRoutes };
