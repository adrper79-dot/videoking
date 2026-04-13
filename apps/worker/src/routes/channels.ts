import { Hono } from "hono";
import { eq, desc, and } from "drizzle-orm";
import type { Env } from "../types";
import { createDb } from "../lib/db";
import { createAuth } from "../lib/auth";
import { users, videos, subscriptions } from "@nichestream/db";

const channelsRouter = new Hono<{ Bindings: Env }>();

/**
 * GET /api/channels/:username
 * Get public channel profile with recent videos.
 */
channelsRouter.get("/:username", async (c) => {
  const db = createDb(c.env);
  const username = c.req.param("username").toLowerCase();

  try {
    const [creator] = await db
      .select({
        id: users.id,
        username: users.username,
        displayName: users.displayName,
        avatarUrl: users.avatarUrl,
        bio: users.bio,
        website: users.website,
        role: users.role,
        createdAt: users.createdAt,
      })
      .from(users)
      .where(eq(users.username, username))
      .limit(1);

    if (!creator) {
      return c.json({ error: "NotFound", message: "Channel not found" }, 404);
    }

    const recentVideos = await db
      .select()
      .from(videos)
      .where(eq(videos.creatorId, creator.id))
      .orderBy(desc(videos.publishedAt))
      .limit(12);

    return c.json({ creator, videos: recentVideos });
  } catch (err) {
    console.error("GET /api/channels/:username error:", err);
    return c.json({ error: "InternalError", message: "Failed to fetch channel" }, 500);
  }
});

/**
 * GET /api/channels/:username/subscription-status
 * Returns whether the current authenticated user is subscribed to this channel.
 */
channelsRouter.get("/:username/subscription-status", async (c) => {
  const db = createDb(c.env);
  const auth = createAuth(db, c.env);
  const username = c.req.param("username").toLowerCase();

  const session = await auth.api.getSession({ headers: c.req.raw.headers });
  if (!session?.user) {
    return c.json({ subscribed: false });
  }

  try {
    const [creator] = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.username, username))
      .limit(1);

    if (!creator) {
      return c.json({ subscribed: false });
    }

    const [sub] = await db
      .select()
      .from(subscriptions)
      .where(
        and(
          eq(subscriptions.subscriberId, session.user.id),
          eq(subscriptions.creatorId, creator.id),
        ),
      )
      .limit(1);

    return c.json({
      subscribed: !!sub && sub.status === "active",
      subscription: sub ?? null,
    });
  } catch (err) {
    console.error("GET /api/channels/:username/subscription-status error:", err);
    return c.json({ subscribed: false });
  }
});

export { channelsRouter as channelRoutes };
