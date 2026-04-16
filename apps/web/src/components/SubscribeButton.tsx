"use client";

import { useState } from "react";
import { api } from "@/lib/api";
import type { SubscriptionCheckoutResponse } from "@nichestream/types";

interface SubscribeButtonProps {
  creatorId: string;
  creatorUsername: string;
  /** Subscription tier for this button. Defaults to "citizen". */
  tier?: "citizen" | "vip";
}

/**
 * Subscribe button that creates a Stripe Checkout session for the creator's channel.
 */
export function SubscribeButton({ creatorId, creatorUsername, tier = "citizen" }: SubscribeButtonProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [plan, setPlan] = useState<"monthly" | "annual">("monthly");

  async function handleSubscribe(selectedPlan: "monthly" | "annual") {
    setLoading(true);
    setError(null);

    try {
      const monthlyPriceId = process.env.NEXT_PUBLIC_SUBSCRIPTION_PRICE_MONTHLY ?? "";
      const annualPriceId = process.env.NEXT_PUBLIC_SUBSCRIPTION_PRICE_ANNUAL ?? "";
      const priceId = selectedPlan === "annual" ? annualPriceId : monthlyPriceId;

      if (!priceId) {
        throw new Error(
          selectedPlan === "annual"
            ? "Annual pricing is not configured yet"
            : "Monthly pricing is not configured yet",
        );
      }

      const data = await api.post<SubscriptionCheckoutResponse>("/api/stripe/subscriptions", {
        creatorId,
        plan: selectedPlan,
        priceId,
        tier,
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
      <div className="mb-2 inline-flex rounded-lg border border-neutral-700 bg-neutral-900 p-1">
        <button
          type="button"
          onClick={() => setPlan("monthly")}
          className={plan === "monthly" ? "rounded-md bg-brand-600 px-3 py-1 text-xs font-semibold text-white" : "rounded-md px-3 py-1 text-xs text-neutral-300"}
        >
          $1/mo
        </button>
        <button
          type="button"
          onClick={() => setPlan("annual")}
          className={plan === "annual" ? "rounded-md bg-brand-600 px-3 py-1 text-xs font-semibold text-white" : "rounded-md px-3 py-1 text-xs text-neutral-300"}
        >
          $10/yr
        </button>
      </div>
      <button
        onClick={() => void handleSubscribe(plan)}
        disabled={loading}
        className="rounded-lg bg-brand-600 px-5 py-2.5 font-semibold text-white transition hover:bg-brand-700 disabled:opacity-50"
        aria-label={`Subscribe to ${creatorUsername}`}
      >
        {loading ? "Loading…" : plan === "annual" ? "Become a Citizen yearly" : "Become a Citizen"}
      </button>
      <p className="text-xs text-neutral-400">
        {plan === "annual" ? "Best value for long-term supporters." : "Unlock ad-light viewing and premium interactivity."}
      </p>
      {error && <p className="text-xs text-red-400">{error}</p>}
    </div>
  );
}
