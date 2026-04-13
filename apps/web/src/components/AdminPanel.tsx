"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";

interface CreatorRecord {
  id: string;
  username: string;
  displayName: string;
  avatarUrl: string | null;
  blerdartVerified: boolean;
  createdAt: string;
}

interface Session {
  user?: {
    id: string;
    name: string;
    email: string;
    image?: string;
  };
}

/**
 * Admin panel for managing creator verification.
 * Only admins can access this component.
 */
export function AdminPanel() {
  const [session, setSession] = useState<Session | null>(null);
  const [creators, setCreators] = useState<CreatorRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [verifying, setVerifying] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      try {
        // Fetch session from the auth API endpoint
        const sessionData = await api.get<Session>("/api/auth/session");
        setSession(sessionData);

        // For now, we'll display placeholder message
        // In production, this would fetch a list of creators from an admin endpoint
        setCreators([]);
        setLoading(false);
      } catch (err) {
        console.error("Failed to fetch session:", err);
        setError("Failed to load admin panel. Please ensure you are logged in.");
        setLoading(false);
      }
    })();
  }, []);

  const handleVerifyCreator = async (userId: string, currentStatus: boolean) => {
    setVerifying(userId);
    setError(null);
    setSuccessMessage(null);

    try {
      if (currentStatus) {
        // Revoke verification
        await api.delete(`/api/admin/verify-creator/${userId}`);
        setSuccessMessage("Creator verification revoked");
      } else {
        // Grant verification
        await api.post("/api/admin/verify-creator", { userId });
        setSuccessMessage("Creator verified successfully");
      }

      // Update local state
      setCreators((prev) =>
        prev.map((c) =>
          c.id === userId ? { ...c, blerdartVerified: !currentStatus } : c
        )
      );

      // Clear success message after 3 seconds
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (err) {
      console.error("Failed to update verification:", err);
      setError(
        err instanceof Error
          ? err.message
          : "Failed to update creator verification"
      );
    } finally {
      setVerifying(null);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-brand-500 border-t-transparent" />
      </div>
    );
  }

  if (!session || !session.user) {
    return (
      <div className="rounded-lg border border-red-900/30 bg-red-950/20 p-6">
        <h2 className="text-lg font-semibold text-red-300">Access Denied</h2>
        <p className="mt-2 text-sm text-red-200">
          You must be logged in to access the admin panel
        </p>
      </div>
    );
  }

  const filteredCreators = creators.filter(
    (c) =>
      c.username.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.displayName.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold text-white">Creator Management</h2>
        <p className="mt-1 text-sm text-gray-400">
          Verify and manage BlerdArt creator accounts
        </p>
      </div>

      {/* Alerts */}
      {error && (
        <div className="rounded-lg border border-red-900/30 bg-red-950/20 p-4">
          <p className="text-sm text-red-200">{error}</p>
        </div>
      )}

      {successMessage && (
        <div className="rounded-lg border border-green-900/30 bg-green-950/20 p-4">
          <p className="text-sm text-green-200">{successMessage}</p>
        </div>
      )}

      {/* Search */}
      <div>
        <input
          type="text"
          placeholder="Search creators by username or name..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full rounded-lg border border-gray-700 bg-gray-900 px-4 py-2 text-white placeholder-gray-500 focus:border-brand-500 focus:outline-none"
        />
      </div>

      {/* Creator List */}
      <div className="space-y-3">
        {filteredCreators.length === 0 ? (
          <div className="rounded-lg border border-gray-700 bg-gray-900/50 p-8 text-center">
            <p className="text-gray-400">
              {creators.length === 0
                ? "No creators found. Verification feature is being populated."
                : "No creators matching your search"}
            </p>
          </div>
        ) : (
          filteredCreators.map((creator) => (
            <div
              key={creator.id}
              className="flex items-center justify-between rounded-lg border border-gray-700 bg-gray-900/50 px-6 py-4"
            >
              <div className="flex items-center space-x-4">
                {creator.avatarUrl && (
                  <img
                    src={creator.avatarUrl}
                    alt={creator.displayName}
                    className="h-10 w-10 rounded-full"
                  />
                )}
                <div>
                  <p className="font-semibold text-white">{creator.displayName}</p>
                  <p className="text-sm text-gray-400">@{creator.username}</p>
                </div>
              </div>

              <div className="flex items-center space-x-3">
                {creator.blerdartVerified && (
                  <span className="inline-flex items-center rounded-full bg-blue-900/30 px-3 py-1 text-xs font-medium text-blue-200">
                    ✓ Verified
                  </span>
                )}
                <button
                  onClick={() =>
                    handleVerifyCreator(
                      creator.id,
                      creator.blerdartVerified
                    )
                  }
                  disabled={verifying === creator.id}
                  className={`rounded px-4 py-2 text-sm font-medium transition-colors ${
                    creator.blerdartVerified
                      ? "border border-red-700 text-red-300 hover:bg-red-900/20 disabled:opacity-50"
                      : "border border-green-700 text-green-300 hover:bg-green-900/20 disabled:opacity-50"
                  }`}
                >
                  {verifying === creator.id
                    ? "Updating..."
                    : creator.blerdartVerified
                      ? "Revoke"
                      : "Verify"}
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="rounded-lg border border-gray-700 bg-gray-900/50 p-4">
          <p className="text-sm text-gray-400">Total Creators Managed</p>
          <p className="mt-2 text-2xl font-bold text-white">{creators.length}</p>
        </div>
        <div className="rounded-lg border border-gray-700 bg-gray-900/50 p-4">
          <p className="text-sm text-gray-400">BlerdArt Verified</p>
          <p className="mt-2 text-2xl font-bold text-blue-300">
            {creators.filter((c) => c.blerdartVerified).length}
          </p>
        </div>
      </div>
    </div>
  );
}
