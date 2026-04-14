/**
 * Creator Payout Engine
 * 
 * Handles monthly earnings aggregation and Stripe Connect payouts
 * to creators based on subscription revenue, ad revenue, and tips.
 * 
 * Usage (called by scheduled worker):
 * const payouts = new PayoutEngine(db, env, stripeClient);
 * await payouts.processMonthlyPayouts(month, year);
 */

import type { Context } from "hono";
import Stripe from "stripe";
import { createDb } from "./db";
import type { Env } from "../types";

interface PayoutSummary {
  creator_id: string;
  total_gross_cents: number;
  total_platform_fee_cents: number;
  creator_net_cents: number;
  earning_breakdown: {
    subscriptions_cents: number;
    ads_cents: number;
    unlocks_cents: number;
    tips_cents: number;
  };
  stripe_account_id?: string;
  status: "ready" | "missing_account" | "payouts_disabled";
}

export class PayoutEngine {
  private _db: ReturnType<typeof createDb>;
  private stripe: Stripe;
  private _env: Env;

  constructor(db: ReturnType<typeof createDb>, env: Env, stripeClient: Stripe) {
    this._db = db;
    this._env = env;
    this.stripe = stripeClient;
  }

  /**
   * Process monthly payouts for all creators with earnings
   * 
   * Algorithm:
   * 1. Find all creators with earnings in the period
   * 2. Aggregate by creator: gross revenue, platform fee, creator net
   * 3. Check if creator has connected Stripe account with payouts enabled
   * 4. Create Stripe Connect Transfer for creator_net_cents
   * 5. Record payout_run with status
   */
  async processMonthlyPayouts(month: number, year: number): Promise<void> {
    console.log(`Starting monthly payout process for ${month}/${year}`);

    const summaries = await this.aggregateCreatorEarnings(month, year);

    for (const summary of summaries) {
      try {
        await this.processCreatorPayout(summary, month, year);
      } catch (error) {
        console.error(`Failed to process payout for creator ${summary.creator_id}:`, error);
        // Continue to next creator; log failure
      }
    }

    console.log(`Completed monthly payout process for ${month}/${year}`);
  }

  /**
   * Aggregate earnings by creator for a given month
   * 
   * Sums all earning records created in the period:
   * - subscription_share (from Stripe webhooks)
   * - ad_impression (from ad events)
   * - unlock_purchase (from video unlock payments)
   * - tip (from one-time tips)
   */
  private async aggregateCreatorEarnings(
    month: number,
    year: number
  ): Promise<PayoutSummary[]> {
    const _periodStart = new Date(year, month - 1, 1);
    const _periodEnd = new Date(year, month, 1);

    // TODO: Implement aggregation query
    // SELECT
    //   creator_id,
    //   SUM(gross_amount_cents) as total_gross,
    //   SUM(platform_fee_cents) as total_platform_fee,
    //   SUM(net_amount_cents) as total_net,
    //   SUM(CASE WHEN type='subscription_share' THEN net_amount_cents ELSE 0 END) as subscriptions,
    //   SUM(CASE WHEN type='ad_impression' THEN net_amount_cents ELSE 0 END) as ads,
    //   SUM(CASE WHEN type='unlock_purchase' THEN net_amount_cents ELSE 0 END) as unlocks,
    //   SUM(CASE WHEN type='tip' THEN net_amount_cents ELSE 0 END) as tips
    // FROM earnings
    // WHERE created_at >= periodStart AND created_at < periodEnd AND status='pending'
    // GROUP BY creator_id

    return [];
  }

  /**
   * Create Stripe Connect Transfer for a single creator
   */
  private async processCreatorPayout(
    summary: PayoutSummary,
    month: number,
    year: number
  ): Promise<void> {
    // Validate creator has connected account
    if (summary.status === "missing_account") {
      console.log(`Skipping payout for creator ${summary.creator_id}: no connected account`);
      return;
    }

    if (summary.status === "payouts_disabled") {
      console.log(`Skipping payout for creator ${summary.creator_id}: payouts disabled`);
      return;
    }

    if (!summary.stripe_account_id) {
      console.error(`No Stripe account ID found for creator ${summary.creator_id}`);
      return;
    }

    try {
      // Create Stripe Transfer to creator's connected account
      const transfer = await this.stripe.transfers.create({
        amount: summary.creator_net_cents,
        currency: "usd",
        destination: summary.stripe_account_id,
        description: `NicheStream Payout ${month}/${year}`,
        metadata: {
          platform: "nichestream",
          creator_id: summary.creator_id,
          month: month.toString(),
          year: year.toString(),
        },
      });

      // Record payout run in database
      // TODO: Insert into payout_runs table
      // await db.insert(payoutRuns).values({
      //   payout_period_start: periodStart,
      //   payout_period_end: periodEnd,
      //   creator_id: summary.creator_id,
      //   total_gross_cents: summary.total_gross_cents,
      //   platform_fee_cents: summary.total_platform_fee_cents,
      //   creator_net_cents: summary.creator_net_cents,
      //   stripe_transfer_id: transfer.id,
      //   transfer_status: "pending",
      // });

      console.log(`Created transfer ${transfer.id} for creator ${summary.creator_id}: $${summary.creator_net_cents / 100}`);
    } catch (error) {
      console.error(`Stripe transfer failed for creator ${summary.creator_id}:`, error);
      throw error;
    }
  }

  /**
   * Check transfer status and update payout_runs
   * (called periodically or as a batch job)
   */
  async updatePayoutStatus(): Promise<void> {
    // TODO: Query pending payout_runs
    // For each pending transfer:
    //   1. Call stripe.transfers.retrieve(transfer_id)
    //   2. Update payout_runs.transfer_status based on result
    //   3. If paid, update payout_runs.paid_at = now()
    //   4. If failed, update payout_runs.failed_reason
  }

  /**
   * Handle Stripe transfer webhook events
   * (charge.transferred, transfer.paid, transfer.failed)
   */
  async handleTransferWebhookEvent(_event: Stripe.Event): Promise<void> {
    // TODO: Parse transfer event from Stripe
    // Update payout_runs.transfer_status and related fields
  }
}

/**
 * Scheduled handler for monthly payout cron job
 * Call this from a Cloudflare Cron trigger (e.g., "0 2 1 * *" = 2 AM on 1st of month)
 */
export async function handleMonthlyPayoutCron(c: Context<{ Bindings: Env }>): Promise<Response> {
  try {
    const db = createDb(c.env);
    const stripe = new Stripe(c.env.STRIPE_SECRET_KEY);
    
    const payoutEngine = new PayoutEngine(db, c.env, stripe);

    // Get current month (or override for testing)
    const now = new Date();
    const month = now.getMonth() + 1;
    const year = now.getFullYear();

    await payoutEngine.processMonthlyPayouts(month, year);

    return c.json({
      success: true,
      message: `Monthly payouts processed for ${month}/${year}`,
    });
  } catch (error) {
    console.error("Monthly payout cron failed:", error);
    return c.json(
      {
        success: false,
        error: "Monthly payout processing failed",
      },
      500
    );
  }
}
