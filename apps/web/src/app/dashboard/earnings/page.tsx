import type { Metadata } from "next";
import { EarningsTable } from "@/components/EarningsTable";

export const metadata: Metadata = { title: "Earnings" };

export default function EarningsPage() {
  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <h1 className="mb-8 text-2xl font-bold text-white">Earnings</h1>
      <EarningsTable />
    </div>
  );
}
