import type { Env } from "../types";

const STREAM_BASE = "https://api.cloudflare.com/client/v4/accounts";

interface StreamDirectUploadResponse {
  result: {
    uid: string;
    uploadURL: string;
  };
  success: boolean;
  errors: Array<{ code: number; message: string }>;
}

interface StreamVideoDetails {
  result: {
    uid: string;
    status: { state: string };
    thumbnail: string;
    duration: number;
    playback: { hls: string; dash: string };
    meta: Record<string, string>;
  };
  success: boolean;
}

/**
 * Requests a one-time direct upload URL from Cloudflare Stream.
 * The client uploads the video file directly to this URL.
 */
export async function getDirectUploadUrl(
  env: Env,
  maxDurationSeconds = 3600,
): Promise<{ uploadUrl: string; streamVideoId: string }> {
  const res = await fetch(
    `${STREAM_BASE}/${env.STREAM_ACCOUNT_ID}/stream/direct_upload`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${env.STREAM_API_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        maxDurationSeconds,
        requireSignedURLs: false,
      }),
    },
  );

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Stream API error: ${res.status} ${text}`);
  }

  const data = (await res.json()) as StreamDirectUploadResponse;

  if (!data.success) {
    throw new Error(`Stream API error: ${JSON.stringify(data.errors)}`);
  }

  return {
    uploadUrl: data.result.uploadURL,
    streamVideoId: data.result.uid,
  };
}

/**
 * Fetches video metadata from Cloudflare Stream.
 */
export async function getStreamVideo(
  env: Env,
  streamVideoId: string,
): Promise<StreamVideoDetails["result"]> {
  const res = await fetch(
    `${STREAM_BASE}/${env.STREAM_ACCOUNT_ID}/stream/${streamVideoId}`,
    {
      headers: { Authorization: `Bearer ${env.STREAM_API_TOKEN}` },
    },
  );

  if (!res.ok) {
    throw new Error(`Stream API error: ${res.status}`);
  }

  const data = (await res.json()) as StreamVideoDetails;
  return data.result;
}

/**
 * Generates a signed URL for a private Cloudflare Stream video.
 * Signed URLs expire after the given duration (default 1 hour).
 */
export async function getSignedStreamUrl(
  env: Env,
  streamVideoId: string,
  expiresInSeconds = 3600,
): Promise<string> {
  const expiry = Math.floor(Date.now() / 1000) + expiresInSeconds;

  const res = await fetch(
    `${STREAM_BASE}/${env.STREAM_ACCOUNT_ID}/stream/${streamVideoId}/token`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${env.STREAM_API_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ exp: expiry }),
    },
  );

  if (!res.ok) {
    throw new Error(`Stream signed URL error: ${res.status}`);
  }

  const data = (await res.json()) as { result: { token: string }; success: boolean };
  return `https://customer-${env.STREAM_ACCOUNT_ID}.cloudflarestream.com/${data.result.token}/iframe`;
}

/**
 * Fetches analytics for a specific video from Cloudflare Stream.
 */
export async function getVideoAnalytics(
  env: Env,
  streamVideoId: string,
): Promise<{ views: number; watchTimeMinutes: number }> {
  const res = await fetch(
    `${STREAM_BASE}/${env.STREAM_ACCOUNT_ID}/stream/${streamVideoId}/analytics/views`,
    {
      headers: { Authorization: `Bearer ${env.STREAM_API_TOKEN}` },
    },
  );

  if (!res.ok) {
    return { views: 0, watchTimeMinutes: 0 };
  }

  const data = (await res.json()) as {
    result: { totals: { views: number; minutesViewed: number } };
  };

  return {
    views: data.result?.totals?.views ?? 0,
    watchTimeMinutes: data.result?.totals?.minutesViewed ?? 0,
  };
}
