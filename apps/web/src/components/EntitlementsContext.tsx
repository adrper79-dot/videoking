"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { api } from "@/lib/api";
import type { AuthEntitlements } from "@nichestream/types";

/**
 * EntitlementsContext provides user authentication and subscription entitlements
 * to the entire application without requiring each component to fetch independently.
 */
interface EntitlementsContextType {
  entitlements: AuthEntitlements | null;
  loading: boolean;
  error: boolean;
  refetch: () => Promise<void>;
}

const EntitlementsContext = createContext<EntitlementsContextType | undefined>(undefined);

/**
 * EntitlementsProvider wraps the application and fetches entitlements once at the root level.
 * All child components can access via useEntitlements().
 */
export function EntitlementsProvider({ children }: { children: React.ReactNode }) {
  const [entitlements, setEntitlements] = useState<AuthEntitlements | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const fetchEntitlements = async () => {
    try {
      setLoading(true);
      setError(false);
      const data = await api.get<AuthEntitlements>("/api/auth/entitlements");
      setEntitlements(data);
    } catch {
      setEntitlements(null);
      setError(true);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void fetchEntitlements();
  }, []);

  return (
    <EntitlementsContext.Provider
      value={{
        entitlements,
        loading,
        error,
        refetch: fetchEntitlements,
      }}
    >
      {children}
    </EntitlementsContext.Provider>
  );
}

/**
 * Hook to access entitlements context from any child component.
 * @throws Error if used outside EntitlementsProvider
 */
export function useEntitlements(): EntitlementsContextType {
  const context = useContext(EntitlementsContext);
  if (!context) {
    throw new Error("useEntitlements must be used within EntitlementsProvider");
  }
  return context;
}
