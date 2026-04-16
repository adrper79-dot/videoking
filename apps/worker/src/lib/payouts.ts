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
import { eq, gte, lt, and, sum, count } from "drizzle-orm";
import { createDb } from "./db";
import type { Env } from "../types";
import { earnings, connectedAccounts, payoutRuns, chatMessages, polls, pollVotes, videoUnlocks, videos } from "@nichestream/db";

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

  constructor(db: ReturnType<typeof createDb>, _env: Env, stripeClient: Stripe) {
    this._db = db;
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

    // Query earnings grouped by (creatorId, type) to build accurate breakdown
    const earningsData = await this._db
      .select({
        creatorId: earnings.creatorId,
        type: earnings.type,
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
      .groupBy(earnings.creatorId, earnings.type);

    // Pivot rows into per-creator summaries with proper type breakdowns
    const byCreator = new Map<string, {
      gross: number;
      pf: number;
      net: number;
      breakdown: PayoutSummary["breakdown"];
    }>();

    for (const row of earningsData) {
      if (!byCreator.has(row.creatorId)) {
        byCreator.set(row.creatorId, {
          gross: 0,
          pf: 0,
          net: 0,
          breakdown: { subscriptions_cents: 0, ads_cents: 0, unlocks_cents: 0, tips_cents: 0 },
        });
      }
      const entry = byCreator.get(row.creatorId)!;
      const gross = Number(row.totalGrossCents) || 0;
      const pf = Number(row.totalPlatformFeeCents) || 0;
      const net = Number(row.totalNetCents) || 0;
      entry.gross += gross;
      entry.pf += pf;
      entry.net += net;
      if (row.type === "subscription_share") entry.breakdown.subscriptions_cents += net;
      else if (row.type === "ad_impression")  entry.breakdown.ads_cents += net;
      else if (row.type === "unlock_purchase") entry.breakdown.unlocks_cents += net;
      else if (row.type === "tip")             entry.breakdown.tips_cents += net;
    }

    const summaries: PayoutSummary[] = [];

    for (const [creatorId, totals] of byCreator) {
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
        gross_cents: totals.gross,
        platform_fee_cents: totals.pf,
        net_cents: totals.net,
        breakdown: totals.breakdown,
        stripe_account_id: stripeAccountId,
        status,
      });
    }

    return summaries;
  }

  /**
   * Calculate engagement-weighted share fractions for each creator.
   *
   * Engagement score formula:
   *   score = (chatMessages × 2) + (pollVotes × 1.5) + (videoUnlocks × 5)
   *
   * Returns a Map<creatorId, fraction> where all fractions sum to 1.0.
   * Creators with zero engagement across the period receive fraction 0.
   */
  async calculateEngagementWeightedShares(
    periodStart: Date,
    periodEnd: Date,
  ): Promise<Map<string, number>> {
    // Parallel queries for each engagement signal
    const [chatData, voteData, unlockData] = await Promise.all([
      // Chat messages per creator (via video.creatorId, excluding deleted)
      this._db
        .select({ creatorId: videos.creatorId, msgCount: count(chatMessages.id) })
        .from(chatMessages)
        .innerJoin(videos, eq(chatMessages.videoId, videos.id))
        .where(
          and(
            gte(chatMessages.createdAt, periodStart),
            lt(chatMessages.createdAt, periodEnd),
            eq(chatMessages.isDeleted, false),
          ),
        )
        .groupBy(videos.creatorId),

      // Poll votes per creator (via polls.creatorId)
      this._db
        .select({ creatorId: polls.creatorId, voteCount: count(pollVotes.id) })
        .from(pollVotes)
        .innerJoin(polls, eq(pollVotes.pollId, polls.id))
        .where(
          and(
            gte(pollVotes.createdAt, periodStart),
            lt(pollVotes.createdAt, periodEnd),
          ),
        )
        .groupBy(polls.creatorId),

      // Video unlocks per creator (via video.creatorId)
      this._db
        .select({ creatorId: videos.creatorId, unlockCount: count(videoUnlocks.id) })
        .from(videoUnlocks)
        .innerJoin(videos, eq(videoUnlocks.videoId, videos.id))
        .where(
          and(
            gte(videoUnlocks.createdAt, periodStart),
            lt(videoUnlocks.createdAt, periodEnd),
          ),
        )
        .groupBy(videos.creatorId),
    ]);

    // Merge into a score map
    const scores = new Map<string, number>();

    for (const { creatorId, msgCount } of chatData) {
      scores.set(creatorId, (scores.get(creatorId) ?? 0) + Number(msgCount) * 2);
    }
    for (const { creatorId, voteCount } of voteData) {
      scores.set(creatorId, (scores.get(creatorId) ?? 0) + Number(voteCount) * 1.5);
    }
    for (const { creatorId, unlockCount } of unlockData) {
      scores.set(creatorId, (scores.get(creatorId) ?? 0) + Number(unlockCount) * 5);
    }

    const totalScore = Array.from(scores.values()).reduce((a, b) => a + b, 0);

    // Convert raw scores to fractional shares
    const shares = new Map<string, number>();
    if (totalScore === 0) return shares; // No engagement data — return empty map

    for (const [creatorId, score] of scores) {
      shares.set(creatorId, score / totalScore);
    }

    return shares;
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
      // Idempotency: check if a payout_run already exists for this creator and period.
      // This prevents double-payment if the cron fires more than once in the same month.
      // periodStart = first day of the payout month; periodEnd = last day of the payout month.
      const periodStart = new Date(year, month - 1, 1);
      const periodEnd = new Date(year, month, 0); // day-0 of next month == last day of current month
      const periodStartStr = periodStart.toISOString().split("T")[0];
      const periodEndStr = periodEnd.toISOString().split("T")[0];

      const [existingRun] = await this._db
        .select({ id: payoutRuns.id })
        .from(payoutRuns)
        .where(
          and(
            eq(payoutRuns.creatorId, summary.creator_id),
            eq(payoutRuns.payoutPeriodStart, periodStartStr),
            eq(payoutRuns.payoutPeriodEnd, periodEndStr),
          ),
        )
        .limit(1);

      if (existingRun) {
        console.log(`Skipping payout for creator ${summary.creator_id} in ${month}/${year}: payout_run already exists`);
        return;
      }

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
      await this._db.insert(payoutRuns).values({
        payoutPeriodStart: periodStartStr,
        payoutPeriodEnd: periodEndStr,
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
        // Fetch actual transfer status from Stripe instead of using a time heuristic.
        const transfer = await this.stripe.transfers.retrieve(payout.stripeTransferId);
        const stripeStatus = transfer.reversed ? "failed" : "paid";

        await this._db
          .update(payoutRuns)
          .set({
            transferStatus: stripeStatus,
            ...(stripeStatus === "paid" && { paidAt: new Date() }),
            ...(stripeStatus === "failed" && { failedReason: "Transfer reversed" }),
            updatedAt: new Date(),
          })
          .where(eq(payoutRuns.id, payout.id));
      } catch (error) {
        console.error(`Failed to check transfer status for payout ${payout.id}:`, error);
      }
    }
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
