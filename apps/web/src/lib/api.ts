const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8787";

class ApiError extends Error {
  constructor(
    public statusCode: number,
    message: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

/**
 * Low-level fetch wrapper that prepends the API base URL and handles
 * JSON parsing and error propagation.
 */
async function fetchApi<T>(
  path: string,
  init: RequestInit = {},
): Promise<T> {
  const url = `${API_BASE_URL}${path}`;

  const res = await fetch(url, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...init.headers,
    },
    credentials: "include",
  });

  if (!res.ok) {
    let message = `HTTP ${res.status}`;
    try {
      const json = (await res.json()) as { message?: string };
      message = json.message ?? message;
    } catch {
      // ignore
    }
    throw new ApiError(res.status, message);
  }

  return res.json() as Promise<T>;
}

/** Typed API client with GET, POST, PATCH, DELETE helpers. */
export const api = {
  get<T>(path: string, init?: RequestInit): Promise<T> {
    return fetchApi<T>(path, { ...init, method: "GET" });
  },

  post<T>(path: string, body: unknown, init?: RequestInit): Promise<T> {
    return fetchApi<T>(path, {
      ...init,
      method: "POST",
      body: JSON.stringify(body),
    });
  },

  patch<T>(path: string, body: unknown, init?: RequestInit): Promise<T> {
    return fetchApi<T>(path, {
      ...init,
      method: "PATCH",
      body: JSON.stringify(body),
    });
  },

  delete<T>(path: string, init?: RequestInit): Promise<T> {
    return fetchApi<T>(path, { ...init, method: "DELETE" });
  },
};

/**
 * Log an ad impression (Phase 3)
 * Fire-and-forget; doesn't block user experience
 */
export async function logAdImpression(
  videoId: string,
  eventType: string = "impression",
  timestamp?: string,
) {
  return fetch(`${API_BASE_URL}/api/ads/track`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      videoId,
      eventType,
      timestamp,
    }),
  }).catch((err) => console.error("Ad logging failed:", err));
}

export { ApiError };
