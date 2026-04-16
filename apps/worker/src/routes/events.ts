import { Hono } from "hono";
import { eq, and, ilike, gte, lte, desc } from "drizzle-orm";
import type { Env } from "../types";
import { createDb } from "../lib/db";
import { requireAdmin } from "../middleware/admin";
import { events, videos } from "@nichestream/db";

const eventsRouter = new Hono<{ Bindings: Env }>();

/**
 * GET /events
 * List active BlerdCon events and community events.
 * Filters by date range, searchable by name/slug.
 * Query params: ?search=&startAfter=ISO8601&endBefore=ISO8601&limit=50&offset=0
 */
eventsRouter.get("/", async (c) => {
  const db = createDb(c.env);

  const search = c.req.query("search") || "";
  const startAfter = c.req.query("startAfter");
  const endBefore = c.req.query("endBefore");
  const limit = Math.min(parseInt(c.req.query("limit") || "50"), 100);
  const offset = parseInt(c.req.query("offset") || "0");

  try {
    const whereConditions = [];

    // Search by name or slug (case-insensitive)
    if (search) {
      whereConditions.push(ilike(events.name, `%${search}%`));
    }

    // Date range filters — validate ISO 8601 strings before use
    if (startAfter) {
      const startDate = new Date(startAfter);
      if (isNaN(startDate.getTime())) {
        return c.json({ error: "BadRequest", message: "Invalid startAfter date" }, 400);
      }
      whereConditions.push(gte(events.startDate, startDate));
    }
    if (endBefore) {
      const endDate = new Date(endBefore);
      if (isNaN(endDate.getTime())) {
        return c.json({ error: "BadRequest", message: "Invalid endBefore date" }, 400);
      }
      whereConditions.push(lte(events.startDate, endDate));
    }

    const results = await db
      .select()
      .from(events)
      .where(whereConditions.length > 0 ? and(...whereConditions) : undefined)
      .orderBy(desc(events.startDate))
      .limit(limit)
      .offset(offset);

    return c.json({
      success: true,
      events: results,
      pagination: { limit, offset, count: results.length },
    });
  } catch (err) {
    console.error("GET /events error:", err);
    return c.json(
      { error: "InternalError", message: "Failed to fetch events" },
      500
    );
  }
});

/**
 * GET /events/:slug
 * Get single event by slug with associated videos.
 */
eventsRouter.get("/:slug", async (c) => {
  const db = createDb(c.env);
  const slug = c.req.param("slug");

  try {
    const [event] = await db
      .select()
      .from(events)
      .where(eq(events.slug, slug))
      .limit(1);

    if (!event) {
      return c.json({ error: "NotFound", message: "Event not found" }, 404);
    }

    // Fetch videos tagged with this event
    const eventVideos = await db
      .select()
      .from(videos)
      .where(eq(videos.eventId, event.id))
      .orderBy(desc(videos.createdAt));

    return c.json({
      success: true,
      event: {
        ...event,
        videoCount: eventVideos.length,
      },
      videos: eventVideos,
    });
  } catch (err) {
    console.error(`GET /events/:${slug} error:`, err);
    return c.json(
      { error: "InternalError", message: "Failed to fetch event" },
      500
    );
  }
});

/**
 * POST /events (ADMIN)
 * Create new event. Requires admin role.
 * Body: { name, slug, description, startDate, endDate }
 */
eventsRouter.post("/", requireAdmin(), async (c) => {
  const db = createDb(c.env);

  const body = await c.req.json<{
    name: string;
    slug: string;
    description: string;
    startDate: string;
    endDate: string;
  }>();

  if (!body.name || !body.slug || !body.startDate || !body.endDate) {
    return c.json(
      { error: "BadRequest", message: "Missing required fields" },
      400
    );
  }

  const parsedStart = new Date(body.startDate);
  const parsedEnd = new Date(body.endDate);
  if (isNaN(parsedStart.getTime()) || isNaN(parsedEnd.getTime())) {
    return c.json({ error: "BadRequest", message: "Invalid date format" }, 400);
  }

  try {
    const [created] = await db
      .insert(events)
      .values({
        name: body.name,
        slug: body.slug,
        description: body.description || null,
        startDate: parsedStart,
        endDate: parsedEnd,
      })
      .returning();

    return c.json({
      success: true,
      message: "Event created",
      event: created,
    });
  } catch (err) {
    console.error("POST /events error:", err);
    if (err instanceof Error && err.message.includes("unique")) {
      return c.json(
        {
          error: "Conflict",
          message: "Event slug already exists",
        },
        409
      );
    }
    return c.json(
      { error: "InternalError", message: "Failed to create event" },
      500
    );
  }
});

export { eventsRouter as eventsRoutes };
