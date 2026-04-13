import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "@nichestream/db";
import type { Env } from "../types";

/**
 * Creates a Drizzle ORM client connected via Cloudflare Hyperdrive.
 * Hyperdrive wraps the Neon connection string with connection pooling.
 */
export function createDb(env: Env) {
  const client = postgres(env.DB.connectionString, {
    // Hyperdrive manages the pool; single connection per Worker invocation
    max: 1,
    // Disable prefetching since we use Hyperdrive's pool
    fetch_types: false,
  });
  return drizzle(client, { schema });
}

export type DrizzleClient = ReturnType<typeof createDb>;
