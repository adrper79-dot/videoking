import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "@nichestream/db";
import type { Env } from "../types";

/**
 * Creates a Drizzle ORM client connected via Cloudflare Hyperdrive.
 * Hyperdrive wraps the Neon connection string with connection pooling,
 * so each call creates a lightweight postgres.js client backed by the
 * Hyperdrive proxy — actual TCP connections are managed by Hyperdrive,
 * not by the per-request client.
 */
export function createDb(env: Env) {
  const connection = postgres(env.DB.connectionString, {
    // Hyperdrive manages the external pool; limit isolate-side concurrency.
    max: 5,
    // Disable prefetching since we use Hyperdrive's pool.
    fetch_types: false,
  });

  return drizzle(connection, { schema });
}

export type DrizzleClient = ReturnType<typeof createDb>;

