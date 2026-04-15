import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "@nichestream/db";
import type { Env } from "../types";

/**
 * Creates a Drizzle ORM client connected via Cloudflare Hyperdrive.
 * Hyperdrive wraps the Neon connection string with connection pooling.
 * 
 * Per-request: create fresh database client
 * Connection pooling is managed by Hyperdrive
 */
export function createDb(env: Env) {
  const connection = postgres(env.DB.connectionString, {
    // Hyperdrive manages the pool; allow a few concurrent connections per isolate
    max: 5,
    // Disable prefetching since we use Hyperdrive's pool
    fetch_types: false,
  });
  
  return drizzle(connection, { schema });
}

export type DrizzleClient = ReturnType<typeof createDb>;

