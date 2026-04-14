"use client";

import { useState, useEffect } from "react";
import { api } from "@/lib/api";

interface ReferralLink {
  referral_code: string;
  share_url: string;
}

interface ReferralShareModalProps {
  isOpen: boolean;
  onClose: () => void;
}

/**
 * Quick share modal for referral link
 * Appears in dashboard for easy one-click sharing
 */
export function ReferralShareModal({ isOpen, onClose }: ReferralShareModalProps) {
  const [shareUrl, setShareUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!isOpen) return;

    const fetch = async () => {
      try {
        setLoading(true);
        const link = await api.get<ReferralLink>("/api/referrals/my-link");
        setShareUrl(link.share_url);
      } catch (err) {
        console.error("Failed to fetch share URL:", err);
      } finally {
        setLoading(false);
      }
    };

    void fetch();
  }, [isOpen]);

  const handleCopy = async () => {
    if (!shareUrl) return;
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error("Failed to copy:", err);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="mx-4 w-full max-w-md rounded-lg border border-brand-600/30 bg-neutral-950 p-6 shadow-2xl">
        {/* Header */}
        <div className="mb-4">
          <h2 className="text-xl font-bold text-white">Share Your Referral</h2>
          <p className="mt-1 text-sm text-neutral-400">
            Copy your link and share with creators
          </p>
        </div>

        {loading ? (
          <p className="text-sm text-neutral-400">Loading...</p>
        ) : shareUrl ? (
          <>
            {/* URL display */}
            <div className="mb-4 rounded-lg bg-neutral-900 p-3">
              <p className="break-all text-xs text-neutral-400">{shareUrl}</p>
            </div>

            {/* Action buttons */}
            <div className="space-y-2">
              <button
                onClick={() => void handleCopy()}
                className="w-full rounded-lg bg-brand-600 px-4 py-2 font-semibold text-white transition hover:bg-brand-700"
              >
                {copied ? "✓ Copied to clipboard" : "Copy Link"}
              </button>

              <a
                href={`https://twitter.com/intent/tweet?text=Check%20out%20NicheStream&url=${encodeURIComponent(shareUrl)}`}
                target="_blank"
                rel="noopener noreferrer"
                className="block rounded-lg border border-neutral-700 px-4 py-2 text-center font-semibold text-neutral-300 transition hover:bg-neutral-800"
              >
                Share on Twitter
              </a>

              <button
                onClick={onClose}
                className="w-full rounded-lg border border-neutral-700 px-4 py-2 font-semibold text-neutral-300 transition hover:bg-neutral-800"
              >
                Close
              </button>
            </div>
          </>
        ) : (
          <p className="text-sm text-red-400">Failed to load referral link</p>
        )}
      </div>
    </div>
  );
}
