/**
 * Google IMA (Interactive Media Ads) integration for NicheStream video player.
 * 
 * Features:
 * - Pre-roll, mid-roll, and post-roll ad support
 * - VAST/VPAID ad serving
 * - Impression and completion tracking
 * - Free tier ad monetization
 * - Citizen/VIP tiers: ads suppressed for best experience
 * 
 * @module AdManager
 */

import { useEffect, useRef, useCallback, useState } from "react";
import type { UserTier } from "@nichestream/types";
import { api } from "@/lib/api";

/**
 * Ad event types
 */
type AdEvent = "impression" | "start" | "firstQuartile" | "midpoint" | "thirdQuartile" | "complete" | "click";

/**
 * Ad manager configuration
 */
interface AdManagerConfig {
  videoId: string;
  userTier: UserTier;
  videoDurationSeconds: number;
  containerElement: HTMLElement | null;
}

/**
 * Hook to manage video ad playback
 * 
 * @example
 * ```typescript
 * const { showAds, handleAdEvent } = useAdManager({
 *   videoId: "vid123",
 *   userTier: "free",
 *   videoDurationSeconds: 600,
 *   containerElement: adContainerRef.current,
 * });
 * 
 * if (showAds) {
 *   <AdContainer ref={adContainerRef} onEvent={handleAdEvent} />
 * }
 * ```
 */
