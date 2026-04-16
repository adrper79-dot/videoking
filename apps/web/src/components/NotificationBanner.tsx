"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { api } from "@/lib/api";
import { useEntitlements } from "@/components/EntitlementsContext";

export interface Notification {
  id: string;
  type: string;
  title: string;
  message: string;
  ctaUrl?: string;
  ctaLabel?: string;
  priority: number;
  status: string;
}

/**
 * Fetches and displays pending notifications to the user.
 * Only fetches when the user is authenticated (no unnecessary 401s for public pages).
 */
export function NotificationBanner() {
  const { entitlements } = useEntitlements();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());

  // Fetch notifications only for authenticated users
  useEffect(() => {
    if (!entitlements?.authenticated) {
      setLoading(false);
      return;
    }

    const fetchNotifications = async () => {
      try {
        setLoading(true);
        const data = await api.get<Notification[]>("/api/notifications");
        setNotifications(data || []);
      } catch (error) {
        console.error("Failed to fetch notifications:", error);
      } finally {
        setLoading(false);
      }
    };

    void fetchNotifications();
  }, [entitlements?.authenticated]);

  const handleDismiss = async (notificationId: string) => {
    setDismissed((prev) => new Set(prev).add(notificationId));
    try {
      await api.post(`/api/notifications/${notificationId}/dismiss`, {});
    } catch (error) {
      console.error("Failed to dismiss notification:", error);
    }
  };

  const handleAction = async (notificationId: string) => {
    try {
      await api.post(`/api/notifications/${notificationId}/action`, {});
      setDismissed((prev) => new Set(prev).add(notificationId));
    } catch (error) {
      console.error("Failed to mark notification as actioned:", error);
    }
  };

  // Filter out dismissed notifications
  const visibleNotifications = notifications.filter(
    (n) => !dismissed.has(n.id)
  );

  if (loading || visibleNotifications.length === 0) {
    return null;
  }

  // Sort by priority (urgent first)
  const sorted = [...visibleNotifications].sort((a, b) => b.priority - a.priority);
  const topNotification = sorted[0];

  if (!topNotification) {
    return null;
  }

  // Determine styling based on notification type and priority
  const getStyles = (type: string, priority: number) => {
    if (type.includes("trial_end") || priority > 1) {
      return {
        bg: "bg-amber-950/50",
        border: "border-amber-900/50",
        text: "text-amber-200",
        button: "text-amber-300 hover:bg-amber-900/30",
      };
    }
    if (type.includes("referral") || type.includes("milestone")) {
      return {
        bg: "bg-emerald-950/50",
        border: "border-emerald-900/50",
        text: "text-emerald-200",
        button: "text-emerald-300 hover:bg-emerald-900/30",
      };
    }
    return {
      bg: "bg-blue-950/50",
      border: "border-blue-900/50",
      text: "text-blue-200",
      button: "text-blue-300 hover:bg-blue-900/30",
    };
  };

  const styles = getStyles(topNotification.type, topNotification.priority);

  return (
    <div
      className={`border-b ${styles.border} ${styles.bg} px-4 py-2`}
      role="alert"
      aria-live="polite"
    >
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-3">
        <div className="flex-1">
          <h3 className={`text-sm font-semibold ${styles.text}`}>
            {topNotification.title}
          </h3>
          <p className={`text-sm ${styles.text} opacity-90`}>
            {topNotification.message}
          </p>
        </div>

        <div className="flex items-center gap-2">
          {topNotification.ctaUrl && (
            <Link
              href={topNotification.ctaUrl}
              onClick={() => void handleAction(topNotification.id)}
              className={`rounded px-3 py-1 text-xs font-semibold transition ${styles.button}`}
            >
              {topNotification.ctaLabel || "Learn More"}
            </Link>
          )}
          <button
            onClick={() => void handleDismiss(topNotification.id)}
            className={`rounded px-2 py-1 text-xs font-semibold transition ${styles.button}`}
            aria-label="Dismiss notification"
          >
            ✕
          </button>
        </div>
      </div>
    </div>
  );
}
