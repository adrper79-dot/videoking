import { Hono } from "hono";
import { eq, desc, and, sql } from "drizzle-orm";
import type { Env } from "../types";
import { createDb } from "../lib/db";
import { createAuth } from "../lib/auth";
import { getDirectUploadUrl, getSignedStreamUrl } from "../lib/stream";
import { videos, users } from "@nichestream/db";

const videosRouter = new Hono<{ Bindings: Env }>();

/**
 * GET /api/videos
 * List videos with pagination and optional status/visibility filtering.
 */
videosRouter.get("/", async (c) => {
  const db = createDb(c.env);
  const page = Math.max(1, Number(c.req.query("page") ?? 1));
  const pageSize = Math.min(50, Math.max(1, Number(c.req.query("pageSize") ?? 20)));
  const offset = (page - 1) * pageSize;

  try {
    const rows = await db
      .select({
        id: videos.id,
        creatorId: videos.creatorId,
        cloudflareStreamId: videos.cloudflareStreamId,
        title: videos.title,
        description: videos.description,
        thumbnailUrl: videos.thumbnailUrl,
        durationSeconds: videos.durationSeconds,
        status: videos.status,
        visibility: videos.visibility,
        viewsCount: videos.viewsCount,
        likesCount: videos.likesCount,
        createdAt: videos.createdAt,
        publishedAt: videos.publishedAt,
        creatorUsername: users.username,
        creatorDisplayName: users.displayName,
        creatorAvatarUrl: users.avatarUrl,
      })
      .from(videos)
      .leftJoin(users, eq(videos.creatorId, users.id))
      .where(and(eq(videos.status, "ready"), eq(videos.visibility, "public")))
      .orderBy(desc(videos.publishedAt))
      .limit(pageSize)
      .offset(offset);

    const [{ count }] = await db
      .select({ count: sql<number>`count(*)` })
      .from(videos)
      .where(and(eq(videos.status, "ready"), eq(videos.visibility, "public")));

    return c.json({
      data: rows,
      total: Number(count),
      page,
      pageSize,
      hasMore: offset + pageSize < Number(count),
    });
  } catch (err) {
    console.error("GET /api/videos error:", err);
    return c.json({ error: "InternalError", message: "Failed to fetch videos" }, 500);
  }
});

/**
 * GET /api/videos/:id
 * Get a single video's details. For private videos, verifies access.
 */
videosRouter.get("/:id", async (c) => {
  const db = createDb(c.env);
  const videoId = c.req.param("id");

  try {
    const [row] = await db
      .select()
      .from(videos)
      .leftJoin(users, eq(videos.creatorId, users.id))
      .where(eq(videos.id, videoId))
      .limit(1);

    if (!row) {
      return c.json({ error: "NotFound", message: "Video not found" }, 404);
    }

    const video = row.videos;
    const creator = row.users;

    // For non-public videos, check access
    if (video.visibility !== "public") {
      const auth = createAuth(db, c.env);
      const session = await auth.api.getSession({ headers: c.req.raw.headers });

      if (!session?.user) {
        return c.json({ error: "Unauthorized", message: "Authentication required" }, 401);
      }

      // Creator always has access
      if (session.user.id !== video.creatorId) {
        // TODO: check subscription / unlock status
        return c.json({ error: "Forbidden", message: "Access denied" }, 403);
      }
    }

    // Generate signed playback URL for protected content
    let playbackUrl: string | null = null;
    if (video.visibility !== "public") {
      try {
        playbackUrl = await getSignedStreamUrl(c.env, video.cloudflareStreamId);
      } catch {
        playbackUrl = null;
      }
    }

    // Increment view count asynchronously
    void db
      .update(videos)
      .set({ viewsCount: sql`${videos.viewsCount} + 1` })
      .where(eq(videos.id, videoId));

    return c.json({
      ...video,
      playbackUrl,
      creator: creator
        ? {
            id: creator.id,
            username: creator.username,
            displayName: creator.displayName,
            avatarUrl: creator.avatarUrl,
          }
        : null,
    });
  } catch (err) {
    console.error("GET /api/videos/:id error:", err);
    return c.json({ error: "InternalError", message: "Failed to fetch video" }, 500);
  }
});

