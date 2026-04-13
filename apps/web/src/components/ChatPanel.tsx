"use client";

import { useEffect, useRef, useState } from "react";
import type { ChatMessage, UserTier } from "@nichestream/types";
import { timeAgo } from "@/lib/utils";

interface ChatPanelProps {
  messages: ChatMessage[];
  onSend: (content: string) => void;
  isConnected: boolean;
  currentTier: UserTier;
  chatRateLimitMs?: number;
}

/**
 * Live chat panel with auto-scroll and message input.
 */
export function ChatPanel({
  messages,
  onSend,
  isConnected,
  currentTier,
  chatRateLimitMs,
}: ChatPanelProps) {
  const [input, setInput] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const [autoScroll, setAutoScroll] = useState(true);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    if (autoScroll) {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, autoScroll]);

  function handleScroll() {
    const el = listRef.current;
    if (!el) return;
    const nearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 100;
    setAutoScroll(nearBottom);
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = input.trim();
    if (!trimmed || !isConnected) return;
    onSend(trimmed);
    setInput("");
  }

  return (
    <div className="flex h-full flex-col">
      {/* Message list */}
      <div
        ref={listRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto space-y-1 px-3 py-2"
        role="log"
        aria-live="polite"
        aria-label="Chat messages"
      >
        {messages.length === 0 && (
          <p className="py-8 text-center text-sm text-neutral-500">
            Be the first to say something!
          </p>
        )}

        {messages.map((msg) => (
          <div key={msg.id} className="flex items-start gap-2 text-sm">
            <div className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-brand-600 text-xs font-bold text-white">
              {String(
                (msg as ChatMessage & { username?: string }).username?.[0] ??
                  msg.userId[0],
              ).toUpperCase()}
            </div>
            <div className="min-w-0 flex-1">
              <span className="font-medium text-brand-400">{msg.username ?? "Guest"}</span>
              {msg.userTier && msg.userTier !== "free" && (
                <span
                  className={
                    msg.userTier === "vip"
                      ? "ml-2 rounded-full bg-amber-500/20 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-300"
                      : "ml-2 rounded-full bg-sky-500/20 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-sky-300"
                  }
                >
                  {msg.userTier === "vip" ? "VIP" : "Citizen"}
                </span>
              )}{" "}
              <span className="break-words text-neutral-200">{msg.content}</span>
              <span className="ml-1 text-[10px] text-neutral-600">
                {timeAgo(msg.createdAt)}
              </span>
            </div>
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <form
        onSubmit={handleSubmit}
        className="border-t border-neutral-800 p-3"
        aria-label="Send chat message"
      >
        <div className="flex gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            maxLength={500}
            placeholder={isConnected ? "Say something…" : "Connecting…"}
            disabled={!isConnected}
            className="flex-1 rounded-lg border border-neutral-700 bg-neutral-800 px-3 py-2 text-sm text-white placeholder-neutral-500 focus:border-brand-500 focus:outline-none disabled:opacity-50"
            aria-label="Chat message input"
          />
          <button
            type="submit"
            disabled={!isConnected || !input.trim()}
            className="rounded-lg bg-brand-600 px-3 py-2 text-sm font-medium text-white transition hover:bg-brand-700 disabled:opacity-50"
            aria-label="Send message"
          >
            Send
          </button>
        </div>
        {currentTier === "free" && isConnected && (
          <p className="mt-2 text-xs text-neutral-500">
            Free tier chat is rate-limited to roughly one message every {Math.max(1, Math.ceil((chatRateLimitMs ?? 10000) / 1000))}s.
          </p>
        )}
      </form>
    </div>
  );
}
