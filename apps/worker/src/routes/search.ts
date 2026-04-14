/**
 * Search Routes
 *
 * GET /api/search?q=&type=all|videos|creators&page=1&pageSize=20
 *
 * Returns matched public videos and/or creator profiles.
 * Results are case-insensitive, matching on title/description/tags for videos
 * and username/displayName/bio for creators.
 */
import { Hono } from "hono";
import { ilike, or, and, eq, desc, sql } from "drizzle-orm";
import type { Env } from "../types";
import { createDb } from "../lib/db";
import { videos, users } from "@nichestream/db";

const router = new Hono<{ Bindings: Env }>();

const MAX_PAGE_SIZE = 50;
const DEFAULT_PAGE_SIZE = 20;

/**
 * GET /
 * Search videos and/or creator profiles.
 *
 * Query params:
 *   q        — required, search term (1–200 chars after trim)
 *   type     — "all" | "videos" | "creators" (default: "all")
 *   page     — 1-based page number (default: 1)
 *   pageSize — results per section, 1–50 (default: 20)
 */
router.get("/", async (c) => {
  const rawQ = (c.req.query("q") ?? "").trim();
  const type = c.req.query("type") ?? "all";
  const page = Math.max(1, parseInt(c.req.query("page") ?? "1", 10) || 1);
  const pageSize = Math.min(
    MAX_PAGE_SIZE,
    Math.max(1, parseInt(c.req.query("pageSize") ?? String(DEFAULT_PAGE_SIZE), 10) || DEFAULT_PAGE_SIZE),
  );

  if (!rawQ || rawQ.length < 1) {
    return c.json({ error: "BadRequest", message: "Query parameter 'q' is required" }, 400);
  }
  if (rawQ.length > 200) {
    return c.json({ error: "BadRequest", message: "Query parameter 'q' must be 200 characters or less" }, 400);
  }
  if (!["all", "videos", "creators"].includes(type)) {
    return c.json({ error: "BadRequest", message: "Parameter 'type' must be 'all', 'videos', or 'creators'" }, 400);
  }

  const db = createDb(c.env);
  const offset = (page - 1) * pageSize;
  const pattern = `%${rawQ}%`;

  try {
    const [videoResults, creatorResults] = await Promise.all([
      // ── Video search ─────────────────────────────────────────────────────────
      type !== "creators"
        ? db
            .select({
              id: videos.id,
              title: videos.title,
              description: videos.description,
              thumbnailUrl: videos.thumbnailUrl,
              durationSeconds: videos.durationSeconds,
              viewsCount: videos.viewsCount,
              creatorId: videos.creatorId,
              publishedAt: videos.publishedAt,
              tags: videos.tags,
              style: videos.style,
              genre: videos.genre,
            })
            .from(videos)
            .where(
              and(
                eq(videos.status, "ready"),
                eq(videos.visibility, "public"),
                or(
                  ilike(videos.title, pattern),
                  ilike(videos.description, pattern),
                  sql`${videos.tags}::text ilike ${pattern}`,
                ),
              ),
            )
            .orderBy(desc(videos.viewsCount))
            .limit(pageSize)
            .offset(offset)
        : Promise.resolve([]),

      // ── Creator search ───────────────────────────────────────────────────────
      type !== "videos"
        ? db
            .select({
              id: users.id,
              username: users.username,
              displayName: users.displayName,
              avatarUrl: users.avatarUrl,
              bio: users.bio,
            })
            .from(users)
            .where(
              and(
                eq(users.role, "creator"),
                or(
                  ilike(users.username, pattern),
                  ilike(users.displayName, pattern),
                  ilike(users.bio, pattern),
                ),
              ),
            )
            .orderBy(desc(users.createdAt))
            .limit(pageSize)
            .offset(offset)
        : Promise.resolve([]),
    ]);

    return c.json({
      query: rawQ,
      type,
      page,
      pageSize,
      videos: videoResults,
      creators: creatorResults,
    });
  } catch (err) {
    console.error("GET /api/search error:", err);
    return c.json({ error: "InternalError", message: "Search failed" }, 500);
  }
});

export default router;
