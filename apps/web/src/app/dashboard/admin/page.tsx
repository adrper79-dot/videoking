import type { Metadata } from "next";
import { AdminPanel } from "@/components/AdminPanel";

export const metadata: Metadata = {
  title: "Admin Dashboard",
};

/**
 * Admin dashboard page for managing BlerdArt creators.
 * Access controlled via middleware — only /admin-accessible routes
 * should reach this page.
 */
export default function AdminPage() {
  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:px-8">
      <AdminPanel />
    </div>
  );
}
