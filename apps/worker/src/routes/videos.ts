import { Hono } from "hono";
import { eq, desc, and, sql, ilike, or } from "drizzle-orm";
import type { Env } from "../types";
import { createDb } from "../lib/db";
import { createAuth } from "../lib/auth";
import { getUserEntitlements } from "../lib/entitlements";
import { getDirectUploadUrl, getSignedStreamUrl } from "../lib/stream";
import { subscriptions, users, videoUnlocks, videos, videoStyleEnum, videoToolEnum, videoGenreEnum } from "@nichestream/db";

const videosRouter = new Hono<{ Bindings: Env }>();

// Valid enums for filter allowlisting
const VALID_STYLES = new Set(["digital", "traditional", "mixed_media", "3d"]);
const VALID_TOOLS = new Set(["procreate", "clip_studio", "photoshop", "krita", "affinity", "blender", "maya", "traditional_media", "other"]);
const VALID_GENRES = new Set(["animation", "comic", "illustration", "character_design", "concept_art", "afro_fantasy", "sci_fi", "animation_short", "process_video", "tutorial", "speedart", "other"]);

/**
 * GET /api/videos
 * List videos with pagination and optional BlerdArt discovery filters.
 *
 * Optional query params:
 *   style  — art style enum (validated against allowlist)
 *   tool   — tool enum (validated against allowlist)
 *   genre  — genre enum (validated against allowlist)
 *   search — full-text search on title/description (≤200 chars)
 */
videosRouter.get("/", async (c) => {
  const db = createDb(c.env);
  const page = Math.max(1, Number(c.req.query("page") ?? 1));
  const pageSize = Math.min(50, Math.max(1, Number(c.req.query("pageSize") ?? 20)));
  const offset = (page - 1) * pageSize;

  // Validated discovery filters
  const rawStyle = c.req.query("style");
  const rawTool = c.req.query("tool");
  const rawGenre = c.req.query("genre");
  const rawSearch = (c.req.query("search") ?? "").trim().slice(0, 200);

  const styleFilter = rawStyle && VALID_STYLES.has(rawStyle) ? rawStyle : undefined;
  const toolFilter = rawTool && VALID_TOOLS.has(rawTool) ? rawTool : undefined;
  const genreFilter = rawGenre && VALID_GENRES.has(rawGenre) ? rawGenre : undefined;

  try {
    // Build WHERE conditions
    const conditions = [
      eq(videos.status, "ready"),
      eq(videos.visibility, "public"),
      ...(styleFilter ? [eq(videos.style, styleFilter as (typeof videoStyleEnum.enumValues)[number])] : []),
      ...(toolFilter ? [eq(videos.tool, toolFilter as (typeof videoToolEnum.enumValues)[number])] : []),
      ...(genreFilter ? [eq(videos.genre, genreFilter as (typeof videoGenreEnum.enumValues)[number])] : []),
      ...(rawSearch ? [or(ilike(videos.title, `%${rawSearch}%`), ilike(videos.description, `%${rawSearch}%`))] : []),
    ];

    // Use COUNT(*) window function to avoid 2 separate queries
    const rowsWithCount = await db
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
        totalCount: sql<number>`count(*) over ()`,
      })
      .from(videos)
      .leftJoin(users, eq(videos.creatorId, users.id))
      .where(and(...conditions))
      .orderBy(desc(videos.publishedAt))
      .limit(pageSize)
      .offset(offset);

    const totalCount = rowsWithCount.length > 0 ? rowsWithCount[0].totalCount : 0;
    const rows = rowsWithCount.map(({ totalCount: _, ...row }) => row);

    return c.json({
      data: rows,
      total: totalCount,
      page,
      pageSize,
      hasMore: offset + pageSize < totalCount,
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
        const entitlements = await getUserEntitlements(db, session.user.id, c.env);
        let hasAccess = entitlements?.user?.effectiveTier !== "free";

        if (video.visibility === "subscribers_only" && !hasAccess) {
          const [subscription] = await db
            .select({ id: subscriptions.id })
            .from(subscriptions)
            .where(
              and(
                eq(subscriptions.subscriberId, session.user.id),
                eq(subscriptions.creatorId, video.creatorId),
                eq(subscriptions.status, "active"),
              ),
            )
            .limit(1);

          hasAccess = Boolean(subscription);
        }

        if (video.visibility === "unlocked_only" && !hasAccess) {
          const [unlock] = await db
            .select({ id: videoUnlocks.id })
            .from(videoUnlocks)
            .where(
              and(
                eq(videoUnlocks.videoId, video.id),
                eq(videoUnlocks.userId, session.user.id),
              ),
            )
            .limit(1);

          hasAccess = Boolean(unlock);
        }

        if (!hasAccess) {
          return c.json({ error: "Forbidden", message: "Access denied" }, 403);
        }
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
      streamCustomerDomain: c.env.STREAM_CUSTOMER_DOMAIN ?? null,
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

    // Validate title is not blank if provided
    if (body.title !== undefined && body.title.trim().length === 0) {
      return c.json({ error: "BadRequest", message: "Title cannot be blank" }, 400);
    }

    // Validate enum values
    const VALID_VISIBILITY = new Set(["public", "subscribers_only", "unlocked_only"]);
    const VALID_STATUS = new Set(["ready", "unlisted"]);
    if (body.visibility !== undefined && !VALID_VISIBILITY.has(body.visibility)) {
      return c.json({ error: "BadRequest", message: "Invalid visibility value" }, 400);
    }
    if (body.status !== undefined && !VALID_STATUS.has(body.status)) {
      return c.json({ error: "BadRequest", message: "Invalid status value" }, 400);
    }

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
