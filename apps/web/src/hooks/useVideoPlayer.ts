"use client";

import { useCallback, useEffect, useRef, useState } from "react";

interface UseVideoPlayerOptions {
  /** Cloudflare Stream iframe ref */
  iframeRef: React.RefObject<HTMLIFrameElement | null>;
}

interface PlayerState {
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  volume: number;
  isMuted: boolean;
  isFullscreen: boolean;
  buffered: number;
}

interface UseVideoPlayerReturn extends PlayerState {
  play: () => void;
  pause: () => void;
  seek: (time: number) => void;
  setVolume: (volume: number) => void;
  toggleMute: () => void;
  toggleFullscreen: () => void;
}

/**
 * Hook that wraps Cloudflare Stream's postMessage player API.
 * Provides typed controls and reactive state for the video iframe.
 */
export function useVideoPlayer({ iframeRef }: UseVideoPlayerOptions): UseVideoPlayerReturn {
  const [state, setState] = useState<PlayerState>({
    isPlaying: false,
    currentTime: 0,
    duration: 0,
    volume: 1,
    isMuted: false,
    isFullscreen: false,
    buffered: 0,
  });

  // Cloudflare Stream uses a customer-subdomain origin for postMessage
  // We use "*" to accept messages from any Stream origin (all share the same API)
  const playerOrigin = "*";

  /** Send a command to the Stream player via postMessage. */
  const sendCommand = useCallback(
    (method: string, value?: unknown) => {
      iframeRef.current?.contentWindow?.postMessage(
        { method, value },
        playerOrigin,
      );
    },
    [iframeRef, playerOrigin],
  );

  // Listen for events from the Stream player
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (!event.data || typeof event.data !== "object") return;

      const { event: eventName, data } = event.data as {
        event: string;
        data: unknown;
      };

      switch (eventName) {
        case "timeupdate":
          setState((prev) => ({
            ...prev,
            currentTime: typeof data === "number" ? data : prev.currentTime,
          }));
          break;
        case "durationchange":
          setState((prev) => ({
            ...prev,
            duration: typeof data === "number" ? data : prev.duration,
          }));
          break;
        case "play":
          setState((prev) => ({ ...prev, isPlaying: true }));
          break;
        case "pause":
          setState((prev) => ({ ...prev, isPlaying: false }));
          break;
        case "volumechange":
          if (typeof data === "object" && data !== null) {
            const { volume, muted } = data as { volume: number; muted: boolean };
            setState((prev) => ({ ...prev, volume, isMuted: muted }));
          }
          break;
        case "progress":
          setState((prev) => ({
            ...prev,
            buffered: typeof data === "number" ? data : prev.buffered,
          }));
          break;
        default:
          break;
      }
    };

    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, []);

  const play = useCallback(() => sendCommand("play"), [sendCommand]);
  const pause = useCallback(() => sendCommand("pause"), [sendCommand]);
  const seek = useCallback((time: number) => sendCommand("seek", time), [sendCommand]);
  const setVolume = useCallback(
    (volume: number) => sendCommand("setVolume", volume),
    [sendCommand],
  );
  const toggleMute = useCallback(
    () => sendCommand(state.isMuted ? "unmute" : "mute"),
    [sendCommand, state.isMuted],
  );

  const containerRef = useRef<HTMLElement | null>(null);
  const toggleFullscreen = useCallback(() => {
    const el = iframeRef.current?.parentElement ?? containerRef.current;
    if (!el) return;

    if (!document.fullscreenElement) {
      void el.requestFullscreen();
      setState((prev) => ({ ...prev, isFullscreen: true }));
    } else {
      void document.exitFullscreen();
      setState((prev) => ({ ...prev, isFullscreen: false }));
    }
  }, [iframeRef]);

  return {
    ...state,
    play,
    pause,
    seek,
    setVolume,
    toggleMute,
    toggleFullscreen,
  };
}
