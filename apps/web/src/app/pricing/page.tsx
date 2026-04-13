import type { Metadata } from "next";
import { PricingClient } from "@/components/PricingClient";

export const dynamic = "force-dynamic";
export const runtime = "edge";
export const metadata: Metadata = {
  title: "Pricing",
  description: "Compare Free, Citizen, and VIP tiers for NicheStream.",
};

export default function PricingPage() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6 lg:px-8">
      <section className="max-w-3xl">
        <p className="text-sm font-semibold uppercase tracking-[0.3em] text-brand-300">Membership</p>
        <h1 className="mt-4 text-4xl font-bold text-white sm:text-5xl">Start free, convert on value, and keep the room alive.</h1>
        <p className="mt-4 text-base text-neutral-300 sm:text-lg">
          NicheStream uses a hybrid freemium model: the free tier maximizes reach, Citizen unlocks the interactive core for almost no friction, and VIP is reserved for your highest-intent superfans.
        </p>
      </section>

      <div className="mt-10">
        <PricingClient />
      </div>
    </div>
  );
}