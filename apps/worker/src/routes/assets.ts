import { Hono } from "hono";
import { eq, desc } from "drizzle-orm";
import type { Env } from "../types";
import { createDb } from "../lib/db";
import { createAuth } from "../lib/auth";
import { assets } from "@nichestream/db";
import { createR2 } from "../lib/r2";

const assetsRouter = new Hono<{ Bindings: Env }>();

/**
 * GET /assets
 * List creator assets by category (brushes, templates, backgrounds).
 * Query params: ?category=brushes&creatorId=&limit=50&offset=0&sort=recent
 */
assetsRouter.get("/", async (c) => {
  const db = createDb(c.env);

  const category = c.req.query("category");
  const creatorId = c.req.query("creatorId");
  const limit = Math.min(parseInt(c.req.query("limit") || "50"), 100);
  const offset = parseInt(c.req.query("offset") || "0");
  const sort = c.req.query("sort") || "recent";

  try {
    const whereConditions = [];

    if (category) {
      whereConditions.push(eq(assets.category, category));
    }

    if (creatorId) {
      whereConditions.push(eq(assets.creatorId, creatorId));
    }

    const sortOrder = sort === "popular" ? desc(assets.downloadCount) : desc(assets.createdAt);

    // For now, just execute the base query
    const allResults = await db.select().from(assets).orderBy(sortOrder).limit(limit).offset(offset);
    
    // Filter client-side (temporary until Drizzle query builder is fixed)
    const filtered = allResults.filter(asset => {
      if (category && asset.category !== category) return false;
      if (creatorId && asset.creatorId !== creatorId) return false;
      return true;
    });

    return c.json({
      success: true,
      assets: filtered,
      pagination: { limit, offset, count: filtered.length },
    });
  } catch (err) {
    console.error("GET /assets error:", err);
    return c.json(
      { error: "InternalError", message: "Failed to fetch assets" },
      500
    );
  }
});

/**
 * POST /assets
 * Upload creator asset. Requires auth session.
 * Body: FormData with file, filename, category, tags (optional JSON array)
 */
assetsRouter.post("/", async (c) => {
  const db = createDb(c.env);
  const auth = createAuth(db, c.env);
  const r2 = createR2(c.env);

  const session = await auth.api.getSession({ headers: c.req.raw.headers });
  if (!session?.user) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  try {
    const formData = await c.req.formData();
    // FormData.get() returns File | string | null; we validate and know it's File in this context
    const file = formData.get("file") as any;
    const category = formData.get("category");
    const tagsStr = formData.get("tags");
    const filename = formData.get("filename");

    // Type guard for required fields
    if (
      !file ||
      typeof file === "string" ||
      !category ||
      typeof category !== "string" ||
      !filename ||
      typeof filename !== "string"
    ) {
      return c.json(
        {
          error: "BadRequest",
          message: "file, category, and filename required",
        },
        400
      );
    }

    // Now file is safe to use as File-like object
    if (!file.size || file.size > 100 * 1024 * 1024) {
      return c.json(
        { error: "PayloadTooLarge", message: "File must be under 100MB" },
        413
      );
    }

    // Upload to R2
    const r2Path = `assets/${session.user.id}/${Date.now()}-${filename}`;
    await r2.putObject(
      r2Path,
      await file.arrayBuffer(),
      {
        httpMetadata: {
          contentType: file.type || "application/octet-stream",
        },
      }
    );

    const tags = tagsStr && typeof tagsStr === "string" ? JSON.parse(tagsStr) : [];

    // Store in database
    const [created] = await db
      .insert(assets)
      .values({
        creatorId: session.user.id,
        filename,
        category,
        tags,
        r2Path,
        downloadCount: 0,
      })
      .returning();

    return c.json({
      success: true,
      message: "Asset uploaded",
      asset: created,
    });
  } catch (err) {
    console.error("POST /assets error:", err);
    return c.json(
      { error: "InternalError", message: "Failed to upload asset" },
      500
    );
  }
});

/**
 * GET /assets/:assetId/download
 * Download creator asset (increment download counter).
 */
assetsRouter.get("/:assetId/download", async (c) => {
  const db = createDb(c.env);
  const r2 = createR2(c.env);
  const assetId = c.req.param("assetId");

  try {
    const [asset] = await db
      .select()
      .from(assets)
      .where(eq(assets.id, assetId))
      .limit(1);

    if (!asset) {
      return c.json({ error: "NotFound", message: "Asset not found" }, 404);
    }

    // Increment download count
    await db
      .update(assets)
      .set({ downloadCount: asset.downloadCount + 1 })
      .where(eq(assets.id, assetId));

    // Get download URL from R2
    const downloadUrl = await r2.getObjectUrl(asset.r2Path);

    return c.redirect(downloadUrl);
  } catch (err) {
    console.error(`GET /assets/:${assetId}/download error:`, err);
    return c.json(
      { error: "InternalError", message: "Failed to download asset" },
      500
    );
  }
});

/**
 * DELETE /assets/:assetId
 * Delete creator asset. Only asset owner can delete.
 */
assetsRouter.delete("/:assetId", async (c) => {
  const db = createDb(c.env);
  const auth = createAuth(db, c.env);
  const r2 = createR2(c.env);
  const assetId = c.req.param("assetId");

  const session = await auth.api.getSession({ headers: c.req.raw.headers });
  if (!session?.user) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  try {
    const [asset] = await db
      .select()
      .from(assets)
      .where(eq(assets.id, assetId))
      .limit(1);

    if (!asset) {
      return c.json({ error: "NotFound", message: "Asset not found" }, 404);
    }

    if (asset.creatorId !== session.user.id) {
      return c.json({ error: "Forbidden" }, 403);
    }

    // Delete from R2
    await r2.deleteObject(asset.r2Path);

    // Delete from database
    await db.delete(assets).where(eq(assets.id, assetId));

    return c.json({ success: true, message: "Asset deleted" });
  } catch (err) {
    console.error(`DELETE /assets/:${assetId} error:`, err);
    return c.json(
      { error: "InternalError", message: "Failed to delete asset" },
      500
    );
  }
});

export { assetsRouter as assetsRoutes };
