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
  return `https://assets.itsjusus.com/${key}`;
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
  return `https://assets.itsjusus.com/${key}`;
}

/**
 * Factory function for per-request R2 client (convenience wrapper).
 * Returns an object with putObject, getObjectUrl, and deleteObject methods.
 */
export function createR2(env: Env) {
  return {
    async putObject(
      path: string,
      data: ArrayBuffer,
      options?: { httpMetadata?: { contentType?: string } }
    ) {
      await env.R2_BUCKET.put(path, data, options || {});
    },
    getObjectUrl(path: string) {
      return r2ObjectUrl(path);
    },
    async deleteObject(path: string) {
      await deleteFromR2(env, path);
    },
  };
}
