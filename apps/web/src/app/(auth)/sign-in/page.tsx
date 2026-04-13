import type { Metadata } from "next";
import Link from "next/link";
import { SignInForm } from "./SignInForm";

export const metadata: Metadata = { title: "Sign In" };

export default function SignInPage() {
  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-md rounded-2xl border border-neutral-800 bg-neutral-900 p-8 shadow-xl">
        <h1 className="mb-2 text-2xl font-bold text-white">Welcome back</h1>
        <p className="mb-8 text-sm text-neutral-400">
          Sign in to your NicheStream account
        </p>

        <SignInForm />

        <p className="mt-6 text-center text-sm text-neutral-500">
          Don&apos;t have an account?{" "}
          <Link href="/sign-up" className="text-brand-500 hover:underline">
            Sign up
          </Link>
        </p>
      </div>
    </div>
  );
}
