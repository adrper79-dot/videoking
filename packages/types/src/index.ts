// ─── User Types ──────────────────────────────────────────────────────────────

export type UserRole = "viewer" | "creator" | "admin";

export interface User {
  id: string;
  email: string;
  username: string;
  displayName: string;
  avatarUrl: string | null;
  role: UserRole;
  bio: string | null;
  website: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface PublicUser {
  id: string;
  username: string;
  displayName: string;
  avatarUrl: string | null;
  bio: string | null;
  website: string | null;
}

// ─── Video Types ──────────────────────────────────────────────────────────────

export type VideoStatus = "processing" | "ready" | "live" | "unlisted" | "deleted";
export type VideoVisibility = "public" | "subscribers_only" | "unlocked_only";

export interface Video {
  id: string;
  creatorId: string;
  cloudflareStreamId: string;
  title: string;
  description: string | null;
  thumbnailUrl: string | null;
  durationSeconds: number | null;
  status: VideoStatus;
  visibility: VideoVisibility;
  viewsCount: number;
  likesCount: number;
  createdAt: string;
  updatedAt: string;
  publishedAt: string | null;
  creator?: PublicUser;
}

export interface VideoUploadUrlResponse {
  uploadUrl: string;
  videoId: string;
  streamVideoId: string;
}

// ─── Subscription Types ────────────────────────────────────────────────────────

export type SubscriptionPlan = "monthly" | "annual";
export type SubscriptionStatus = "active" | "canceled" | "past_due";

export interface Subscription {
  id: string;
  subscriberId: string;
  creatorId: string;
  stripeSubscriptionId: string;
  stripeCustomerId: string;
  plan: SubscriptionPlan;
  status: SubscriptionStatus;
  currentPeriodEnd: string;
  createdAt: string;
}

// ─── Earnings Types ────────────────────────────────────────────────────────────

export type EarningType = "subscription_share" | "unlock_purchase" | "tip";
export type EarningStatus = "pending" | "transferred" | "failed";

export interface Earning {
  id: string;
  creatorId: string;
  videoId: string | null;
  type: EarningType;
  grossAmountCents: number;
  platformFeeCents: number;
  netAmountCents: number;
  stripeTransferId: string | null;
  stripePaymentIntentId: string | null;
  status: EarningStatus;
  createdAt: string;
}

export interface EarningsSummary {
  totalGrossCents: number;
  totalNetCents: number;
  pendingCents: number;
  transferredCents: number;
  breakdown: {
    subscriptionShareCents: number;
    unlockPurchaseCents: number;
    tipCents: number;
  };
}

// ─── Chat & Interaction Types ─────────────────────────────────────────────────

export type ChatMessageType = "message" | "reaction" | "system";

export interface ChatMessage {
  id: string;
  videoId: string;
  userId: string;
  content: string;
  type: ChatMessageType;
  isDeleted: boolean;
  createdAt: string;
  user?: PublicUser;
}

export interface PollOption {
  id: string;
  text: string;
}

export type PollStatus = "active" | "closed";

export interface Poll {
  id: string;
  videoId: string;
  creatorId: string;
  question: string;
  options: PollOption[];
  status: PollStatus;
  endsAt: string | null;
  createdAt: string;
  votes?: Record<string, number>; // optionId -> count
  userVote?: string | null;       // current user's vote
}

// ─── WebSocket Message Types ───────────────────────────────────────────────────

export type WSMessageType =
  | "join"
  | "leave"
  | "chat_message"
  | "reaction"
  | "poll_create"
  | "poll_vote"
  | "poll_update"
  | "watch_party_sync"
  | "user_presence"
  | "error"
  | "room_state";

export interface WSMessage {
  type: WSMessageType;
  payload: Record<string, unknown>;
  timestamp: string;
}

export interface RoomState {
  connectedCount: number;
  recentMessages: ChatMessage[];
  activePoll: Poll | null;
  reactionCounts: Record<string, number>;
}

// ─── Playlist Types ────────────────────────────────────────────────────────────

export interface Playlist {
  id: string;
  creatorId: string;
  title: string;
  description: string | null;
  thumbnailUrl: string | null;
  createdAt: string;
  videos?: Video[];
}

// ─── Stripe / Payments ────────────────────────────────────────────────────────

export interface ConnectedAccount {
  id: string;
  userId: string;
  stripeAccountId: string;
  chargesEnabled: boolean;
  payoutsEnabled: boolean;
  onboardingComplete: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface SubscriptionCheckoutResponse {
  checkoutUrl: string;
  sessionId: string;
}

export interface UnlockPaymentResponse {
  clientSecret: string;
  paymentIntentId: string;
}

// ─── Moderation Types ─────────────────────────────────────────────────────────

export type ContentType = "video" | "chat_message";
export type ReportStatus = "pending" | "resolved" | "dismissed";

export interface ModerationReport {
  id: string;
  reporterId: string;
  contentType: ContentType;
  contentId: string;
  reason: string;
  status: ReportStatus;
  notes: string | null;
  createdAt: string;
  resolvedAt: string | null;
}

// ─── API Response Types ────────────────────────────────────────────────────────

export interface ApiError {
  error: string;
  message: string;
  statusCode: number;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
  hasMore: boolean;
}

export interface VideoAnalytics {
  videoId: string;
  views: number;
  uniqueViewers: number;
  watchTimeMinutes: number;
  averageViewDurationSeconds: number;
  peakConcurrentViewers: number;
}

export interface DashboardAnalytics {
  totalViews: number;
  totalWatchTimeMinutes: number;
  subscriberCount: number;
  recentVideos: VideoAnalytics[];
}
