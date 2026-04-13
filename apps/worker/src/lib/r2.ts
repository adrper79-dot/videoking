import type { Env } from "../types";

/**
 * Uploads a buffer to R2 and returns the public URL.
 */
export async function uploadToR2(
  env: Env,
  key: string,
  body: ArrayBuffer,
  contentType: string,
): Promise<string> {
  await env.R2_BUCKET.put(key, body, {
    httpMetadata: { contentType },
  });
  // R2 public URL assumes the bucket is configured with a public domain
  return `https://assets.nichestream.tv/${key}`;
}

/**
 * Deletes an object from R2 by key.
 */
export async function deleteFromR2(env: Env, key: string): Promise<void> {
  await env.R2_BUCKET.delete(key);
}

/**
 * Generates a presigned R2 URL (requires R2 bucket to have presigned URL support).
 * Falls back to a direct key path for development.
 */
export function r2ObjectUrl(key: string): string {
  return `https://assets.nichestream.tv/${key}`;
}
