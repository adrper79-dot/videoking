import { VideoFeed } from "@/components/VideoFeed";
import { api } from "@/lib/api";
import type { PaginatedResponse, Video } from "@nichestream/types";

export const revalidate = 60;

/** Home page – renders the main public video feed. Updated with new API credentials. */
export default async function HomePage() {
  let initialData: PaginatedResponse<Video> | null = null;

  try {
    initialData = await api.get<PaginatedResponse<Video>>("/api/videos?page=1&pageSize=20");
  } catch {
    // Render with empty state; client-side fetch will retry
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <section className="mb-10">
        <h1 className="mb-2 text-3xl font-bold text-white">Trending Now</h1>
        <p className="text-neutral-400">
          Discover hyper-niche content you won&apos;t find anywhere else.
        </p>
      </section>

      <VideoFeed initialData={initialData} />
    </div>
  );
}
