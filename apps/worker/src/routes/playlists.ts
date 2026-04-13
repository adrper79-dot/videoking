import { Hono } from "hono";
import { eq, and } from "drizzle-orm";
import type { Env } from "../types";
import { createDb } from "../lib/db";
import { createAuth } from "../lib/auth";
import { playlists, playlistVideos, videos } from "@nichestream/db";

const playlistsRouter = new Hono<{ Bindings: Env }>();

/**
 * GET /api/playlists
 * List all playlists for the authenticated creator.
 */
playlistsRouter.get("/", async (c) => {
  const db = createDb(c.env);
  const auth = createAuth(db, c.env);

  const session = await auth.api.getSession({ headers: c.req.raw.headers });
  if (!session?.user) {
    return c.json({ error: "Unauthorized", message: "Authentication required" }, 401);
  }

  try {
    const rows = await db
      .select()
      .from(playlists)
      .where(eq(playlists.creatorId, session.user.id));

    return c.json(rows);
  } catch (err) {
    console.error("GET /api/playlists error:", err);
    return c.json({ error: "InternalError", message: "Failed to fetch playlists" }, 500);
  }
});

/**
 * POST /api/playlists
 * Create a new playlist.
 */
playlistsRouter.post("/", async (c) => {
  const db = createDb(c.env);
  const auth = createAuth(db, c.env);

  const session = await auth.api.getSession({ headers: c.req.raw.headers });
  if (!session?.user) {
    return c.json({ error: "Unauthorized", message: "Authentication required" }, 401);
  }

  try {
    const body = await c.req.json<{ title: string; description?: string }>();

    if (!body.title?.trim()) {
      return c.json({ error: "ValidationError", message: "Title is required" }, 400);
    }

    const [playlist] = await db
      .insert(playlists)
      .values({
        creatorId: session.user.id,
        title: body.title.trim().slice(0, 200),
        description: body.description?.trim().slice(0, 1000),
      })
      .returning();

    return c.json(playlist, 201);
  } catch (err) {
    console.error("POST /api/playlists error:", err);
    return c.json({ error: "InternalError", message: "Failed to create playlist" }, 500);
  }
});

/**
 * GET /api/playlists/:id
 * Get playlist details with all videos.
 */
playlistsRouter.get("/:id", async (c) => {
  const db = createDb(c.env);
  const playlistId = c.req.param("id");

  try {
    const [playlist] = await db
      .select()
      .from(playlists)
      .where(eq(playlists.id, playlistId))
      .limit(1);

    if (!playlist) {
      return c.json({ error: "NotFound", message: "Playlist not found" }, 404);
    }

    const items = await db
      .select({ video: videos, position: playlistVideos.position })
      .from(playlistVideos)
      .innerJoin(videos, eq(playlistVideos.videoId, videos.id))
      .where(eq(playlistVideos.playlistId, playlistId))
      .orderBy(playlistVideos.position);

    return c.json({ ...playlist, videos: items.map((r) => ({ ...r.video, position: r.position })) });
  } catch (err) {
    console.error("GET /api/playlists/:id error:", err);
    return c.json({ error: "InternalError", message: "Failed to fetch playlist" }, 500);
  }
});

/**
 * POST /api/playlists/:id/videos
 * Add a video to a playlist.
 */
playlistsRouter.post("/:id/videos", async (c) => {
  const db = createDb(c.env);
  const auth = createAuth(db, c.env);
  const playlistId = c.req.param("id");

  const session = await auth.api.getSession({ headers: c.req.raw.headers });
  if (!session?.user) {
    return c.json({ error: "Unauthorized", message: "Authentication required" }, 401);
  }

  try {
    const [playlist] = await db
      .select()
      .from(playlists)
      .where(and(eq(playlists.id, playlistId), eq(playlists.creatorId, session.user.id)))
      .limit(1);

    if (!playlist) {
      return c.json({ error: "NotFound", message: "Playlist not found" }, 404);
    }

    const body = await c.req.json<{ videoId: string; position?: number }>();

    await db.insert(playlistVideos).values({
      playlistId,
      videoId: body.videoId,
      position: body.position ?? 0,
    });

    return c.json({ success: true }, 201);
  } catch (err) {
    console.error("POST /api/playlists/:id/videos error:", err);
    return c.json({ error: "InternalError", message: "Failed to add video to playlist" }, 500);
  }
});

export { playlistsRouter as playlistRoutes };
