import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "@nichestream/db";
import type { Env } from "../types";

// Per-isolate cache: store client at module scope
// Safe because postgres client manages its own connection pool
let cachedPostgresClient: postgres.Sql | undefined;

/**
 * Creates a Drizzle ORM client connected via Cloudflare Hyperdrive.
 * Hyperdrive wraps the Neon connection string with connection pooling.
 * 
 * OPTIMIZATION (XC-1): Caches the postgres client at isolate level.
 * Reuses same client across requests within the same Worker isolate,
 * avoiding redundant connection initialization while relying on Hyperdrive's
 * connection pool for safe resource management.
 */
export function createDb(env: Env) {
  // Return cached client if already initialized
  if (cachedPostgresClient) {
    return drizzle(cachedPostgresClient, { schema });
  }

  // Create new postgres client only once per isolate
  cachedPostgresClient = postgres(env.DB.connectionString, {
    // Hyperdrive manages the pool; allow a few concurrent connections per isolate
    max: 5,
    // Disable prefetching since we use Hyperdrive's pool
    fetch_types: false,
  });
  
  return drizzle(cachedPostgresClient, { schema });
}

export type DrizzleClient = ReturnType<typeof createDb>;

