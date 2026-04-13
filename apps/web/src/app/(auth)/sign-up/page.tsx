import type { Metadata } from "next";
import Link from "next/link";
import { SignUpForm } from "@/components/SignUpForm";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Sign Up" };

export default function SignUpPage() {
  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-md rounded-2xl border border-neutral-800 bg-neutral-900 p-8 shadow-xl">
        <h1 className="mb-2 text-2xl font-bold text-white">Create an account</h1>
        <p className="mb-8 text-sm text-neutral-400">
          Start free and unlock a 14-day Citizen trial on your first session.
        </p>

        <div className="mb-6 rounded-xl border border-brand-500/20 bg-brand-500/10 p-4 text-sm text-brand-100">
          Trial perks include faster chat, poll creation, watch-party hosting, and ad-light viewing while you decide which creators you want to support.
        </div>

        <SignUpForm />

        <p className="mt-6 text-center text-xs text-neutral-500">
          Want to compare tiers first? <Link href="/pricing" className="text-brand-400 hover:underline">View pricing</Link>
        </p>
      </div>
    </div>
  );
}
