import type { Hyperdrive, R2Bucket, DurableObjectNamespace } from "@cloudflare/workers-types";

/** Cloudflare Worker environment bindings for NicheStream API. */
export interface Env {
  /** Hyperdrive binding pointing to Neon PostgreSQL */
  DB: Hyperdrive;
  /** Cloudflare Stream API token */
  STREAM_API_TOKEN: string;
  /** Cloudflare account ID for Stream */
  STREAM_ACCOUNT_ID: string;
  /**
   * Cloudflare Stream customer subdomain (the unique domain prefix shown in the
   * Stream dashboard under "Customer Domain", e.g. "abc123" for
   * https://customer-abc123.cloudflarestream.com).
   * This is distinct from the account ID.
   */
  STREAM_CUSTOMER_DOMAIN: string;
  /** Stripe secret key */
  STRIPE_SECRET_KEY: string;
  /** Stripe Connect OAuth client ID */
  STRIPE_CONNECT_CLIENT_ID: string;
  /** Stripe webhook signing secret */
  STRIPE_WEBHOOK_SECRET: string;
  /** Stripe Connect return URL base */
  APP_BASE_URL: string;
  /** Platform fee percentage (e.g. "20" for 20%) */
  PLATFORM_FEE_PERCENT: string;
  /** R2 bucket for thumbnails / uploads */
  R2_BUCKET: R2Bucket;
  /** Durable Object namespace for video rooms */
  VIDEO_ROOM: DurableObjectNamespace;
  /** Durable Object namespace for user presence */
  USER_PRESENCE: DurableObjectNamespace;
  /** BetterAuth secret */
  BETTER_AUTH_SECRET: string;
  /** Stripe price IDs used for plan validation */
  STRIPE_CITIZEN_MONTHLY_PRICE?: string;
  STRIPE_CITIZEN_ANNUAL_PRICE?: string;
  STRIPE_VIP_MONTHLY_PRICE?: string;
  STRIPE_VIP_ANNUAL_PRICE?: string;
  /** Chat throttling controls by tier */
  CHAT_RATE_LIMIT_FREE_MS?: string;
  CHAT_RATE_LIMIT_CITIZEN_MS?: string;
  CHAT_RATE_LIMIT_VIP_MS?: string;
  /** Trial length in days */
  TRIAL_PERIOD_DAYS?: string;
  /** Email service API key (Resend, SendGrid, etc) */
  EMAIL_API_KEY?: string;
  /** Email preferences enabled */
  ENABLE_EMAIL_NOTIFICATIONS?: string;
  /** Ad click-through destination URL (shown in VAST ClickThrough element) */
  AD_CLICK_THROUGH_URL?: string;
  /** Ad video asset URL served via /api/ads/ad-tag redirect */
  AD_VIDEO_URL?: string;
}

/**
 * Required environment variable keys.
 * The worker will return 503 on all requests if any of these are missing.
 */
const REQUIRED_ENV_KEYS: (keyof Env)[] = [
  "DB",
  "BETTER_AUTH_SECRET",
  "STRIPE_SECRET_KEY",
  "STRIPE_WEBHOOK_SECRET",
  "STREAM_API_TOKEN",
  "STREAM_ACCOUNT_ID",
  "APP_BASE_URL",
];

/**
 * Validates that all required environment bindings are present.
 * Returns an array of missing key names; empty array means all good.
 */
export function getMissingEnvKeys(env: Env): string[] {
  return REQUIRED_ENV_KEYS.filter((key) => !env[key] || env[key] === "");
}
