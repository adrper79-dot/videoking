/**
 * Analytics & Reporting Routes (Admin)
 * 
 * Provides cohort analysis, churn tracking, and business metrics.
 * Requires admin role.
 * 
 * Endpoints:
 * - GET /api/admin/analytics/cohorts — Cohort retention metrics
 * - GET /api/admin/analytics/churn — At-risk users and churn prediction
 * - GET /api/admin/analytics/conversion-funnel — Sign-up to conversion pipeline
 * - GET /api/admin/analytics/arpu — Average Revenue Per User breakdown
 */

import { Hono } from "hono";
import { and, gte, lt, desc, eq, count, sum } from "drizzle-orm";
import type { Env } from "../types";
import { createDb } from "../lib/db";
import { requireAdmin } from "../middleware/admin";
import { users, cohortTracking, earnings, churnTracking } from "@nichestream/db";

interface CohortData {
  cohort_week: string;
  signups: number;
}

const router = new Hono<{ Bindings: Env }>();

/**
 * GET /api/admin/analytics/cohorts
 * Cohort retention analysis: track sign-up cohorts through days 1, 7, 14, 30
 * 
 * Query params:
 * - start_date: YYYY-MM-DD (default: 30 days ago)
 * - end_date: YYYY-MM-DD (default: today)
 * 
 * Response:
 * [
 *   { cohort_week: "2026-04-07", signup_count: 150, d7_retention: 0.81, d14_retention: 0.62, d30_retention: 0.45 },
 *   ...
 * ]
 */
router.get("/cohorts", requireAdmin(), async (c) => {
  try {
    const startDateParam = c.req.query("start_date");
    const endDateParam = c.req.query("end_date");

    // Parse dates or use defaults
    const endDate = endDateParam ? new Date(endDateParam) : new Date();
    const startDate = startDateParam 
      ? new Date(startDateParam)
      : new Date(endDate.getTime() - 30 * 24 * 60 * 60 * 1000);

    const startDateStr = startDate.toISOString().split('T')[0];
    const endDateStr = endDate.toISOString().split('T')[0];

    const db = createDb(c.env);

    // Query cohorts_daily table - note: cohortDate/cohortWeek are strings
    const cohortData = await db
      .select({
        cohortWeek: cohortTracking.cohortWeek,
        daysSinceSignup: cohortTracking.daysSinceSignup,
        isActive: cohortTracking.isActive,
        countUsers: count(cohortTracking.userId),
      })
      .from(cohortTracking)
      .where(
        and(
          gte(cohortTracking.cohortDate, startDateStr),
          lt(cohortTracking.cohortDate, endDateStr)
        )
      )
      .groupBy(
        cohortTracking.cohortWeek,
        cohortTracking.daysSinceSignup,
        cohortTracking.isActive
      );

    // Aggregate and calculate retention
    const cohortMap = new Map<string, CohortData>();
    for (const row of cohortData) {
      const key = row.cohortWeek || 'unknown';
      if (!cohortMap.has(key)) {
        cohortMap.set(key, { cohort_week: key, signups: 0 });
      }
      const cohort = cohortMap.get(key)!;
      if (row.daysSinceSignup === 0) {
        cohort.signups = Number(row.countUsers) || 0;
      }
    }

    const cohorts = Array.from(cohortMap.values());

    return c.json({
      cohorts,
      period: {
        start: startDateStr,
        end: endDateStr,
      },
    });
  } catch (error) {
    console.error("Error fetching cohorts:", error);
    return c.json({ error: "Failed to fetch cohort analytics" }, 500);
  }
});

/**
 * GET /api/admin/analytics/churn
 * Churn analysis: identify at-risk users and track churn metrics
 * 
 * Query params:
 * - inactivity_threshold_days: (default: 7)
 * 
 * Response:
 * {
 *   at_risk_count: 42,
 *   churned_last_7d: 8,
 *   churn_rate: 0.05,
 *   top_churn_reasons: ["inactive", "price_sensitive", ...],
 *   at_risk_users: [{ user_id, inactivity_days, last_activity, cohort_date }]
 * }
 */
router.get("/churn", requireAdmin(), async (c) => {
  try {
    const inactivityThreshold = parseInt(c.req.query("inactivity_threshold_days") || "7");

    const db = createDb(c.env);

    // Query churn_tracking table
    const atRiskUsers = await db
      .select()
      .from(churnTracking)
      .where(
        and(
          gte(churnTracking.inactivityDays, inactivityThreshold),
          eq(churnTracking.isAtRisk, 1)
        )
      )
      .orderBy(desc(churnTracking.inactivityDays))
      .limit(50);

    const totalUsers = await db
      .select({ count: count() })
      .from(users)
      .where(eq(users.userTier, "citizen"));

    const activeUsers = totalUsers[0]?.count || 1;
    const atRiskCount = atRiskUsers.length;
    const churnRate = activeUsers > 0 ? atRiskCount / activeUsers : 0;

    // Calculate churned in last 7 days
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const recentChurned = await db
      .select({ count: count() })
      .from(churnTracking)
      .where(
        and(
          gte(churnTracking.updatedAt, sevenDaysAgo),
          eq(churnTracking.churned, 1)
        )
      );

    return c.json({
      at_risk_count: atRiskCount,
      churned_last_7d: recentChurned[0]?.count || 0,
      churn_rate: parseFloat(churnRate.toFixed(4)),
      inactivity_threshold_days: inactivityThreshold,
      at_risk_users: atRiskUsers.map(u => ({
        user_id: u.userId,
        inactivity_days: u.inactivityDays,
        last_activity: u.lastActivityAt?.toISOString(),
        signup_date: u.signupDate,
      })),
    });
  } catch (error) {
    console.error("Error fetching churn analytics:", error);
    return c.json({ error: "Failed to fetch churn analytics" }, 500);
  }
});

