"use client";

import { VideoPlayer } from "@/components/VideoPlayer";
import { VideoPlaybackProvider } from "@/components/VideoPlaybackContext";
import { useEntitlements } from "@/components/EntitlementsContext";
import type { Video } from "@nichestream/types";

interface VideoWatcherProps {
  video: Video & { playbackUrl?: string | null };
}

/**
 * ClientVideoWatcher — handles ad eligibility check and passes to VideoPlayer.
 * Wrapped client component for the server-side watch page.
 */
export function ClientVideoWatcher({ video }: VideoWatcherProps) {
  const { entitlements, loading } = useEntitlements();

  // Show ads only for users who don't have adFree entitlement (i.e., free-tier users)
  const shouldShowAds = !loading && entitlements && !entitlements.limits.adFree ? true : false;

  return (
    <VideoPlaybackProvider>
      <VideoPlayer
        streamVideoId={video.cloudflareStreamId}
        title={video.title}
        playbackUrl={video.playbackUrl ?? undefined}
        showAds={shouldShowAds}
      />
    </VideoPlaybackProvider>
  );
}
