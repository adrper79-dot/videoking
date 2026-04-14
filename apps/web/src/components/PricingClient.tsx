"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEntitlements } from "./EntitlementsContext";

function getTrialDaysLeft(trialEndsAt: string | null | undefined): number | null {
  if (!trialEndsAt) return null;
  const diff = new Date(trialEndsAt).getTime() - Date.now();
  return diff > 0 ? Math.max(1, Math.ceil(diff / (24 * 60 * 60 * 1000))) : 0;
}

export function PricingClient() {
  const searchParams = useSearchParams();
  const { entitlements, error, refetch } = useEntitlements();

  const welcome = searchParams.get("welcome") === "1";
  const trialDaysLeft = getTrialDaysLeft(entitlements?.user?.trialEndsAt);
  const isAuthenticated = entitlements?.authenticated ?? false;

  return (
    <div className="space-y-10">
      {error && (
        <div className="rounded-lg border border-red-900/50 bg-red-950/30 p-4">
          <div className="flex items-center justify-between gap-4">
            <p className="text-sm text-red-200">
              Unable to load your profile information. Some features may be limited.
            </p>
            <button
              onClick={() => void refetch()}
              className="flex-shrink-0 rounded px-3 py-1 text-xs font-semibold text-red-300 hover:bg-red-900/30"
            >
              Retry
            </button>
          </div>
        </div>
      )}
      {welcome && entitlements?.user && (
        <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-5 text-sm text-emerald-100">
          Your account is live. {trialDaysLeft ? `Your Citizen trial is active for ${trialDaysLeft} more day${trialDaysLeft === 1 ? "" : "s"}.` : "Your account is ready."}
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-3">
        <section className="rounded-3xl border border-neutral-800 bg-neutral-900 p-6">
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-neutral-500">Free</p>
          <h2 className="mt-3 text-3xl font-bold text-white">$0</h2>
          <p className="mt-2 text-sm text-neutral-400">Browse public videos, discover creators, and join the room with lighter limits.</p>
          <ul className="mt-6 space-y-3 text-sm text-neutral-300">
            <li>Public video access</li>
            <li>Basic reactions and read-only social presence</li>
            <li>Slower chat cadence and no room controls</li>
            <li>Ad-supported viewing as inventory rolls out</li>
          </ul>
          <div className="mt-8">
            <Link href={isAuthenticated ? "/" : "/sign-up"} className="rounded-lg border border-neutral-700 px-4 py-2 text-sm font-medium text-neutral-200 hover:bg-neutral-800 inline-block">
              {isAuthenticated ? "Keep exploring" : "Start free"}
            </Link>
          </div>
        </section>

        <section className="rounded-3xl border border-brand-500/40 bg-[linear-gradient(180deg,rgba(99,102,241,0.18),rgba(15,15,15,0.94))] p-6 shadow-[0_20px_80px_rgba(99,102,241,0.15)]">
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-brand-200">Citizen</p>
          <div className="mt-3 flex items-end gap-3">
            <h2 className="text-3xl font-bold text-white">$1/mo</h2>
            <span className="pb-1 text-sm text-brand-100/80">or $10/year</span>
          </div>
          <p className="mt-2 text-sm text-brand-50/80">Ad-light viewing, faster chat, poll creation, watch parties, and the core community experience.</p>
          <ul className="mt-6 space-y-3 text-sm text-white/90">
            <li>Ad-free or very light viewing</li>
            <li>Full-speed chat with Citizen badge</li>
            <li>Create polls and host watch parties</li>
            <li>Eligibility for smarter recommendations and sync features</li>
          </ul>
          <div className="mt-8 space-y-2">
            {isAuthenticated ? (
              <>
                <Link href="/" className="inline-block rounded-lg bg-white px-4 py-2 text-sm font-semibold text-neutral-950 hover:bg-neutral-100">
                  Find creators to support
                </Link>
                <p className="text-xs text-white/70">Citizen billing is still creator-linked in the current implementation. Use a creator page to complete checkout.</p>
              </>
            ) : (
              <Link href="/sign-up" className="inline-block rounded-lg bg-white px-4 py-2 text-sm font-semibold text-neutral-950 hover:bg-neutral-100">
                Create account and start trial
              </Link>
            )}
          </div>
        </section>

        <section className="rounded-3xl border border-amber-500/40 bg-[linear-gradient(180deg,rgba(217,119,6,0.18),rgba(15,15,15,0.94))] p-6 shadow-[0_20px_80px_rgba(217,119,6,0.15)]">
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-amber-200">VIP</p>
          <div className="mt-3 flex items-end gap-3">
            <h2 className="text-3xl font-bold text-white">$7/mo</h2>
            <span className="pb-1 text-sm text-amber-100/80">or $70/year</span>
          </div>
          <p className="mt-2 text-sm text-amber-50/80">For superfans: private watch parties, video downloads, Creator AMAs, VIP chat badge, and priority support.</p>
          <ul className="mt-6 space-y-3 text-sm text-white/90">
            <li>Everything in Citizen</li>
            <li>Private 1:1 watch parties with creators</li>
            <li>Download videos for offline viewing</li>
            <li>Exclusive VIP chat badge and recognition</li>
            <li>Priority support and direct creator access</li>
          </ul>
          <div className="mt-8 space-y-2">
            {isAuthenticated ? (
              <>
                <Link href="/" className="inline-block rounded-lg bg-amber-500 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-600">
                  Explore VIP benefits
                </Link>
                <p className="text-xs text-white/70">Find creators offering VIP tiers to upgrade from their creator pages.</p>
              </>
            ) : (
              <Link href="/sign-up?tier=vip" className="inline-block rounded-lg bg-amber-500 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-600">
                Create VIP account
              </Link>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}