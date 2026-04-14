"use client";

import { useState } from "react";
import Link from "next/link";

interface ChatRateLimitUpsellProps {
  isOpen: boolean;
  // onClose intentionally unused - modal auto-closes on action
  currentTier: "free" | "citizen" | "vip";
}

/**
 * Modal upsell shown when a free user hits their chat rate limit.
 * Promotes Citizen subscription ($1/month) for unlimited chat.
 */
export function ChatRateLimitUpsell({
  isOpen,
  currentTier,
}: ChatRateLimitUpsellProps) {
  const [dismissed, setDismissed] = useState(false);

  if (!isOpen || dismissed || currentTier !== "free") {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="mx-4 w-full max-w-md rounded-lg border border-brand-600/30 bg-neutral-950 p-6 shadow-2xl">
        {/* Header */}
        <div className="mb-4">
          <h2 className="text-xl font-bold text-white">Chat slower? Upgrade.</h2>
          <p className="mt-1 text-sm text-neutral-400">
            You're chatting faster than our free tier allows.
          </p>
        </div>

        {/* Benefits */}
        <div className="mb-6 space-y-3 rounded-lg bg-neutral-900 p-4">
          <div className="flex items-start gap-3">
            <div className="mt-0.5 flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full bg-brand-600">
              <svg className="h-3 w-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                <path
                  fillRule="evenodd"
                  d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                  clipRule="evenodd"
                />
              </svg>
            </div>
            <div>
              <p className="font-semibold text-white">Unlimited Chat</p>
              <p className="text-sm text-neutral-400">Message as much as you want</p>
            </div>
          </div>

          <div className="flex items-start gap-3">
            <div className="mt-0.5 flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full bg-brand-600">
              <svg className="h-3 w-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                <path
                  fillRule="evenodd"
                  d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                  clipRule="evenodd"
                />
              </svg>
            </div>
            <div>
              <p className="font-semibold text-white">Community Benefits</p>
              <p className="text-sm text-neutral-400">Polls, watch parties, and more</p>
            </div>
          </div>

          <div className="flex items-start gap-3">
            <div className="mt-0.5 flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full bg-brand-600">
              <svg className="h-3 w-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                <path
                  fillRule="evenodd"
                  d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                  clipRule="evenodd"
                />
              </svg>
            </div>
            <div>
              <p className="font-semibold text-white">Cancel Anytime</p>
              <p className="text-sm text-neutral-400">No commitment, just $1/month</p>
            </div>
          </div>
        </div>

        {/* Price highlight */}
        <div className="mb-6 rounded-lg border border-brand-600/50 bg-brand-600/10 px-4 py-3">
          <p className="text-center text-2xl font-bold text-brand-300">$1/month</p>
        </div>

        {/* Actions */}
        <div className="flex gap-3">
          <button
            onClick={() => setDismissed(true)}
            className="flex-1 rounded-lg border border-neutral-700 px-4 py-2 font-semibold text-neutral-300 transition hover:bg-neutral-900"
          >
            Not Now
          </button>
          <Link
            href="/pricing?offer=chat_rate_limit"
            onClick={() => setDismissed(true)}
            className="flex-1 rounded-lg bg-brand-600 px-4 py-2 text-center font-semibold text-white transition hover:bg-brand-700"
          >
            Subscribe Now
          </Link>
        </div>
      </div>
    </div>
  );
}
