import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ClientVideoWatcher } from "@/components/ClientVideoWatcher";
import { InteractivityOverlay } from "@/components/InteractivityOverlay";
import { VideoPlaybackProvider } from "@/components/VideoPlaybackContext";
import { api } from "@/lib/api";
import type { Video } from "@nichestream/types";

export const runtime = "edge";

interface WatchPageProps {
  params: Promise<{ videoId: string }>;
}

export async function generateMetadata({ params }: WatchPageProps): Promise<Metadata> {
  const { videoId } = await params;
  try {
    const video = await api.get<Video>(`/api/videos/${videoId}`);
    return {
      title: video.title,
      description: video.description ?? undefined,
      openGraph: {
        type: "video.other",
        title: video.title,
        images: video.thumbnailUrl ? [video.thumbnailUrl] : [],
      },
    };
  } catch {
    return { title: "Video" };
  }
}

/** Video watch page — server component that pre-fetches video data. */
export default async function WatchPage({ params }: WatchPageProps) {
  const { videoId } = await params;

  let video: Video & { playbackUrl?: string | null };
  try {
    video = await api.get<Video & { playbackUrl?: string | null }>(
      `/api/videos/${videoId}`,
    );
  } catch {
    notFound();
  }

  if (video.status === "deleted") {
    notFound();
  }

  return (
    <div className="mx-auto max-w-screen-2xl px-4 py-6 sm:px-6 lg:px-8">
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_360px]">
        {/* Main content */}
        <div className="space-y-4">
          <ClientVideoWatcher video={video} />

          <div className="rounded-xl border border-neutral-800 bg-neutral-900 p-5">
            <h1 className="text xl font-bold text-white">{video.title}</h1>
            <div className="mt-2 flex items-center gap-4 text-sm text-neutral-400">
              <span>{video.viewsCount.toLocaleString()} views</span>
              <span>{video.likesCount.toLocaleString()} likes</span>
              {video.publishedAt && (
                <span>
                  {new Date(video.publishedAt).toLocaleDateString("en-US", {
                    year: "numeric",
                    month: "short",
                    day: "numeric",
                  })}
                </span>
              )}
            </div>
            {video.description && (
              <p className="mt-4 whitespace-pre-wrap text-sm text-neutral-300">
                {video.description}
              </p>
            )}
          </div>
        </div>

        {/* Interactivity sidebar */}
        <VideoPlaybackProvider>
          <InteractivityOverlay videoId={videoId} />
        </VideoPlaybackProvider>
      </div>
    </div>
  );
}
