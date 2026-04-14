"use client";

/**
 * VIP-only feature components and utilities
 */

interface VIPBadgeProps {
  size?: "sm" | "md" | "lg";
  text?: boolean;
}

export function VIPBadge({ size = "md", text = false }: VIPBadgeProps) {
  const sizeClasses = {
    sm: "h-4 w-4",
    md: "h-5 w-5",
    lg: "h-6 w-6",
  };

  return (
    <div className="flex items-center gap-1.5">
      <div className={`${sizeClasses[size]} rounded-full bg-amber-500 flex items-center justify-center`}>
        <svg
          className="h-3 w-3 text-white"
          fill="currentColor"
          viewBox="0 0 20 20"
        >
          <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
        </svg>
      </div>
      {text && <span className="text-xs font-semibold text-amber-300">VIP</span>}
    </div>
  );
}

/**
 * Feature gate component for VIP-only features
 */
interface VIPFeatureProps {
  children: React.ReactNode;
  isVIP: boolean;
  fallback?: React.ReactNode;
}

export function VIPFeature({ children, isVIP, fallback }: VIPFeatureProps) {
  if (!isVIP) {
    return (
      fallback || (
        <div className="rounded-lg border border-amber-900/50 bg-amber-950/30 p-4">
          <p className="text-sm text-amber-200">
            This feature is available for VIP members. <a href="/pricing" className="underline">Upgrade now</a>.
          </p>
        </div>
      )
    );
  }

  return <>{children}</>;
}

/**
 * Display VIP perks summary
 */
export function VIPPerksSummary() {
  return (
    <div className="space-y-3 rounded-lg border border-amber-900/50 bg-amber-950/30 p-4">
      <div className="flex items-center gap-2">
        <VIPBadge size="md" />
        <h3 className="font-semibold text-amber-200">You have VIP access</h3>
      </div>
      <ul className="space-y-2 text-sm text-amber-100">
        <li className="flex items-start gap-2">
          <span className="mt-0.5">✓</span>
          <span>Private 1:1 watch parties with creators</span>
        </li>
        <li className="flex items-start gap-2">
          <span className="mt-0.5">✓</span>
          <span>Download videos for offline viewing</span>
        </li>
        <li className="flex items-start gap-2">
          <span className="mt-0.5">✓</span>
          <span>Exclusive VIP chat badge and recognition</span>
        </li>
        <li className="flex items-start gap-2">
          <span className="mt-0.5">✓</span>
          <span>Priority support and direct creator access</span>
        </li>
      </ul>
    </div>
  );
}
