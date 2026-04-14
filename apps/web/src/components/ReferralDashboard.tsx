"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { api } from "@/lib/api";

interface ReferralLink {
  referral_code: string;
  share_url: string;
  created_at: string;
}

interface ReferralStats {
  total_signups: number;
  total_conversions: number;
  conversion_rate: number;
}

export function ReferralDashboard() {
  const [referralLink, setReferralLink] = useState<ReferralLink | null>(null);
  const [stats, setStats] = useState<ReferralStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState(false);

  useEffect(() => {
    const fetch = async () => {
      try {
        setLoading(true);
        setError(false);

        // Fetch referral link
        let link: ReferralLink | null = null;
        try {
          link = await api.get<ReferralLink>("/api/referrals/my-link");
        } catch (e) {
          // 404 is OK, user hasn't created link yet
          if ((e as any).status !== 404) throw e;
        }

        // Fetch stats
        const statsData = await api.get<ReferralStats>("/api/referrals/stats");

        setReferralLink(link);
        setStats(statsData);
      } catch (err) {
        console.error("Failed to fetch referral data:", err);
        setError(true);
      } finally {
        setLoading(false);
      }
    };

    void fetch();
  }, []);

  const handleCreateLink = async () => {
    try {
      setLoading(true);
      const link = await api.post<ReferralLink>("/api/referrals/create", {});
      setReferralLink(link);
    } catch (err) {
      console.error("Failed to create referral link:", err);
      setError(true);
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = async () => {
    if (!referralLink?.share_url) return;
    try {
      await navigator.clipboard.writeText(referralLink.share_url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error("Failed to copy:", err);
    }
  };

  if (error) {
    return (
      <div className="rounded-lg border border-red-900/50 bg-red-950/30 p-6">
        <p className="text-sm text-red-200">
          Failed to load referral data. Please try again later.
        </p>
      </div>
    );
  }

  if (loading || !stats) {
    return (
      <div className="rounded-lg border border-neutral-800 bg-neutral-900/50 p-6">
        <p className="text-sm text-neutral-400">Loading referral data...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="space-y-2">
        <h2 className="text-2xl font-bold text-white">Referral Program</h2>
        <p className="text-neutral-400">
          Share NicheStream with creators you know and earn rewards when they subscribe.
        </p>
      </div>

      {/* Referral Link Section */}
      <div className="rounded-lg border border-neutral-800 bg-neutral-900 p-6">
        <h3 className="mb-4 text-lg font-semibold text-white">Your Referral Link</h3>

        {!referralLink ? (
          <div className="space-y-4">
            <p className="text-sm text-neutral-400">
              Create a unique referral link to start earning rewards. Anyone who signs up using your link will give you both a bonus.
            </p>
            <button
              onClick={() => void handleCreateLink()}
              disabled={loading}
              className="rounded-lg bg-brand-600 px-6 py-2 font-semibold text-white transition hover:bg-brand-700 disabled:opacity-50"
            >
              {loading ? "Creating..." : "Create Referral Link"}
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <input
                type="text"
                readOnly
                value={referralLink.share_url}
                className="flex-1 rounded-lg border border-neutral-700 bg-neutral-800 px-3 py-2 text-sm text-neutral-300"
              />
              <button
                onClick={() => void handleCopy()}
                className="rounded-lg border border-neutral-700 px-4 py-2 text-sm font-semibold text-neutral-300 transition hover:bg-neutral-800"
              >
                {copied ? "✓ Copied" : "Copy"}
              </button>
            </div>

            {/* Share buttons */}
            <div className="flex gap-2">
              <Link
                href={`https://twitter.com/intent/tweet?text=Check%20out%20NicheStream%20-%20a%20hyper-niche%20video%20platform&url=${encodeURIComponent(referralLink.share_url)}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex-1 rounded-lg bg-neutral-800 px-4 py-2 text-center text-sm font-semibold text-neutral-300 transition hover:bg-neutral-700"
              >
                Twitter
              </Link>
              <Link
                href={`mailto:?subject=Check%20out%20NicheStream&body=${encodeURIComponent(referralLink.share_url)}`}
                className="flex-1 rounded-lg bg-neutral-800 px-4 py-2 text-center text-sm font-semibold text-neutral-300 transition hover:bg-neutral-700"
              >
                Email
              </Link>
              <button
                onClick={() => void handleCopy()}
                className="flex-1 rounded-lg bg-neutral-800 px-4 py-2 text-sm font-semibold text-neutral-300 transition hover:bg-neutral-700"
              >
                Share Link
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Stats Section */}
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-lg border border-neutral-800 bg-neutral-900 p-4">
          <p className="text-sm text-neutral-400">Total Signups</p>
          <p className="mt-1 text-3xl font-bold text-white">{stats.total_signups}</p>
        </div>

        <div className="rounded-lg border border-neutral-800 bg-neutral-900 p-4">
          <p className="text-sm text-neutral-400">Conversions</p>
          <p className="mt-1 text-3xl font-bold text-white">{stats.total_conversions}</p>
        </div>

        <div className="rounded-lg border border-neutral-800 bg-neutral-900 p-4">
          <p className="text-sm text-neutral-400">Conversion Rate</p>
          <p className="mt-1 text-3xl font-bold text-brand-400">
            {(stats.conversion_rate * 100).toFixed(1)}%
          </p>
        </div>
      </div>

      {/* Rewards Info */}
      <div className="rounded-lg border border-emerald-900/50 bg-emerald-950/30 p-6">
        <h3 className="mb-3 font-semibold text-emerald-200">Your Rewards</h3>
        <ul className="space-y-2 text-sm text-emerald-200">
          <li>✓ 7 extra trial days or $10 credit for each referral that converts</li>
          <li>✓ Referenced users also get 7 extra trial days</li>
          <li>✓ Unlimited referrals — share as much as you want</li>
          <li>✓ Referral links expire after 90 days of inactivity</li>
        </ul>
      </div>
    </div>
  );
}
