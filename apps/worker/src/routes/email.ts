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
 * One-click unsubscribe (token-based for email links)
 * Token would be: base64(userId:timestamp:signature)
 */
emailRouter.post("/unsubscribe/:token", async (c) => {
  // This is a simplified version - production would verify signature
  try {
    const token = c.req.param("token");
    // Decode token to get userId
    const decoded = Buffer.from(token, "base64").toString("utf-8");
    const [userId] = decoded.split(":");

    if (!userId) {
      return c.json({ error: "Invalid token" }, 400);
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
