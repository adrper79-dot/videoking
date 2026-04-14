import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import { VideoCard } from "@/components/VideoCard";
import { api } from "@/lib/api";
import type { Video, PublicUser } from "@nichestream/types";

export const runtime = "edge";

interface SearchPageProps {
  searchParams: Promise<{ q?: string; type?: string; page?: string }>;
}

interface SearchResults {
  query: string;
  type: string;
  page: number;
  pageSize: number;
  videos: Video[];
  creators: PublicUser[];
}

export async function generateMetadata({ searchParams }: SearchPageProps): Promise<Metadata> {
  const { q } = await searchParams;
  return {
    title: q ? `"${q}" — Search` : "Search",
    description: q ? `Search results for "${q}" on NicheStream` : "Search videos and creators on NicheStream",
  };
}

export default async function SearchPage({ searchParams }: SearchPageProps) {
  const { q = "", type = "all", page = "1" } = await searchParams;
  const trimmedQ = q.trim();

  let results: SearchResults | null = null;
  let fetchError = false;

  if (trimmedQ) {
    try {
      const params = new URLSearchParams({ q: trimmedQ, type, page });
      results = await api.get<SearchResults>(`/api/search?${params.toString()}`);
    } catch {
      fetchError = true;
    }
  }

  const currentType = type ?? "all";
  const tabs = [
    { value: "all", label: "All" },
    { value: "videos", label: "Videos" },
    { value: "creators", label: "Creators" },
  ];

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      {/* Search heading */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-white">
          {trimmedQ ? (
            <>
              Search results for{" "}
              <span className="text-brand-400">&ldquo;{trimmedQ}&rdquo;</span>
            </>
          ) : (
            "Search"
          )}
        </h1>
      </div>

      {/* Type filter tabs */}
      {trimmedQ && (
        <div className="mb-6 flex gap-2 border-b border-neutral-800">
          {tabs.map((tab) => (
            <Link
              key={tab.value}
              href={`/search?q=${encodeURIComponent(trimmedQ)}&type=${tab.value}`}
              className={[
                "px-4 py-2 text-sm font-medium transition",
                currentType === tab.value
                  ? "border-b-2 border-brand-500 text-white"
                  : "text-neutral-400 hover:text-white",
              ].join(" ")}
            >
              {tab.label}
            </Link>
          ))}
        </div>
      )}

      {/* Empty state — no query */}
      {!trimmedQ && (
        <p className="text-neutral-400">Enter a search term above to find videos and creators.</p>
      )}

      {/* Error state */}
      {fetchError && (
        <div className="rounded-lg border border-red-800 bg-red-900/20 p-4 text-red-400">
          Something went wrong while fetching results. Please try again.
        </div>
      )}

      {results && (
        <>
          {/* ── Videos section ──────────────────────────────────────────── */}
          {currentType !== "creators" && (
            <section className="mb-10">
              <h2 className="mb-4 text-lg font-semibold text-white">Videos</h2>
              {results.videos.length === 0 ? (
                <p className="text-sm text-neutral-400">No videos found for this search.</p>
              ) : (
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                  {results.videos.map((video) => (
                    <VideoCard key={video.id} video={video} />
                  ))}
                </div>
              )}
            </section>
          )}

          {/* ── Creators section ────────────────────────────────────────── */}
          {currentType !== "videos" && (
            <section>
              <h2 className="mb-4 text-lg font-semibold text-white">Creators</h2>
              {results.creators.length === 0 ? (
                <p className="text-sm text-neutral-400">No creators found for this search.</p>
              ) : (
                <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {results.creators.map((creator) => (
                    <li key={creator.id}>
                      <Link
                        href={`/channel/${creator.username}`}
                        className="flex items-center gap-4 rounded-xl border border-neutral-800 bg-neutral-900 p-4 transition hover:border-neutral-600"
                      >
                        {creator.avatarUrl ? (
                          <Image
                            src={creator.avatarUrl}
                            alt={creator.displayName}
                            width={48}
                            height={48}
                            className="rounded-full object-cover ring-2 ring-brand-500"
                          />
                        ) : (
                          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-brand-600 text-lg font-bold text-white">
                            {creator.displayName[0]?.toUpperCase()}
                          </div>
                        )}
                        <div className="min-w-0">
                          <p className="truncate font-semibold text-white">{creator.displayName}</p>
                          <p className="truncate text-sm text-neutral-400">@{creator.username}</p>
                          {creator.bio && (
                            <p className="mt-1 line-clamp-2 text-xs text-neutral-500">{creator.bio}</p>
                          )}
                        </div>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          )}

          {/* Pagination */}
          {(results.videos.length === results.pageSize || results.creators.length === results.pageSize) && (
            <div className="mt-8 flex justify-center">
              <Link
                href={`/search?q=${encodeURIComponent(trimmedQ)}&type=${currentType}&page=${results.page + 1}`}
                className="rounded-lg bg-neutral-800 px-6 py-2.5 text-sm font-medium text-white transition hover:bg-neutral-700"
              >
                Load more
              </Link>
            </div>
          )}
        </>
      )}
    </div>
  );
}
