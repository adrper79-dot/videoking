"use client";

import { useState, useCallback, useEffect } from "react";
import { ChatPanel } from "./ChatPanel";
import { PollWidget } from "./PollWidget";
import { ReactionBar } from "./ReactionBar";
import { WatchParty } from "./WatchParty";
import { ChatRateLimitUpsell } from "./ChatRateLimitUpsell";
import { useWebSocket } from "@/hooks/useWebSocket";
import type { ChatMessage, Poll, UserTier, WSMessage } from "@nichestream/types";
import { useEntitlements } from "./EntitlementsContext";
import { cn } from "@/lib/utils";

type Tab = "chat" | "polls" | "watch-party";

interface InteractivityOverlayProps {
  videoId: string;
}

/**
 * Side panel combining Chat, Polls, Reactions, and Watch Party controls.
 * Connects to the VideoRoom Durable Object via WebSocket.
 * Gets user identity from EntitlementsContext.
 */
export function InteractivityOverlay({ videoId }: InteractivityOverlayProps) {
  const [activeTab, setActiveTab] = useState<Tab>("chat");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [activePoll, setActivePoll] = useState<Poll | null>(null);
  const [reactionCounts, setReactionCounts] = useState<Record<string, number>>({});
  const [connectedCount, setConnectedCount] = useState(0);
  const [notice, setNotice] = useState<string | null>(null);
  const [showRateLimitUpsell, setShowRateLimitUpsell] = useState(false);
  const { entitlements, error, refetch } = useEntitlements();

  const userId = entitlements?.user?.id;
  const username = entitlements?.user?.username ?? "Guest";
  const avatarUrl = entitlements?.user?.avatarUrl ?? null;
  // Derive currentTier before handleMessage so the callback captures the latest value
  const currentTier: UserTier = entitlements?.user?.effectiveTier ?? "free";

  useEffect(() => {
    if (!notice) return;
    const timeout = setTimeout(() => setNotice(null), 4000);
    return () => clearTimeout(timeout);
  }, [notice]);

  const handleMessage = useCallback((msg: WSMessage) => {
    switch (msg.type) {
      case "room_state": {
        const state = msg.payload as {
          recentMessages?: ChatMessage[];
          activePoll?: Poll | null;
          reactionCounts?: Record<string, number>;
          connectedCount?: number;
        };
        if (state.recentMessages) setMessages(state.recentMessages);
        if (state.activePoll !== undefined) setActivePoll(state.activePoll);
        if (state.reactionCounts) setReactionCounts(state.reactionCounts);
        if (state.connectedCount !== undefined) setConnectedCount(state.connectedCount);
        break;
      }
      case "chat_message":
        setMessages((prev) => [...prev.slice(-200), msg.payload as unknown as ChatMessage]);
        break;
      case "reaction":
        setReactionCounts(
          (msg.payload as { counts: Record<string, number> }).counts,
        );
        break;
      case "poll_create":
        setActivePoll(msg.payload as unknown as Poll);
        setActiveTab("polls");
        break;
      case "poll_update":
        setActivePoll((prev) =>
          prev
            ? {
                ...prev,
                votes: (msg.payload as { votes: Record<string, number> }).votes,
              }
            : null,
        );
        break;
      case "user_presence":
        if (typeof (msg.payload as { connectedCount?: number }).connectedCount === "number") {
          setConnectedCount((msg.payload as { connectedCount: number }).connectedCount);
        }
        break;
      case "error": {
        const errorMsg = (msg.payload as { message?: string }).message ?? "Interaction unavailable";
        setNotice(errorMsg);
        // Show rate limit upsell modal if free user hits rate limit
        if (
          currentTier === "free" &&
          errorMsg.toLowerCase().includes("rate")
        ) {
          setShowRateLimitUpsell(true);
        }
        break;
      }
    }
  }, [currentTier]);

  const { isConnected, sendMessage } = useWebSocket({
    videoId,
    userId,
    username,
    avatarUrl,
    onMessage: handleMessage,
  });

  const tabs: { id: Tab; label: string }[] = [
    { id: "chat", label: "Chat" },
    { id: "polls", label: "Polls" },
    { id: "watch-party", label: "Watch Party" },
  ];

  return (
    <div className="flex h-[calc(100vh-6rem)] flex-col overflow-hidden rounded-xl border border-neutral-800 bg-neutral-900">
      {error && (
        <div className="border-b border-red-900/50 bg-red-950/30 px-4 py-2">
          <div className="flex items-center justify-between gap-3">
            <p className="text-xs text-red-200">
              Failed to load user info. Chat will use guest identity.
            </p>
            <button
              onClick={() => void refetch()}
              className="flex-shrink-0 rounded px-2 py-1 text-xs font-semibold text-red-300 hover:bg-red-900/30"
            >
              Retry
            </button>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between border-b border-neutral-800 px-4 py-3">
        <div className="flex items-center gap-2">
          <span
            className={cn(
              "h-2 w-2 rounded-full",
              isConnected ? "bg-green-400" : "bg-neutral-600",
            )}
            aria-label={isConnected ? "Connected" : "Disconnected"}
          />
          <span className="text-sm text-neutral-400">
            {connectedCount > 0 ? `${connectedCount} watching` : "Connecting…"}
          </span>
          <span className="rounded-full border border-neutral-700 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-neutral-300">
            {currentTier}
          </span>
        </div>
      </div>

      {notice && (
        <div className="border-b border-amber-500/30 bg-amber-500/10 px-4 py-2 text-xs text-amber-100">
          {notice}
        </div>
      )}

      {/* Reaction bar */}
      <div className="border-b border-neutral-800 px-4 py-2">
        <ReactionBar
          counts={reactionCounts}
          onReact={(emoji) => sendMessage("reaction", { emoji })}
        />
      </div>

      {/* Tabs */}
      <div className="flex border-b border-neutral-800">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={cn(
              "flex-1 py-2.5 text-sm font-medium transition",
              activeTab === tab.id
                ? "border-b-2 border-brand-500 text-white"
                : "text-neutral-500 hover:text-neutral-300",
            )}
            aria-selected={activeTab === tab.id}
            role="tab"
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab panels */}
      <div className="flex-1 overflow-hidden">
        {activeTab === "chat" && (
          <ChatPanel
            messages={messages}
            onSend={(content) => sendMessage("chat_message", { content })}
            isConnected={isConnected}
            currentTier={currentTier}
            chatRateLimitMs={entitlements?.limits.chatRateLimitMs}
          />
        )}
        {activeTab === "polls" && (
          <PollWidget
            poll={activePoll}
            onVote={(optionId) => sendMessage("poll_vote", { optionId })}
            onCreatePoll={(question, options) =>
              sendMessage("poll_create", { question, options })
            }
            canCreatePoll={entitlements?.limits.canCreatePolls ?? false}
          />
        )}
        {activeTab === "watch-party" && (
          <WatchParty
            onSync={(isPlaying, currentTimeSeconds) =>
              sendMessage("watch_party_sync", { isPlaying, currentTimeSeconds })
            }
            canHost={entitlements?.limits.canUseWatchParty ?? false}
          />
        )}
      </div>

      {/* Chat rate limit upsell modal */}
      <ChatRateLimitUpsell
        isOpen={showRateLimitUpsell}
        currentTier={currentTier}
      />
    </div>
  );
}
