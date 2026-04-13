'use client';

/**
 * Creator verification badge component
 * Displays a verified indicator for creators with blerdart_verified flag
 */
export interface CreatorVerificationBadgeProps {
  verified: boolean;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

export function CreatorVerificationBadge({
  verified,
  size = 'md',
  className = '',
}: CreatorVerificationBadgeProps) {
  if (!verified) return null;

  const sizeClasses = {
    sm: 'w-4 h-4',
    md: 'w-5 h-5',
    lg: 'w-6 h-6',
  };

  return (
    <div
      title="Verified BlerdArt Creator"
      className={`${sizeClasses[size]} ${className}`}
    >
      <svg
        fill="currentColor"
        viewBox="0 0 24 24"
        className="text-purple-500 drop-shadow-sm"
        aria-label="Verified"
      >
        <path d="m10.6 13.4-2.1-2.1a1 1 0 0 0-1.4 1.4l2.8 2.8a1 1 0 0 0 1.4 0l5.6-5.6a1 1 0 0 0-1.4-1.4l-4.9 4.9z" />
        <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.42 0-8-3.58-8-8s3.58-8 8-8 8 3.58 8 8-3.58 8-8 8z" />
      </svg>
    </div>
  );
}

/**
 * Creator info display with optional verification badge
 */
export interface CreatorInfoProps {
  username: string;
  displayName: string;
  avatarUrl?: string | null;
  verified?: boolean;
}

export function CreatorInfo({
  username,
  displayName,
  avatarUrl,
  verified = false,
}: CreatorInfoProps) {
  return (
    <div className="flex items-center gap-3">
      {avatarUrl ? (
        <img
          src={avatarUrl}
          alt={displayName}
          className="w-10 h-10 rounded-full object-cover"
        />
      ) : (
        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-600 to-indigo-600 flex items-center justify-center text-white font-semibold text-sm">
          {displayName.charAt(0).toUpperCase()}
        </div>
      )}
      <div>
        <div className="flex items-center gap-1">
          <p className="font-medium text-white">{displayName}</p>
          {verified && <CreatorVerificationBadge verified size="sm" />}
        </div>
        <p className="text-sm text-gray-400">@{username}</p>
      </div>
    </div>
  );
}

/**
 * Creator profile header with verification status
 */
export interface CreatorProfileHeaderProps {
  displayName: string;
  username: string;
  bio?: string | null;
  avatarUrl?: string | null;
  verified?: boolean;
  subscriberCount?: number;
  videoCount?: number;
}

export function CreatorProfileHeader({
  displayName,
  username,
  bio,
  avatarUrl,
  verified = false,
  subscriberCount = 0,
  videoCount = 0,
}: CreatorProfileHeaderProps) {
  return (
    <div className="bg-gradient-to-br from-slate-800 to-slate-900 rounded-lg p-8 border border-slate-700">
      <div className="flex items-start gap-6 mb-6">
        {avatarUrl ? (
          <img
            src={avatarUrl}
            alt={displayName}
            className="w-24 h-24 rounded-full object-cover border-2 border-purple-500"
          />
        ) : (
          <div className="w-24 h-24 rounded-full bg-gradient-to-br from-purple-600 to-indigo-600 flex items-center justify-center text-white font-bold text-3xl">
            {displayName.charAt(0).toUpperCase()}
          </div>
        )}
        
        <div className="flex-1">
          <div className="flex items-center gap-3 mb-2">
            <h1 className="text-3xl font-bold text-white">{displayName}</h1>
            {verified && (
              <div className="inline-flex items-center gap-1 px-3 py-1 bg-purple-900/30 border border-purple-700 rounded-full">
                <CreatorVerificationBadge verified size="sm" />
                <span className="text-xs font-semibold text-purple-300">Verified Creator</span>
              </div>
            )}
          </div>
          
          <p className="text-gray-400 mb-4">@{username}</p>
          
          {bio && <p className="text-gray-300 mb-4">{bio}</p>}
          
          <div className="flex gap-8">
            <div>
              <p className="text-2xl font-bold text-white">{videoCount}</p>
              <p className="text-sm text-gray-400">Videos</p>
            </div>
            <div>
              <p className="text-2xl font-bold text-white">{subscriberCount.toLocaleString()}</p>
              <p className="text-sm text-gray-400">Subscribers</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
