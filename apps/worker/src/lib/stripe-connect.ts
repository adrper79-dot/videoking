/**
 * Stripe Connect OAuth Handler
 * 
 * Manages the OAuth flow for creator Stripe Connect Express accounts.
 * 
 * Flow:
 * 1. Creator clicks "Connect Bank Account" in dashboard
 * 2. Redirects to /api/stripe/connect/authorize
 * 3. This handler redirects to Stripe's OAuth authorize endpoint
 * 4. Creator grants access
 * 5. Stripe redirects to /api/stripe/connect/callback with authorization code
 * 6. Exchange code for connected account ID and store in DB
 * 7. Redirect to dashboard with success message
 */

import type { Context } from "hono";
import Stripe from "stripe";
import { createDb } from "./db";
import { createAuth } from "./auth";
import type { Env } from "../types";

export class StripeConnectOAuth {
  private _stripe: Stripe;
  private env: Env;

  constructor(stripeSecretKey: string, env: Env) {
    this._stripe = new Stripe(stripeSecretKey);
    this.env = env;
  }

  /**
   * Generate Stripe Connect OAuth authorization URL
   * Creator redirects to this URL to grant access
   * 
   * Returns: Full authorization URL
   */
  generateAuthUrl(userId: string): string {
    const params = new URLSearchParams({
      client_id: this.env.STRIPE_CONNECT_CLIENT_ID || "",
      state: encodeURIComponent(JSON.stringify({ user_id: userId })),
      stripe_user: JSON.stringify({
        business_type: "individual",
        url: `${this.env.APP_BASE_URL}/channel/${userId}`, // Creator's channel URL
        support_phone: "", // Optional: for support contact
        product_category: "media",
      }),
      scope: "read_write",
      suggested_capabilities: "transfers",
    });

    return `https://connect.stripe.com/oauth/authorize?${params.toString()}`;
  }

  /**
   * Handle Stripe OAuth callback
   * Exchange authorization code for connected account ID
   * 
   * Request params:
   * - code: authorization code from Stripe
   * - state: user_id encoded in auth URL
   * 
   * Side effects:
   * - Insert/update connected_accounts record
   * - Set user's stripe_account_id
   */
  async handleCallback(
    code: string,
    state: string,
    db: ReturnType<typeof createDb>
  ): Promise<{ success: boolean; stripe_account_id?: string; error?: string }> {
    try {
      // Parse state to get user_id
      const userId: string = (() => {
        try {
          const stateData = JSON.parse(decodeURIComponent(state));
          return stateData.user_id;
        } catch (e) {
          throw new Error("Invalid state parameter");
        }
      })();

      // Exchange authorization code for connected account
      // Call Stripe OAuth token endpoint
      const tokenResponse = await fetch("https://connect.stripe.com/oauth/token", {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({
          client_id: this.env.STRIPE_CONNECT_CLIENT_ID || "",
          code,
          scope: "read_write",
          grant_type: "authorization_code",
        }).toString(),
      });

      if (!tokenResponse.ok) {
        const errorData = await tokenResponse.json();
        console.error("Stripe OAuth error:", errorData);
        return { success: false, error: "Stripe authorization failed" };
      }

      const tokenData = (await tokenResponse.json()) as {
        stripe_user_id?: string;
        access_token?: string;
        stripe_publishable_key?: string;
      };
      const stripeAccountId = tokenData.stripe_user_id;

      if (!stripeAccountId) {
        return { success: false, error: "No stripe_user_id in response" };
      }

      // Store in database
      const { connectedAccounts } = await import("@nichestream/db");
      const { eq } = await import("drizzle-orm");

      await db
        .insert(connectedAccounts)
        .values({
          userId,
          stripeAccountId,
          chargesEnabled: false,
          payoutsEnabled: false,
          onboardingComplete: true,
        })
        .onConflictDoUpdate({
          target: connectedAccounts.userId,
          set: {
            stripeAccountId,
            chargesEnabled: false,
            payoutsEnabled: false,
            updatedAt: new Date(),
          },
        });

      return {
        success: true,
        stripe_account_id: stripeAccountId,
      };
    } catch (error) {
      console.error("OAuth callback error:", error);
      return { success: false, error: "Failed to complete authorization" };
    }
  }