export function useAdManager(config: AdManagerConfig) {
  const [adsInitialized, setAdsInitialized] = useState(false);
  const adsManagerRef = useRef<any>(null);
  const adDisplayContainerRef = useRef<any>(null);

  // Only show ads for free tier users
  const showAds = config.userTier === "free";

  /**
   * Initialize Google IMA SDK (called once on mount)
   */
  const initializeAds = useCallback(async () => {
    if (!showAds || adsInitialized || !config.containerElement) return;

    try {
      // Load Google IMA SDK if not already loaded
      if (!(window as any).google?.ima) {
        await loadGoogleImaScript();
      }

      const ima = (window as any).google.ima;
      if (!ima) {
        console.warn("IMA SDK not available, ads disabled");
        return;
      }

      // Create and initialize ad display container
      adDisplayContainerRef.current = new ima.AdDisplayContainer(
        config.containerElement,
        (window as any).document.getElementById("content-video-player"),
      );

      // Create ads manager and load default ads
      const adsRequest = new ima.AdsRequest();
      adsRequest.adTagUrl = `${process.env.NEXT_PUBLIC_WORKER_URL}/api/ads/vast?videoId=${config.videoId}`;

      // Create ads manager loader
      const adsLoader = new ima.AdsLoader(adDisplayContainerRef.current);

      // Set up event listeners for ads loader
      adsLoader.addEventListener(ima.goog.ads.AdEvent.Type.CONTENT_PAUSE_REQUESTED, () => {
        // Pause main content when ads start
        const videoElement = (window as any).document.querySelector("video");
        if (videoElement) videoElement.pause();
      });

      adsLoader.addEventListener(ima.goog.ads.AdEvent.Type.CONTENT_RESUME_REQUESTED, () => {
        // Resume main content when ads finish
        const videoElement = (window as any).document.querySelector("video");
        if (videoElement) videoElement.play();
      });

      adsLoader.addEventListener(ima.goog.ads.AdEvent.Type.ADS_MANAGER_LOADED, (adsManagerLoadedEvent: any) => {
        adsManagerRef.current = adsManagerLoadedEvent.getAdsManager(
          (window as any).document.querySelector("video"),
        );

        // Set up ads manager event listeners
        attachAdManagerEventListeners(adsManagerRef.current, config.videoId);

        // Initialize and start ads
        try {
          adsManagerRef.current.init(
            window.innerWidth,
            window.innerHeight,
            ima.ViewMode.NORMAL,
          );
          adsManagerRef.current.start();
        } catch (err) {
          console.error("AdsManager init/start error:", err);
        }
      });

      adsLoader.addEventListener(ima.goog.ads.AdEvent.Type.ADS_LOAD_FAILED, ({}: any) => {
        console.warn("Failed to load ads, content will play without ads");
      });

      // Load the ads
      adsLoader.requestAds(adsRequest);
      setAdsInitialized(true);
    } catch (err) {
      console.error("Error initializing Google IMA:", err);
    }
  }, [showAds, adsInitialized, config.videoId, config.containerElement]);

  /**
   * Attach event listeners to ads manager
   */
  const attachAdManagerEventListeners = (adsManager: any, videoId: string) => {
    const ima = (window as any).google.ima;
    if (!ima) return;

    adsManager.addEventListener(ima.goog.ads.AdEvent.Type.IMPRESSION, () => {
      trackAdEvent("impression", videoId);
    });

    adsManager.addEventListener(ima.goog.ads.AdEvent.Type.START, () => {
      trackAdEvent("start", videoId);
    });

    adsManager.addEventListener(ima.goog.ads.AdEvent.Type.FIRST_QUARTILE, () => {
      trackAdEvent("firstQuartile", videoId);
    });

    adsManager.addEventListener(ima.goog.ads.AdEvent.Type.MIDPOINT, () => {
      trackAdEvent("midpoint", videoId);
    });

    adsManager.addEventListener(ima.goog.ads.AdEvent.Type.THIRD_QUARTILE, () => {
      trackAdEvent("thirdQuartile", videoId);
    });

    adsManager.addEventListener(ima.goog.ads.AdEvent.Type.COMPLETE, () => {
      trackAdEvent("complete", videoId);
    });

    adsManager.addEventListener(ima.goog.ads.AdEvent.Type.CLICK, () => {
      trackAdEvent("click", videoId);
    });

    adsManager.addEventListener(ima.goog.ads.AdEvent.Type.ERROR, (errorEvent: any) => {
      console.error("Ad error:", errorEvent.getError());
    });
  };

  /**
   * Track ad event to backend for earnings attribution
   */
  const trackAdEvent = async (eventType: AdEvent, videoId: string) => {
    try {
      await api.post("/ads/track", {
        videoId,
        eventType,
        timestamp: new Date().toISOString(),
      });
    } catch (err) {
      console.error(`Failed to track ad event (${eventType}):`, err);
    }
  };

  /**
   * Public handler for ad events (allows external components to track)
   */
  const handleAdEvent = useCallback(
    (eventType: AdEvent) => {
      trackAdEvent(eventType, config.videoId);
    },
    [config.videoId],
  );

  // Initialize ads on mount
  useEffect(() => {
    initializeAds();
  }, [initializeAds]);

  // Handle window resize for responsive ads
  useEffect(() => {
    if (!adsManagerRef.current || !showAds) return;

    const handleResize = () => {
      if (adsManagerRef.current && adsManagerRef.current.resize) {
        adsManagerRef.current.resize(window.innerWidth, window.innerHeight, (window as any).google.ima?.ViewMode?.NORMAL);
      }
    };

    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, [showAds]);

  return {
    showAds,
    adsInitialized,
    handleAdEvent,
  };
}

/**
 * Load Google IMA SDK script into page
 */
async function loadGoogleImaScript(): Promise<void> {
  return new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.type = "text/javascript";
    script.src = "https://imasdk.googleapis.com/js/sdks/ima3.js";
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("Failed to load Google IMA SDK"));
    document.head.appendChild(script);
  });
}

/**
 * Ad container component for rendering ads
 */
export function AdContainer(): React.ReactElement {
  return (
    <div
      id="ad-container"
      style={{
        position: "absolute",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        width: "100%",
        height: "100%",
        zIndex: 10,
      }}
    />
  );
}

/**
 * Helper hook to get ad display container element
 */
export function useAdContainer() {
  return useRef<HTMLDivElement>(null);
}
