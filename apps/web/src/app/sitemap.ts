import type { MetadataRoute } from "next";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8787";
const APP_BASE_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://itsjusus.com";

interface VideoListItem {
  id: string;
  updatedAt?: string;
  publishedAt?: string | null;
}

interface CreatorListItem {
  username: string;
  updatedAt?: string;
}

/**
 * Dynamic sitemap generated at request time.
 * Includes static routes + public videos + creator channels.
 * Edge runtime fetches are cached per-request by Next.js.
 */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date().toISOString();

  // ── Static routes ──────────────────────────────────────────────────────────
  const staticRoutes: MetadataRoute.Sitemap = [
    { url: `${APP_BASE_URL}/`, lastModified: now, changeFrequency: "daily", priority: 1.0 },
    { url: `${APP_BASE_URL}/pricing`, lastModified: now, changeFrequency: "weekly", priority: 0.8 },
    { url: `${APP_BASE_URL}/sign-in`, lastModified: now, changeFrequency: "monthly", priority: 0.5 },
    { url: `${APP_BASE_URL}/sign-up`, lastModified: now, changeFrequency: "monthly", priority: 0.5 },
  ];

  // ── Dynamic videos ─────────────────────────────────────────────────────────
  let videoRoutes: MetadataRoute.Sitemap = [];
  try {
    const res = await fetch(`${API_BASE_URL}/api/videos?pageSize=1000&status=ready&visibility=public`, {
      next: { revalidate: 3600 }, // revalidate once per hour
    });
    if (res.ok) {
      const data = (await res.json()) as { videos?: VideoListItem[] };
      const items = data.videos ?? (Array.isArray(data) ? (data as VideoListItem[]) : []);
      videoRoutes = items.map((v) => ({
        url: `${APP_BASE_URL}/watch/${v.id}`,
        lastModified: v.publishedAt ?? v.updatedAt ?? now,
        changeFrequency: "weekly" as const,
        priority: 0.7,
      }));
    }
  } catch {
    // Silently skip — partial sitemap is acceptable
  }

  // ── Dynamic creator channels ───────────────────────────────────────────────
  let creatorRoutes: MetadataRoute.Sitemap = [];
  try {
    const res = await fetch(`${API_BASE_URL}/api/channels?pageSize=500`, {
      next: { revalidate: 3600 },
    });
    if (res.ok) {
      const data = (await res.json()) as { creators?: CreatorListItem[] };
      const items = data.creators ?? (Array.isArray(data) ? (data as CreatorListItem[]) : []);
      creatorRoutes = items.map((c) => ({
        url: `${APP_BASE_URL}/channel/${c.username}`,
        lastModified: c.updatedAt ?? now,
        changeFrequency: "weekly" as const,
        priority: 0.6,
      }));
    }
  } catch {
    // Silently skip
  }

  return [...staticRoutes, ...videoRoutes, ...creatorRoutes];
}
