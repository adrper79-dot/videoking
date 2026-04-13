import Link from "next/link";
import Image from "next/image";
import type { Video } from "@nichestream/types";
import { formatDuration, formatViews, timeAgo } from "@/lib/utils";

interface VideoCardProps {
  video: Video & {
    creatorUsername?: string;
    creatorDisplayName?: string;
    creatorAvatarUrl?: string | null;
  };
}

/** Video thumbnail card displayed in the feed and on channel pages. */
export function VideoCard({ video }: VideoCardProps) {
  return (
    <article className="group flex flex-col overflow-hidden rounded-xl border border-neutral-800 bg-neutral-900 transition hover:border-neutral-600">
      <Link href={`/watch/${video.id}`} aria-label={video.title}>
        <div className="relative aspect-video w-full overflow-hidden bg-neutral-800">
          {video.thumbnailUrl ? (
            <Image
              src={video.thumbnailUrl}
              alt={video.title}
              fill
              sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw"
              className="object-cover transition group-hover:scale-105"
            />
          ) : (
            <div className="flex h-full items-center justify-center bg-neutral-800">
              <svg
                className="h-12 w-12 text-neutral-600"
                fill="currentColor"
                viewBox="0 0 24 24"
                aria-hidden="true"
              >
                <path d="M8 5v14l11-7z" />
              </svg>
            </div>
          )}

          {/* Duration badge */}
          {video.durationSeconds != null && (
            <span className="absolute bottom-2 right-2 rounded bg-black/80 px-1.5 py-0.5 text-xs font-medium text-white tabular-nums">
              {formatDuration(video.durationSeconds)}
            </span>
          )}

          {/* Live badge */}
          {video.status === "live" && (
            <span className="absolute left-2 top-2 flex items-center gap-1 rounded bg-red-600 px-1.5 py-0.5 text-xs font-bold text-white">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-white" aria-hidden="true" />
              LIVE
            </span>
          )}
        </div>
      </Link>

      <div className="flex flex-1 flex-col p-3">
        <Link href={`/watch/${video.id}`}>
          <h3 className="line-clamp-2 text-sm font-semibold text-white transition group-hover:text-brand-400">
            {video.title}
          </h3>
        </Link>

        {video.creatorUsername && (
          <Link
            href={`/channel/${video.creatorUsername}`}
            className="mt-1 text-xs text-neutral-400 hover:text-white"
          >
            {video.creatorDisplayName ?? video.creatorUsername}
          </Link>
        )}

        <div className="mt-1.5 flex items-center gap-2 text-xs text-neutral-500">
          <span>{formatViews(video.viewsCount)} views</span>
          {video.publishedAt && <span>·</span>}
          {video.publishedAt && <span>{timeAgo(video.publishedAt)}</span>}
        </div>
      </div>
    </article>
  );
}
