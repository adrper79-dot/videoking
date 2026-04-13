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
  /** Chat throttling controls by tier */
  CHAT_RATE_LIMIT_FREE_MS?: string;
  CHAT_RATE_LIMIT_CITIZEN_MS?: string;
  CHAT_RATE_LIMIT_VIP_MS?: string;
  /** Trial length in days */
  TRIAL_PERIOD_DAYS?: string;
}
