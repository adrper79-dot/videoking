"use client";

import { useEffect, useState, useCallback } from "react";
import { VideoCard } from "./VideoCard";
import { api } from "@/lib/api";
import type { PaginatedResponse, Video } from "@nichestream/types";

type VideoWithCreator = Video & {
  creatorUsername?: string;
  creatorDisplayName?: string;
  creatorAvatarUrl?: string | null;
};

interface VideoFeedProps {
  initialData: PaginatedResponse<Video> | null;
}

/**
 * Infinite-scroll video feed. Accepts server-rendered initial data
 * and loads more pages as the user scrolls.
 */
export function VideoFeed({ initialData }: VideoFeedProps) {
  const [videos, setVideos] = useState<VideoWithCreator[]>(
    (initialData?.data as VideoWithCreator[]) ?? [],
  );
  const [page, setPage] = useState(initialData ? 1 : 0);
  const [hasMore, setHasMore] = useState(initialData?.hasMore ?? true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadMore = useCallback(async () => {
    if (loading || !hasMore) return;
    setLoading(true);
    setError(null);

    try {
      const nextPage = page + 1;
      const data = await api.get<PaginatedResponse<VideoWithCreator>>(
        `/api/videos?page=${nextPage}&pageSize=20`,
      );
      setVideos((prev) => [...prev, ...data.data]);
      setPage(nextPage);
      setHasMore(data.hasMore);
    } catch {
      setError("Failed to load more videos. Please try again.");
    } finally {
      setLoading(false);
    }
  }, [loading, hasMore, page]);

  // Intersection Observer for infinite scroll
  useEffect(() => {
    const sentinel = document.getElementById("feed-sentinel");
    if (!sentinel) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          void loadMore();
        }
      },
      { rootMargin: "200px" },
    );

    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [loadMore]);

  if (videos.length === 0 && !loading) {
    return (
      <div className="py-20 text-center text-neutral-400">
        <p className="text-lg">No videos yet.</p>
        <p className="mt-2 text-sm">Be the first to upload!</p>
      </div>
    );
  }

  return (
    <div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
        {videos.map((video) => (
          <VideoCard key={video.id} video={video} />
        ))}
      </div>

      {/* Infinite scroll sentinel */}
      <div id="feed-sentinel" className="mt-4 flex justify-center py-8">
        {loading && (
          <div className="flex items-center gap-2 text-neutral-400">
            <svg
              className="h-5 w-5 animate-spin"
              fill="none"
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
              />
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8v4l3-3-3-3V4a10 10 0 100 20v-4l-3 3 3 3v-4a8 8 0 01-8-8z"
              />
            </svg>
            <span>Loading…</span>
          </div>
        )}
        {error && (
          <button
            onClick={() => void loadMore()}
            className="rounded-lg bg-brand-600 px-4 py-2 text-sm text-white hover:bg-brand-700"
          >
            Retry
          </button>
        )}
        {!loading && !hasMore && videos.length > 0 && (
          <p className="text-sm text-neutral-500">You&apos;ve reached the end!</p>
        )}
      </div>
    </div>
  );
}
