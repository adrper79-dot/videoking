"use client";

import Link from "next/link";
import { useState } from "react";
import { cn } from "@/lib/utils";
import { useEntitlements } from "./EntitlementsContext";

/**
 * Top navigation bar with logo, main links, and mobile menu.
 */
export function Navbar() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const { entitlements, error, refetch } = useEntitlements();

  const navLinks = [
    { href: "/", label: "Home" },
    { href: "/dashboard", label: "Dashboard" },
    { href: "/dashboard/upload", label: "Upload" },
  ];

  const effectiveTier = entitlements?.user?.effectiveTier ?? "free";
  const isAuthenticated = entitlements?.authenticated ?? false;

  /**
   * Calculate days remaining in trial
   * Uses trialEndsAt timestamp to determine countdown
   */
  const getTrialDaysRemaining = (): number | null => {
    if (effectiveTier !== "free" || !entitlements?.user?.trialEndsAt) {
      return null;
    }
    const trialEndsAt = new Date(entitlements.user.trialEndsAt).getTime();
    const now = new Date().getTime();
    const daysRemaining = Math.ceil((trialEndsAt - now) / (24 * 60 * 60 * 1000));
    return daysRemaining > 0 ? daysRemaining : null;
  };

  const daysRemaining = getTrialDaysRemaining();
  const showTrialBanner = daysRemaining !== null && daysRemaining <= 3;

  return (
    <nav
      className="fixed inset-x-0 top-0 z-50 border-b border-neutral-800 bg-neutral-950/95 backdrop-blur"
      aria-label="Main navigation"
    >
      {/* Error notification banner */}
      {error && (
        <div className="border-b border-red-900/50 bg-red-950/50 px-4 py-2">
          <div className="mx-auto flex max-w-7xl items-center justify-between gap-3">
            <p className="text-sm text-red-200">
              Failed to load profile. Some features may be limited.
            </p>
            <button
              onClick={() => void refetch()}
              className="rounded px-2 py-1 text-xs font-semibold text-red-300 hover:bg-red-900/30"
            >
              Retry
            </button>
          </div>
        </div>
      )}

      {/* Trial countdown banner */}
      {showTrialBanner && daysRemaining !== null && (
        <div className="border-b border-amber-900/50 bg-amber-950/50 px-4 py-2">
          <div className="mx-auto flex max-w-7xl items-center justify-between gap-3">
            <p className="text-sm text-amber-200">
              Your trial ends in <span className="font-semibold">{daysRemaining} day{daysRemaining !== 1 ? 's' : ''}</span> — subscribe for just <span className="font-semibold">$1/month</span>
            </p>
            <Link
              href="/pricing?offer=trial_urgent"
              className="rounded px-3 py-1 text-xs font-semibold text-amber-300 hover:bg-amber-900/30 transition"
            >
              Subscribe Now
            </Link>
          </div>
        </div>
      )}

      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-2" aria-label="NicheStream home">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-600">
            <svg
              className="h-4 w-4 text-white"
              fill="currentColor"
              viewBox="0 0 20 20"
              aria-hidden="true"
            >
              <path d="M6.3 2.841A1.5 1.5 0 004 4.11v11.78a1.5 1.5 0 002.3 1.269l9.344-5.89a1.5 1.5 0 000-2.538L6.3 2.84z" />
            </svg>
          </div>
          <span className="font-bold text-white">NicheStream</span>
        </Link>

        {/* Desktop nav */}
        <div className="hidden items-center gap-1 md:flex">
          {navLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="rounded-lg px-3 py-2 text-sm text-neutral-300 transition hover:bg-neutral-800 hover:text-white"
            >
              {link.label}
            </Link>
          ))}
        </div>

        {/* Auth buttons */}
        <div className="hidden items-center gap-2 md:flex">
          {isAuthenticated ? (
            <>
              <span className="rounded-full border border-neutral-700 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-neutral-200">
                {effectiveTier}
              </span>
              {effectiveTier === "free" && (
                <Link
                  href="/pricing"
                  className="rounded-lg bg-brand-600 px-3 py-2 text-sm font-semibold text-white transition hover:bg-brand-700"
                >
                  Upgrade
                </Link>
              )}
            </>
          ) : (
            <>
              <Link
                href="/sign-in"
                className="rounded-lg px-3 py-2 text-sm text-neutral-300 transition hover:text-white"
              >
                Sign In
              </Link>
              <Link
                href="/pricing"
                className="rounded-lg bg-brand-600 px-3 py-2 text-sm font-semibold text-white transition hover:bg-brand-700"
              >
                Get Started
              </Link>
            </>
          )}
        </div>

        {/* Mobile menu button */}
        <button
          onClick={() => setMobileOpen(!mobileOpen)}
          className="rounded-lg p-2 text-neutral-400 hover:bg-neutral-800 hover:text-white md:hidden"
          aria-expanded={mobileOpen}
          aria-controls="mobile-menu"
          aria-label="Toggle mobile menu"
        >
          <svg
            className={cn("h-5 w-5 transition", mobileOpen && "rotate-90")}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            aria-hidden="true"
          >
            {mobileOpen ? (
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            ) : (
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M4 6h16M4 12h16M4 18h16"
              />
            )}
          </svg>
        </button>
      </div>

      {/* Mobile menu */}
      {mobileOpen && (
        <div
          id="mobile-menu"
          className="border-t border-neutral-800 bg-neutral-950 pb-4 md:hidden"
        >
          <div className="flex flex-col gap-1 px-4 pt-2">
            {navLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                onClick={() => setMobileOpen(false)}
                className="rounded-lg px-3 py-2.5 text-sm text-neutral-300 hover:bg-neutral-800 hover:text-white"
              >
                {link.label}
              </Link>
            ))}
            <hr className="my-2 border-neutral-800" />
            {isAuthenticated ? (
              <>
                <div className="rounded-lg border border-neutral-800 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-neutral-300">
                  Current tier: {effectiveTier}
                </div>
                {effectiveTier === "free" && (
                  <Link
                    href="/pricing"
                    onClick={() => setMobileOpen(false)}
                    className="rounded-lg bg-brand-600 px-3 py-2.5 text-center text-sm font-semibold text-white hover:bg-brand-700"
                  >
                    Upgrade
                  </Link>
                )}
              </>
            ) : (
              <>
                <Link
                  href="/sign-in"
                  onClick={() => setMobileOpen(false)}
                  className="rounded-lg px-3 py-2.5 text-sm text-neutral-300 hover:bg-neutral-800 hover:text-white"
                >
                  Sign In
                </Link>
                <Link
                  href="/pricing"
                  onClick={() => setMobileOpen(false)}
                  className="rounded-lg bg-brand-600 px-3 py-2.5 text-center text-sm font-semibold text-white hover:bg-brand-700"
                >
                  Get Started
                </Link>
              </>
            )}
          </div>
        </div>
      )}
    </nav>
  );
}
