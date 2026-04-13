import type { Metadata } from "next";
import { CreatorDashboard } from "@/components/CreatorDashboard";

export const metadata: Metadata = { title: "Creator Dashboard" };

export default function DashboardPage() {
  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <h1 className="mb-8 text-2xl font-bold text-white">Creator Dashboard</h1>
      <CreatorDashboard />
    </div>
  );
}
