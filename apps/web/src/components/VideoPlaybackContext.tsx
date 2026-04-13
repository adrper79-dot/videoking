"use client";

import { createContext, useContext, useState, ReactNode } from "react";

interface VideoPlaybackContextType {
  currentTime: number;
  setCurrentTime: (time: number) => void;
}

const VideoPlaybackContext = createContext<VideoPlaybackContextType | undefined>(undefined);

export function VideoPlaybackProvider({ children }: { children: ReactNode }) {
  const [currentTime, setCurrentTime] = useState(0);

  return (
    <VideoPlaybackContext.Provider value={{ currentTime, setCurrentTime }}>
      {children}
    </VideoPlaybackContext.Provider>
  );
}

export function useVideoPlayback() {
  const context = useContext(VideoPlaybackContext);
  if (!context) {
    throw new Error("useVideoPlayback must be used within a VideoPlaybackProvider");
  }
  return context;
}