  /**
   * Check connected account status
   * Returns activation status: charges_enabled, payouts_enabled
   * 
   * Used to verify creator can receive payouts
   */
  async getAccountStatus(stripeAccountId: string): Promise<{
    charges_enabled: boolean;
    payouts_enabled: boolean;
    requirements_due_by?: string;
  }> {
    try {
      // Call Stripe API to get account details using connected account token
      // Stripe account object type not fully exported; interface used instead
      const account = await this._stripe.accounts.retrieve(stripeAccountId, {
        stripeAccount: stripeAccountId,
      } as any);

      return {
        charges_enabled: account.charges_enabled ?? false,
        payouts_enabled: account.payouts_enabled ?? false,
        requirements_due_by: account.requirements?.current_deadline
          ? new Date(account.requirements.current_deadline * 1000).toISOString()
          : undefined,
      };
    } catch (error) {
      console.error("Error fetching account status:", error);
      throw error;
    }
  }

  /**
   * Disconnect creator's Stripe account
   * (for when creator wants to disconnect)
   */
  async disconnectAccount(userId: string, db: ReturnType<typeof createDb>): Promise<void> {
    try {
      // Delete from connected_accounts table
      const { connectedAccounts } = await import("@nichestream/db");
      const { eq } = await import("drizzle-orm");

      await db.delete(connectedAccounts).where(eq(connectedAccounts.userId, userId));
      console.log(`Disconnected Stripe account for user ${userId}`);
    } catch (error) {
      console.error("Error disconnecting account:", error);
      throw error;
    }
  }
}

/**
 * Handler for GET /api/stripe/connect/authorize
 * Redirects creator to Stripe OAuth authorization page
 */
export async function handleAuthorize(c: Context<{ Bindings: Env }>): Promise<Response> {
  try {
    const db = createDb(c.env);
    const auth = createAuth(db, c.env);
    const session = await auth.api.getSession({ headers: c.req.raw.headers });

    if (!session) {
      return c.json({ error: "Unauthorized" }, 401);
    }

    const userId = session.user.id;
    const oauth = new StripeConnectOAuth(c.env.STRIPE_SECRET_KEY, c.env);

    const authUrl = oauth.generateAuthUrl(userId);
    return c.redirect(authUrl);
  } catch (error) {
    console.error("Error in authorize handler:", error);
    return c.json({ error: "Failed to initiate Stripe Connect" }, 500);
  }
}

/**
 * Handler for GET /api/stripe/connect/callback
 * Processes Stripe OAuth callback and stores connected account
 */
export async function handleCallback(c: Context<{ Bindings: Env }>): Promise<Response> {
  try {
    const code = c.req.query("code");
    const state = c.req.query("state");
    const error = c.req.query("error");

    if (error) {
      return c.redirect(
        `${c.env.APP_BASE_URL}/dashboard?error=stripe_connect_denied&error_description=${error}`
      );
    }

    if (!code || !state) {
      return c.json({ error: "Missing code or state" }, 400);
    }

    const db = createDb(c.env);
    const oauth = new StripeConnectOAuth(c.env.STRIPE_SECRET_KEY, c.env);

    const result = await oauth.handleCallback(code, state, db);

    if (result.success) {
      return c.redirect(
        `${c.env.APP_BASE_URL}/dashboard?connected=true&account_id=${result.stripe_account_id}`
      );
    } else {
      return c.redirect(
        `${c.env.APP_BASE_URL}/dashboard?error=stripe_connect_failed&error_description=${result.error}`
      );
    }
  } catch (error) {
    console.error("Error in callback handler:", error);
    return c.redirect(`${c.env.APP_BASE_URL}/dashboard?error=stripe_connect_error`);
  }
}

/**
 * Handler for GET /api/stripe/connect/status
 * Check current connected account status
 */
export async function handleStatus(c: Context<{ Bindings: Env }>): Promise<Response> {
  try {
    const _db = createDb(c.env);
    const auth = createAuth(_db, c.env);
    const session = await auth.api.getSession({ headers: c.req.raw.headers });

    if (!session) {
      return c.json({ error: "Unauthorized" }, 401);
    }

    // Query connected_accounts table for this user
    const { connectedAccounts } = await import("@nichestream/db");
    const { eq } = await import("drizzle-orm");

    const [account] = await _db
      .select()
      .from(connectedAccounts)
      .where(eq(connectedAccounts.userId, session.user.id))
      .limit(1);

    const stripeAccountId = account?.stripeAccountId;

    if (!stripeAccountId) {
      return c.json({
        connected: false,
        message: "No connected Stripe account",
      });
    }

    const oauth = new StripeConnectOAuth(c.env.STRIPE_SECRET_KEY, c.env);
    const status = await oauth.getAccountStatus(stripeAccountId);

    return c.json({
      connected: true,
      stripe_account_id: stripeAccountId,
      ...status,
    });
  } catch (error) {
    console.error("Error fetching status:", error);
    return c.json({ error: "Failed to fetch account status" }, 500);
  }
}
