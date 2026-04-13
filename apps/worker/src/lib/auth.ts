import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import type { DrizzleClient } from "./db";
import type { Env } from "../types";
import * as schema from "@nichestream/db";

/**
 * Creates a BetterAuth instance configured with Drizzle adapter.
 * Called once per request using the per-request DB connection.
 */
export function createAuth(db: DrizzleClient, env: Env) {
  return betterAuth({
    secret: env.BETTER_AUTH_SECRET,
    baseURL: env.APP_BASE_URL,
    database: drizzleAdapter(db, {
      provider: "pg",
      schema: {
        user: schema.users,
        session: schema.sessions,
        account: schema.accounts,
        verification: schema.verifications,
      },
    }),
    emailAndPassword: {
      enabled: true,
      requireEmailVerification: false,
      minPasswordLength: 8,
    },
    session: {
      expiresIn: 60 * 60 * 24 * 30, // 30 days
      updateAge: 60 * 60 * 24,       // refresh if >1 day old
    },
  });
}

export type AuthInstance = ReturnType<typeof createAuth>;
