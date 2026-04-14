"use client";

import { useState, useEffect } from "react";

interface EmailPreferencesProps {
  userId: string;
}

interface Preferences {
  trial_alerts: boolean;
  new_videos: boolean;
  watch_party_invites: boolean;
  payout_milestones: boolean;
  referral_bonuses: boolean;
  community_updates: boolean;
}

/**
 * User email preference settings
 * Allows users to control which email notifications they receive
 */
export function EmailPreferences({ userId }: EmailPreferencesProps) {
  const [preferences, setPreferences] = useState<Preferences>({
    trial_alerts: true,
    new_videos: true,
    watch_party_invites: true,
    payout_milestones: true,
    referral_bonuses: true,
    community_updates: false,
  });
  
  const [loading, setLoading] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    // In a real implementation, would fetch from API:
    // const prefs = await fetch(`/api/users/${userId}/email-preferences`);
    // setPreferences(prefs);
  }, [userId]);

  const handleToggle = (key: keyof Preferences) => {
    setPreferences((prev) => ({ ...prev, [key]: !prev[key] }));
    setSaved(false);
  };

  const handleSave = async () => {
    setLoading(true);
    try {
      // In real implementation:
      // await fetch(`/api/users/${userId}/email-preferences`, {
      //   method: "POST",
      //   body: JSON.stringify(preferences),
      // });
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (err) {
      console.error("Failed to save preferences:", err);
    } finally {
      setLoading(false);
    }
  };

  const preferences_list = [
    {
      key: "trial_alerts" as const,
      label: "Trial & Subscription",
      description: "Trial ending, recovery offers, and subscription updates",
    },
    {
      key: "new_videos" as const,
      label: "New Videos",
      description: "When creators you follow upload new content",
    },
    {
      key: "watch_party_invites" as const,
      label: "Watch Party Invites",
      description: "When friends invite you to watch parties",
    },
    {
      key: "payout_milestones" as const,
      label: "Creator Payouts",
      description: "Earnings milestones and payout notifications",
    },
    {
      key: "referral_bonuses" as const,
      label: "Referral Rewards",
      description: "When your referrals convert and you earn bonuses",
    },
    {
      key: "community_updates" as const,
      label: "Community Updates",
      description: "NicheStream news, platform features, and announcements",
    },
  ];

  return (
    <div className="space-y-6 rounded-lg border border-neutral-800 bg-neutral-900 p-6">
      <div>
        <h2 className="text-xl font-bold text-white">Email Notifications</h2>
        <p className="mt-1 text-sm text-neutral-400">
          Choose which emails you'd like to receive from NicheStream
        </p>
      </div>

      <div className="space-y-3">
        {preferences_list.map(({ key, label, description }) => (
          <div
            key={key}
            className="flex items-center justify-between rounded-lg border border-neutral-700 bg-neutral-800/50 p-4"
          >
            <div>
              <p className="font-medium text-white">{label}</p>
              <p className="text-sm text-neutral-400">{description}</p>
            </div>
            <button
              onClick={() => handleToggle(key)}
              className={`relative h-7 w-12 rounded-full transition ${
                preferences[key] ? "bg-brand-600" : "bg-neutral-600"
              }`}
              role="switch"
              aria-checked={preferences[key]}
              aria-label={`Toggle ${label}`}
            >
              <div
                className={`absolute top-1 h-5 w-5 rounded-full bg-white transition-transform ${
                  preferences[key] ? "translate-x-6" : "translate-x-1"
                }`}
              />
            </button>
          </div>
        ))}
      </div>

      {saved && (
        <div className="rounded-lg border border-emerald-900/50 bg-emerald-950/30 p-3">
          <p className="text-sm text-emerald-200">✓ Preferences saved successfully</p>
        </div>
      )}

      <button
        onClick={() => void handleSave()}
        disabled={loading || saved}
        className="rounded-lg bg-brand-600 px-6 py-2 font-semibold text-white transition hover:bg-brand-700 disabled:opacity-50"
      >
        {loading ? "Saving..." : saved ? "Saved ✓" : "Save Preferences"}
      </button>

      <div className="rounded-lg border border-neutral-700 bg-neutral-800/30 p-4">
        <p className="text-xs text-neutral-400">
          💡 Even with emails disabled, important notifications (trial ending, suspicious activity) may still be sent for your security and account management.
        </p>
      </div>
    </div>
  );
}
