"use client";

import { useRef, useEffect, useState, useCallback } from "react";
import { useVideoPlayer } from "@/hooks/useVideoPlayer";
import { useVideoPlayback } from "./VideoPlaybackContext";
import { logAdImpression } from "@/lib/api";
import { cn } from "@/lib/utils";

interface VideoPlayerProps {
  streamVideoId: string;
  title: string;
  showAds?: boolean;
  /** Pre-signed URL for private videos. Omit for public videos. */
  playbackUrl?: string;
  /** Cloudflare Stream customer subdomain (from API response). Omit when playbackUrl is provided. */
  customerSubdomain?: string;
  className?: string;
}

/**
 * Embeds a Cloudflare Stream video with a custom controls overlay.
 * Uses the Stream iframe player API via postMessage.
 */
export function VideoPlayer({
  streamVideoId,
  title,
  showAds = false,
  playbackUrl,
  customerSubdomain,
  className,
}: VideoPlayerProps) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const hideTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const [controlsVisible, setControlsVisible] = useState(false);
  const { isPlaying, currentTime, duration, volume, isMuted, play, pause, seek, setVolume, toggleMute, toggleFullscreen } =
    useVideoPlayer({ iframeRef });
  
  const { setCurrentTime } = useVideoPlayback();

  const showControlsTemporarily = useCallback(() => {
    clearTimeout(hideTimerRef.current);
    setControlsVisible(true);
    hideTimerRef.current = setTimeout(() => setControlsVisible(false), 3000);
  }, []);

  // Cleanup hide timer on unmount
  useEffect(() => () => clearTimeout(hideTimerRef.current), []);

  // Log ad impression on mount if showAds is true
  useEffect(() => {
    if (showAds && streamVideoId) {
      // Fire and forget; log after a short delay to ensure component stability
      const timer = setTimeout(() => {
        logAdImpression(streamVideoId, "impression");
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [showAds, streamVideoId]);
  
  // Broadcast current playback time to context for watch party sync
  useEffect(() => {
    setCurrentTime(currentTime);
  }, [currentTime, setCurrentTime]);

  const streamDomain = customerSubdomain
    ? `customer-${customerSubdomain}.cloudflarestream.com`
    : "customer-stream.cloudflarestream.com"; // fallback — configure customerSubdomain from API

  const src =
    playbackUrl ??
    `https://${streamDomain}/${streamVideoId}/iframe?preload=auto&loop=false`;

  const progressPercent = duration > 0 ? (currentTime / duration) * 100 : 0;

  function formatTime(seconds: number): string {
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m}:${String(s).padStart(2, "0")}`;
  }

  return (
    <div
      className={cn(
        "group relative aspect-video w-full overflow-hidden rounded-xl bg-black shadow-2xl",
        className,
      )}
      role="region"
      aria-label={`Video player: ${title}`}
      onClick={showControlsTemporarily}
    >
      {/* Stream iframe */}
      <iframe
        ref={iframeRef}
        src={src}
        title={title}
        allow="accelerometer; gyroscope; autoplay; encrypted-media; picture-in-picture"
        allowFullScreen
        className="absolute inset-0 h-full w-full border-0"
        aria-label={title}
      />

      {/* Custom controls overlay */}
      <div className={cn("absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent px-4 pb-4 pt-8 opacity-0 transition-opacity duration-200 group-hover:opacity-100 focus-within:opacity-100", controlsVisible && "opacity-100")}>
        {/* Progress bar */}
        <div
          className="relative mb-3 h-1 cursor-pointer rounded-full bg-white/30"
          role="slider"
          aria-label="Video progress"
          aria-valuemin={0}
          aria-valuemax={duration}
          aria-valuenow={currentTime}
          onClick={(e) => {
            const rect = e.currentTarget.getBoundingClientRect();
            const ratio = (e.clientX - rect.left) / rect.width;
            seek(duration * ratio);
          }}
          onKeyDown={(e) => {
            if (e.key === "ArrowRight") seek(Math.min(currentTime + 5, duration));
            if (e.key === "ArrowLeft") seek(Math.max(currentTime - 5, 0));
          }}
          tabIndex={0}
        >
          <div
            className="h-full rounded-full bg-brand-500"
            style={{ width: `${progressPercent}%` }}
          />
        </div>

        {/* Controls row */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            {/* Play / Pause */}
            <button
              onClick={isPlaying ? pause : play}
              className="rounded-full p-1 text-white transition hover:bg-white/20"
              aria-label={isPlaying ? "Pause" : "Play"}
            >
              {isPlaying ? (
                <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 20 20" aria-hidden="true">
                  <path d="M6 4h2v12H6zM12 4h2v12h-2z" />
                </svg>
              ) : (
                <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 20 20" aria-hidden="true">
                  <path d="M5 3.5v13L16.5 10 5 3.5z" />
                </svg>
              )}
            </button>

            {/* Mute */}
            <button
              onClick={toggleMute}
              className="rounded-full p-1 text-white transition hover:bg-white/20"
              aria-label={isMuted ? "Unmute" : "Mute"}
            >
              {isMuted || volume === 0 ? (
                <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 20 20" aria-hidden="true">
                  <path d="M10 3.5L5 7.5H2v5h3l5 4V3.5zM14 7l2 2-2 2M16 7l-2 2 2 2" stroke="currentColor" strokeWidth="1.5" />
                </svg>
              ) : (
                <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 20 20" aria-hidden="true">
                  <path d="M10 3.5L5 7.5H2v5h3l5 4V3.5z" />
                  <path d="M14 7a4 4 0 010 6" stroke="currentColor" strokeWidth="1.5" fill="none" />
                </svg>
              )}
            </button>

            {/* Volume slider */}
            <input
              type="range"
              min={0}
              max={1}
              step={0.05}
              value={isMuted ? 0 : volume}
              onChange={(e) => setVolume(Number(e.target.value))}
              className="w-20 accent-brand-500"
              aria-label="Volume"
            />

            {/* Time display */}
            <span className="text-xs tabular-nums text-white/80">
              {formatTime(currentTime)} / {formatTime(duration)}
            </span>
          </div>

          {/* Fullscreen */}
          <button
            onClick={toggleFullscreen}
            className="rounded-full p-1 text-white transition hover:bg-white/20"
            aria-label="Toggle fullscreen"
          >
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M4 8V4m0 0h4M4 4l5 5m11-5h-4m4 0v4m0-4l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4"
              />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}
