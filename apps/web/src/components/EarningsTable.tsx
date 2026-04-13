"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import type { Earning } from "@nichestream/types";
import { formatCents, timeAgo } from "@/lib/utils";

interface EarningsSummary {
  totalGrossCents: number;
  totalNetCents: number;
  pendingCents: number;
  transferredCents: number;
  breakdown: {
    subscriptionShareCents: number;
    unlockPurchaseCents: number;
    tipCents: number;
  };
}

/**
 * Earnings overview with summary cards and itemized transaction table.
 */
export function EarningsTable() {
  const [summary, setSummary] = useState<EarningsSummary | null>(null);
  const [recent, setRecent] = useState<Earning[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void api
      .get<{ summary: EarningsSummary; recent: Earning[] }>("/api/dashboard/earnings")
      .then(({ summary: s, recent: r }) => {
        setSummary(s);
        setRecent(r);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-brand-500 border-t-transparent" />
      </div>
    );
  }

  const summaryCards = summary
    ? [
        { label: "Total Revenue", value: formatCents(summary.totalGrossCents), color: "text-white" },
        { label: "Your Earnings (net)", value: formatCents(summary.totalNetCents), color: "text-green-400" },
        { label: "Pending Payout", value: formatCents(summary.pendingCents), color: "text-yellow-400" },
        { label: "Transferred", value: formatCents(summary.transferredCents), color: "text-blue-400" },
      ]
    : [];

  const typeLabels: Record<string, string> = {
    subscription_share: "Subscription",
    unlock_purchase: "Unlock",
    tip: "Tip",
  };

  const statusBadge: Record<string, string> = {
    pending: "bg-yellow-900/50 text-yellow-300",
    transferred: "bg-green-900/50 text-green-300",
    failed: "bg-red-900/50 text-red-300",
  };

  return (
    <div className="space-y-6">
      {/* Summary cards */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        {summaryCards.map((card) => (
          <div
            key={card.label}
            className="rounded-xl border border-neutral-800 bg-neutral-900 p-5"
          >
            <p className={`text-2xl font-bold ${card.color}`}>{card.value}</p>
            <p className="mt-1 text-sm text-neutral-400">{card.label}</p>
          </div>
        ))}
      </div>

      {/* Breakdown */}
      {summary && (
        <div className="rounded-xl border border-neutral-800 bg-neutral-900 p-5">
          <h2 className="mb-4 font-semibold text-white">Revenue Breakdown (30 days)</h2>
          <div className="space-y-2">
            {[
              { label: "Subscriptions", cents: summary.breakdown.subscriptionShareCents },
              { label: "Video Unlocks", cents: summary.breakdown.unlockPurchaseCents },
              { label: "Tips", cents: summary.breakdown.tipCents },
            ].map((row) => (
              <div key={row.label} className="flex justify-between text-sm">
                <span className="text-neutral-400">{row.label}</span>
                <span className="font-medium text-white">{formatCents(row.cents)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Transaction table */}
      <div>
        <h2 className="mb-4 text-lg font-semibold text-white">Recent Transactions</h2>
        {recent.length === 0 ? (
          <p className="text-neutral-400">No transactions yet.</p>
        ) : (
          <div className="overflow-hidden rounded-xl border border-neutral-800">
            <table className="w-full text-sm">
              <thead className="bg-neutral-800 text-left text-neutral-400">
                <tr>
                  <th className="px-4 py-3 font-medium">Type</th>
                  <th className="px-4 py-3 font-medium">Gross</th>
                  <th className="px-4 py-3 font-medium">Net</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3 font-medium">Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-800 bg-neutral-900">
                {recent.map((e) => (
                  <tr key={e.id} className="hover:bg-neutral-800/50">
                    <td className="px-4 py-3 text-neutral-200">
                      {typeLabels[e.type] ?? e.type}
                    </td>
                    <td className="px-4 py-3 tabular-nums text-neutral-300">
                      {formatCents(e.grossAmountCents)}
                    </td>
                    <td className="px-4 py-3 tabular-nums text-green-400">
                      {formatCents(e.netAmountCents)}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`rounded-full px-2 py-0.5 text-xs font-medium ${statusBadge[e.status] ?? ""}`}
                      >
                        {e.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-neutral-400">
                      {timeAgo(e.createdAt)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
