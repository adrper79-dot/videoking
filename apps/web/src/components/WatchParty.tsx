"use client";

import { useState } from "react";

interface WatchPartyProps {
  onSync: (isPlaying: boolean, currentTimeSeconds: number) => void;
}

/**
 * Watch Party controls — the host can broadcast play/pause/seek events
 * to all viewers in the room via the Durable Object.
 */
export function WatchParty({ onSync }: WatchPartyProps) {
  const [isHost, setIsHost] = useState(false);
  const [syncTime, setSyncTime] = useState("");

  function handleBecomeHost() {
    setIsHost(true);
  }

  function handlePlay() {
    onSync(true, 0);
  }

  function handlePause() {
    onSync(false, 0);
  }

  function handleSeek(e: React.FormEvent) {
    e.preventDefault();
    const seconds = parseFloat(syncTime);
    if (!isNaN(seconds) && seconds >= 0) {
      onSync(true, seconds);
      setSyncTime("");
    }
  }

  return (
    <div className="flex flex-col gap-4 p-4">
      <div>
        <h3 className="font-semibold text-white">Watch Party</h3>
        <p className="mt-1 text-sm text-neutral-400">
          Sync playback with everyone in the room.
        </p>
      </div>

      {!isHost ? (
        <div className="rounded-xl border border-neutral-700 bg-neutral-800 p-4 text-center">
          <p className="mb-3 text-sm text-neutral-300">
            Become the host to control playback for all viewers.
          </p>
          <button
            onClick={handleBecomeHost}
            className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700"
          >
            Become Host
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          <div className="flex gap-2">
            <button
              onClick={handlePlay}
              className="flex-1 rounded-lg bg-green-600 px-4 py-2 text-sm font-semibold text-white hover:bg-green-700"
              aria-label="Play for all viewers"
            >
              ▶ Play All
            </button>
            <button
              onClick={handlePause}
              className="flex-1 rounded-lg bg-yellow-600 px-4 py-2 text-sm font-semibold text-white hover:bg-yellow-700"
              aria-label="Pause for all viewers"
            >
              ⏸ Pause All
            </button>
          </div>

          <form onSubmit={handleSeek} className="flex gap-2">
            <input
              type="number"
              value={syncTime}
              onChange={(e) => setSyncTime(e.target.value)}
              placeholder="Seek to (seconds)"
              min={0}
              step={0.1}
              className="flex-1 rounded-lg border border-neutral-700 bg-neutral-800 px-3 py-2 text-sm text-white placeholder-neutral-500 focus:border-brand-500 focus:outline-none"
              aria-label="Seek to time in seconds"
            />
            <button
              type="submit"
              className="rounded-lg bg-brand-600 px-3 py-2 text-sm font-semibold text-white hover:bg-brand-700"
            >
              Sync
            </button>
          </form>

          <p className="text-xs text-neutral-500">
            You are the host. Commands are broadcast to all viewers.
          </p>
        </div>
      )}
    </div>
  );
}
