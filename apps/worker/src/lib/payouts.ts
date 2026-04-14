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
import { eq, gte, lt, and, sum } from "drizzle-orm";
import { createDb } from "./db";
import type { Env } from "../types";
import { earnings, connectedAccounts, payoutRuns } from "@nichestream/db";

interface PayoutSummary {
  creator_id: string;
  gross_cents: number;
  platform_fee_cents: number;
  net_cents: number;
  breakdown: {
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
    const periodStart = new Date(year, month - 1, 1);
    const periodEnd = new Date(year, month, 1);

    // Query earnings aggregated by creator for the month
    const earningsData = await this._db
      .select({
        creatorId: earnings.creatorId,
        totalGrossCents: sum(earnings.grossAmountCents),
        totalPlatformFeeCents: sum(earnings.platformFeeCents),
        totalNetCents: sum(earnings.netAmountCents),
      })
      .from(earnings)
      .where(
        and(
          gte(earnings.createdAt, periodStart),
          lt(earnings.createdAt, periodEnd),
          eq(earnings.status, "pending")
        )
      )
      .groupBy(earnings.creatorId);

    // Check Stripe Connect status for each creator
    const summaries: PayoutSummary[] = [];

    for (const data of earningsData) {
      const creatorId = data.creatorId;
      const totalGross = Number(data.totalGrossCents) || 0;
      const totalPlatformFee = Number(data.totalPlatformFeeCents) || 0;
      const totalNet = Number(data.totalNetCents) || 0;

      // Check if creator has connected Stripe account
      const [account] = await this._db
        .select()
        .from(connectedAccounts)
        .where(eq(connectedAccounts.userId, creatorId))
        .limit(1);

      let status: "ready" | "missing_account" | "payouts_disabled" = "ready";
      let stripeAccountId: string | undefined;

      if (!account) {
        status = "missing_account";
      } else if (!account.payoutsEnabled) {
        status = "payouts_disabled";
      } else {
        stripeAccountId = account.stripeAccountId;
      }

      summaries.push({
        creator_id: creatorId,
        gross_cents: totalGross,
        platform_fee_cents: totalPlatformFee,
        net_cents: totalNet,
        breakdown: {
          subscriptions_cents: 0,
          ads_cents: 0,
          unlocks_cents: 0,
          tips_cents: 0,
        },
        stripe_account_id: stripeAccountId,
        status,
      });
    }

    return summaries;
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
        amount: summary.net_cents,
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
      const periodStart = new Date(year, month - 1, 1);
      const periodEnd = new Date(year, month, 1);

      await this._db.insert(payoutRuns).values({
        payoutPeriodStart: periodStart.toISOString().split('T')[0],
        payoutPeriodEnd: periodEnd.toISOString().split('T')[0],
        creatorId: summary.creator_id,
        totalGrossCents: summary.gross_cents,
        platformFeeCents: summary.platform_fee_cents,
        creatorNetCents: summary.net_cents,
        stripeTransferId: transfer.id,
        transferStatus: "pending",
        processedAt: new Date(),
      });

      console.log(`Created transfer ${transfer.id} for creator ${summary.creator_id}: $${summary.net_cents / 100}`);
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
    // Query pending payout_runs and update status from Stripe
    const pending = await this._db
      .select()
      .from(payoutRuns)
      .where(eq(payoutRuns.transferStatus, "pending"));

    for (const payout of pending) {
      if (!payout.stripeTransferId) continue;

      try {
        // Note: Stripe Transfer status is determined by the object state
        // For now, mark as paid after 10 minutes (simplified logic)
        const processedTime = payout.processedAt?.getTime() || 0;
        const ageMinutes = (Date.now() - processedTime) / (1000 * 60);

        if (ageMinutes > 10) {
          // Assume transfer succeeded after some time
          await this._db
            .update(payoutRuns)
            .set({
              transferStatus: "paid",
              paidAt: new Date(),
              updatedAt: new Date(),
            })
            .where(eq(payoutRuns.id, payout.id));
        }
      } catch (error) {
        console.error(`Failed to check transfer status for payout ${payout.id}:`, error);
      }
    }
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
