import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "@nichestream/db";
import type { Env } from "../types";

/**
 * Per-isolate DB client cache. Cloudflare Workers reuse the same isolate across
 * many requests, so caching at module scope avoids re-initialising the postgres
 * client (and burning Hyperdrive connections) on every request.
 *
 * The cache is keyed by connection string so that workers with different Hyperdrive
 * bindings (e.g. staging vs. production) never share a client.
 */
const clientCache = new Map<string, ReturnType<typeof drizzle>>();

/**
 * Returns a Drizzle ORM client connected via Cloudflare Hyperdrive.
 * Subsequent calls from the same isolate with the same connection string return
 * the cached instance instead of opening a new postgres pool.
 */
export function createDb(env: Env) {
  const connectionString = env.DB.connectionString;

  const cached = clientCache.get(connectionString);
  if (cached) return cached;

  const connection = postgres(connectionString, {
    // Hyperdrive manages the external pool; keep isolate-side pool small.
    max: 5,
    // Disable prefetching since we use Hyperdrive's pool
    fetch_types: false,
  });

  const db = drizzle(connection, { schema });
  clientCache.set(connectionString, db);
  return db;
}

export type DrizzleClient = ReturnType<typeof createDb>;

