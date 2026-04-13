import type { Hyperdrive, R2Bucket, DurableObjectNamespace, Fetcher } from "@cloudflare/workers-types";

/** Cloudflare Worker environment bindings for NicheStream API. */
export interface Env {
  /** Hyperdrive binding pointing to Neon PostgreSQL */
  DB: Hyperdrive;
  /** Cloudflare Stream API token */
  STREAM_API_TOKEN: string;
  /** Cloudflare account ID for Stream */
  STREAM_ACCOUNT_ID: string;
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
  /** Pages assets fetcher */
  ASSETS: Fetcher;
}
