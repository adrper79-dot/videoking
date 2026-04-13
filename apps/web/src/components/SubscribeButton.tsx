"use client";

import { useState } from "react";
import { api } from "@/lib/api";
import type { SubscriptionCheckoutResponse } from "@nichestream/types";

interface SubscribeButtonProps {
  creatorId: string;
  creatorUsername: string;
}

/**
 * Subscribe button that creates a Stripe Checkout session for the creator's channel.
 */
export function SubscribeButton({ creatorId, creatorUsername }: SubscribeButtonProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubscribe() {
    setLoading(true);
    setError(null);

    try {
      // In production this priceId would come from the creator's Stripe configuration
      const MONTHLY_PRICE_ID = "price_placeholder_monthly";

      const data = await api.post<SubscriptionCheckoutResponse>("/api/stripe/subscriptions", {
        creatorId,
        plan: "monthly",
        priceId: MONTHLY_PRICE_ID,
      });

      if (data.checkoutUrl) {
        window.location.href = data.checkoutUrl;
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to start checkout");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-col items-start gap-1">
      <button
        onClick={() => void handleSubscribe()}
        disabled={loading}
        className="rounded-lg bg-brand-600 px-5 py-2.5 font-semibold text-white transition hover:bg-brand-700 disabled:opacity-50"
        aria-label={`Subscribe to ${creatorUsername}`}
      >
        {loading ? "Loading…" : "Subscribe"}
      </button>
      {error && <p className="text-xs text-red-400">{error}</p>}
    </div>
  );
}