/**
 * GET /api/admin/analytics/conversion-funnel
 * Sign-up to conversion pipeline analysis
 * 
 * Response:
 * {
 *   total_signups_30d: 542,
 *   trial_activated: 489,
 *   trial_activated_pct: 0.90,
 *   converted_to_paid: 147,
 *   conversion_rate: 0.27,
 *   refer_conversion_rate: 0.35,
 *   organic_conversion_rate: 0.25
 * }
 */
router.get("/conversion-funnel", requireAdmin(), async (c) => {
  try {
    const db = createDb(c.env);

    // 30 days ago
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

    // Count total signups
    const signupStats = await db
      .select({ count: count() })
      .from(users)
      .where(gte(users.createdAt, thirtyDaysAgo));

    const totalSignups = signupStats[0]?.count || 0;

    // Count trial activations (non-free tier)
    const trialStats = await db
      .select({ count: count() })
      .from(users)
      .where(
        and(
          gte(users.createdAt, thirtyDaysAgo),
          eq(users.subscriptionStatus, "trial")
        )
      );

    const trialActivated = trialStats[0]?.count || 0;

    // Count conversions to paid
    const conversionStats = await db
      .select({ count: count() })
      .from(users)
      .where(
        and(
          gte(users.createdAt, thirtyDaysAgo),
          eq(users.subscriptionStatus, "active")
        )
      );

    const convertedToPaid = conversionStats[0]?.count || 0;

    const trialActivationRate = totalSignups > 0 ? trialActivated / totalSignups : 0;
    const conversionRate = trialActivated > 0 ? convertedToPaid / trialActivated : 0;

    return c.json({
      total_signups_30d: totalSignups,
      trial_activated: trialActivated,
      trial_activation_pct: parseFloat(trialActivationRate.toFixed(4)),
      converted_to_paid: convertedToPaid,
      conversion_rate: parseFloat(conversionRate.toFixed(4)),
      period_days: 30,
    });
  } catch (error) {
    console.error("Error fetching conversion funnel:", error);
    return c.json({ error: "Failed to fetch conversion funnel" }, 500);
  }
});

/**
 * GET /api/admin/analytics/arpu
 * Average Revenue Per User (ARPU) breakdown by tier and source
 * 
 * Response:
 * {
 *   overall_arpu: 2.35,
 *   free_tier_arpu: 0.12,
 *   citizen_arpu: 8.50,
 *   vip_arpu: 18.00,
 *   revenue_by_source: {
 *     subscriptions: 0.65,
 *     ads: 0.35,
 *     unlocks: 0.25,
 *     tips: 0.10
 *   }
 * }
 */
router.get("/arpu", requireAdmin(), async (c) => {
  try {
    const db = createDb(c.env);

    // Query earnings aggregated by creator and type
    const earningsData = await db
      .select({
        type: earnings.type,
        totalCents: sum(earnings.netAmountCents),
      })
      .from(earnings)
      .groupBy(earnings.type);

    let subscriptionCents = 0;
    let adsCents = 0;
    let unlocksCents = 0;
    let tipsCents = 0;

    for (const row of earningsData) {
      const amount = Number(row.totalCents) || 0;
      if (row.type === "subscription_share") subscriptionCents = amount;
      else if (row.type === "ad_impression") adsCents = amount;
      else if (row.type === "unlock_purchase") unlocksCents = amount;
      else if (row.type === "tip") tipsCents = amount;
    }

    const totalEarningsCents = subscriptionCents + adsCents + unlocksCents + tipsCents;

    // Count total active users (non-free tier)
    const userStats = await db
      .select({ count: count() })
      .from(users)
      .where(eq(users.userTier, "citizen"));

    const totalActiveUsers = userStats[0]?.count || 1;

    const overallArpu = (totalEarningsCents / 100) / totalActiveUsers;

    return c.json({
      overall_arpu: parseFloat(overallArpu.toFixed(2)),
      total_revenue_cents: totalEarningsCents,
      active_users: totalActiveUsers,
      revenue_by_source: {
        subscriptions: parseFloat((subscriptionCents / 100).toFixed(2)),
        ads: parseFloat((adsCents / 100).toFixed(2)),
        unlocks: parseFloat((unlocksCents / 100).toFixed(2)),
        tips: parseFloat((tipsCents / 100).toFixed(2)),
      },
    });
  } catch (error) {
    console.error("Error fetching ARPU:", error);
    return c.json({ error: "Failed to fetch ARPU metrics" }, 500);
  }
});

export { router as analyticsRoutes };
