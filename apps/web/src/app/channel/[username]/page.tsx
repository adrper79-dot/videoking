import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Image from "next/image";
import { VideoCard } from "@/components/VideoCard";
import { SubscribeButton } from "@/components/SubscribeButton";
import { api } from "@/lib/api";
import type { PublicUser, Video } from "@nichestream/types";

interface ChannelPageProps {
  params: Promise<{ username: string }>;
}

interface ChannelResponse {
  creator: PublicUser & { role: string; createdAt: string };
  videos: Video[];
}

export async function generateMetadata({ params }: ChannelPageProps): Promise<Metadata> {
  const { username } = await params;
  try {
    const { creator } = await api.get<ChannelResponse>(`/api/channels/${username}`);
    return {
      title: `${creator.displayName} (@${creator.username})`,
      description: creator.bio ?? `Watch ${creator.displayName}'s videos on NicheStream`,
    };
  } catch {
    return { title: "Channel" };
  }
}

export default async function ChannelPage({ params }: ChannelPageProps) {
  const { username } = await params;

  let channelData: ChannelResponse;
  try {
    channelData = await api.get<ChannelResponse>(`/api/channels/${username}`);
  } catch {
    notFound();
  }

  const { creator, videos } = channelData;

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      {/* Channel header */}
      <div className="mb-8 flex flex-col items-start gap-6 sm:flex-row sm:items-center">
        <div className="flex-shrink-0">
          {creator.avatarUrl ? (
            <Image
              src={creator.avatarUrl}
              alt={creator.displayName}
              width={96}
              height={96}
              className="rounded-full object-cover ring-2 ring-brand-500"
            />
          ) : (
            <div className="flex h-24 w-24 items-center justify-center rounded-full bg-brand-600 text-3xl font-bold text-white">
              {creator.displayName[0]?.toUpperCase()}
            </div>
          )}
        </div>

        <div className="flex-1">
          <h1 className="text-2xl font-bold text-white">{creator.displayName}</h1>
          <p className="text-neutral-400">@{creator.username}</p>
          {creator.bio && (
            <p className="mt-2 max-w-xl text-sm text-neutral-300">{creator.bio}</p>
          )}
          {creator.website && (
            <a
              href={creator.website}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-1 text-sm text-brand-500 hover:underline"
            >
              {creator.website}
            </a>
          )}
        </div>

        <SubscribeButton creatorId={creator.id} creatorUsername={creator.username} />
      </div>

      {/* Videos grid */}
      <h2 className="mb-4 text-lg font-semibold text-white">Videos</h2>
      {videos.length === 0 ? (
        <p className="text-neutral-400">No videos yet.</p>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
          {videos.map((video) => (
            <VideoCard key={video.id} video={video} />
          ))}
        </div>
      )}
    </div>
  );
}
