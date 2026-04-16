import { Hono } from "hono";
import type { Env } from "../types";
import { createDb } from "../lib/db";
import { createAuth } from "../lib/auth";
import { notifications } from "@nichestream/db";
import { eq, and, ne } from "drizzle-orm";

const notificationsRouter = new Hono<{ Bindings: Env }>();

/**
 * GET /api/notifications
 * Returns all pending and shown notifications for the authenticated user
 * Marks pending notifications as 'shown' on fetch
 */
notificationsRouter.get("/", async (c) => {
  const db = createDb(c.env);
  const auth = createAuth(db, c.env);
  const session = await auth.api.getSession({ headers: c.req.raw.headers });

  if (!session?.user?.id) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  const userId = session.user.id;

  try {
    // Fetch pending notifications (not yet dismissed or actioned)
    const userNotifications = await db
      .select()
      .from(notifications)
      .where(
        and(
          eq(notifications.userId, userId),
          ne(notifications.status, "dismissed"),
          ne(notifications.status, "actioned")
        )
      )
      .orderBy(notifications.priority, notifications.createdAt);

    // Update pending notifications to 'shown' status
    const pendingNotifs = userNotifications.filter(
      (n) => n.status === "pending"
    );

    if (pendingNotifs.length > 0) {
      await Promise.all(
        pendingNotifs.map((notif) =>
          db
            .update(notifications)
            .set({ status: "shown" })
            .where(eq(notifications.id, notif.id))
        )
      );
    }

    return c.json(userNotifications);
  } catch (error) {
    console.error("Error fetching notifications:", error);
    return c.json({ error: "Failed to fetch notifications" }, 500);
  }
});

/**
 * POST /api/notifications/:id/dismiss
 * Mark a notification as dismissed by the user
 */
notificationsRouter.post("/:id/dismiss", async (c) => {
  const auth = createAuth(createDb(c.env), c.env);
  const session = await auth.api.getSession({ headers: c.req.raw.headers });

  if (!session?.user?.id) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  const notificationId = c.req.param("id");
  const userId = session.user.id;
  const db = createDb(c.env);

  try {
    // Verify the notification belongs to this user before dismissing
    const [notif] = await db
      .select()
      .from(notifications)
      .where(
        and(
          eq(notifications.id, notificationId),
          eq(notifications.userId, userId)
        )
      )
      .limit(1);

    if (!notif) {
      return c.json({ error: "Notification not found" }, 404);
    }

    await db
      .update(notifications)
      .set({ status: "dismissed", dismissedAt: new Date() })
      .where(eq(notifications.id, notificationId));

    return c.json({ success: true });
  } catch (error) {
    console.error("Error dismissing notification:", error);
    return c.json({ error: "Failed to dismiss notification" }, 500);
  }
});

/**
 * POST /api/notifications/:id/action
 * Mark notification as actioned (user clicked CTA)
 */
notificationsRouter.post("/:id/action", async (c) => {
  const auth = createAuth(createDb(c.env), c.env);
  const session = await auth.api.getSession({ headers: c.req.raw.headers });

  if (!session?.user?.id) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  const notificationId = c.req.param("id");
  const userId = session.user.id;
  const db = createDb(c.env);

  try {
    // Verify the notification belongs to this user
    const [notif] = await db
      .select()
      .from(notifications)
      .where(
        and(
          eq(notifications.id, notificationId),
          eq(notifications.userId, userId)
        )
      )
      .limit(1);

    if (!notif) {
      return c.json({ error: "Notification not found" }, 404);
    }

    await db
      .update(notifications)
      .set({ status: "actioned", actionedAt: new Date() })
      .where(eq(notifications.id, notificationId));

    return c.json({ success: true });
  } catch (error) {
    console.error("Error marking notification as actioned:", error);
    return c.json({ error: "Failed to mark notification as actioned" }, 500);
  }
});

export { notificationsRouter as notificationRoutes };