/**
 * POST /api/videos/upload-url
 * Returns a Cloudflare Stream direct upload URL for the authenticated creator.
 */
videosRouter.post("/upload-url", async (c) => {
  const db = createDb(c.env);
  const auth = createAuth(db, c.env);

  const session = await auth.api.getSession({ headers: c.req.raw.headers });
  if (!session?.user) {
    return c.json({ error: "Unauthorized", message: "Authentication required" }, 401);
  }

  try {
    const body = await c.req.json<{ maxDurationSeconds?: number }>();
    const maxDuration = Math.min(body.maxDurationSeconds ?? 3600, 21600);

    const { uploadUrl, streamVideoId } = await getDirectUploadUrl(c.env, maxDuration);

    // Pre-create the video record so we can track it
    const [newVideo] = await db
      .insert(videos)
      .values({
        creatorId: session.user.id,
        cloudflareStreamId: streamVideoId,
        title: "Untitled Video",
        status: "processing",
        visibility: "public",
      })
      .returning({ id: videos.id });

    return c.json({
      uploadUrl,
      videoId: newVideo?.id,
      streamVideoId,
    });
  } catch (err) {
    console.error("POST /api/videos/upload-url error:", err);
    return c.json({ error: "InternalError", message: "Failed to create upload URL" }, 500);
  }
});

/**
 * PATCH /api/videos/:id
 * Update video metadata (title, description, visibility, etc.).
 */
videosRouter.patch("/:id", async (c) => {
  const db = createDb(c.env);
  const auth = createAuth(db, c.env);
  const videoId = c.req.param("id");

  const session = await auth.api.getSession({ headers: c.req.raw.headers });
  if (!session?.user) {
    return c.json({ error: "Unauthorized", message: "Authentication required" }, 401);
  }

  try {
    const [existing] = await db
      .select()
      .from(videos)
      .where(eq(videos.id, videoId))
      .limit(1);

    if (!existing) {
      return c.json({ error: "NotFound", message: "Video not found" }, 404);
    }

    if (existing.creatorId !== session.user.id) {
      return c.json({ error: "Forbidden", message: "Not your video" }, 403);
    }

    const body = await c.req.json<{
      title?: string;
      description?: string;
      visibility?: "public" | "subscribers_only" | "unlocked_only";
      status?: "ready" | "unlisted";
    }>();

    const [updated] = await db
      .update(videos)
      .set({
        ...(body.title !== undefined && { title: body.title.trim().slice(0, 200) }),
        ...(body.description !== undefined && { description: body.description.trim().slice(0, 5000) }),
        ...(body.visibility !== undefined && { visibility: body.visibility }),
        ...(body.status !== undefined && { status: body.status }),
        updatedAt: new Date(),
        ...(body.status === "ready" && { publishedAt: new Date() }),
      })
      .where(eq(videos.id, videoId))
      .returning();

    return c.json(updated);
  } catch (err) {
    console.error("PATCH /api/videos/:id error:", err);
    return c.json({ error: "InternalError", message: "Failed to update video" }, 500);
  }
});

/**
 * DELETE /api/videos/:id
 * Soft-delete a video (sets status to "deleted").
 */
videosRouter.delete("/:id", async (c) => {
  const db = createDb(c.env);
  const auth = createAuth(db, c.env);
  const videoId = c.req.param("id");

  const session = await auth.api.getSession({ headers: c.req.raw.headers });
  if (!session?.user) {
    return c.json({ error: "Unauthorized", message: "Authentication required" }, 401);
  }

  try {
    const [existing] = await db
      .select()
      .from(videos)
      .where(eq(videos.id, videoId))
      .limit(1);

    if (!existing) {
      return c.json({ error: "NotFound", message: "Video not found" }, 404);
    }

    if (existing.creatorId !== session.user.id) {
      return c.json({ error: "Forbidden", message: "Not your video" }, 403);
    }

    await db
      .update(videos)
      .set({ status: "deleted", updatedAt: new Date() })
      .where(eq(videos.id, videoId));

    return c.json({ success: true });
  } catch (err) {
    console.error("DELETE /api/videos/:id error:", err);
    return c.json({ error: "InternalError", message: "Failed to delete video" }, 500);
  }
});

export { videosRouter as videoRoutes };
