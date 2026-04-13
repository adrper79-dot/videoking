import { eq } from "drizzle-orm";
import { users } from "@nichestream/db";
import type { AuthEntitlements, MembershipStatus, UserTier } from "@nichestream/types";
import type { DrizzleClient } from "./db";
import type { Env } from "../types";

type EntitlementUserRow = typeof users.$inferSelect;

function getRateLimitMs(tier: UserTier, env: Env): number {
  const defaults: Record<UserTier, number> = {
    free: 10_000,
    citizen: 1_000,
    vip: 500,
  };

  const configured =
    tier === "vip"
      ? env.CHAT_RATE_LIMIT_VIP_MS
      : tier === "citizen"
        ? env.CHAT_RATE_LIMIT_CITIZEN_MS
        : env.CHAT_RATE_LIMIT_FREE_MS;

  const parsed = Number(configured);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : defaults[tier];
}

function getTrialPeriodDays(env: Env): number {
  const parsed = Number(env.TRIAL_PERIOD_DAYS);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 14;
}

export function isTrialActive(trialEndsAt: Date | null | undefined): boolean {
  return Boolean(trialEndsAt && trialEndsAt.getTime() > Date.now());
}

export function getEffectiveTier(user: Pick<EntitlementUserRow, "userTier" | "trialEndsAt">): UserTier {
  if (user.userTier === "vip") return "vip";
  if (user.userTier === "citizen") return "citizen";
  return isTrialActive(user.trialEndsAt) ? "citizen" : "free";
}

export function buildGuestEntitlements(env: Env): AuthEntitlements {
  return {
    authenticated: false,
    user: null,
    limits: {
      chatRateLimitMs: getRateLimitMs("free", env),
      canCreatePolls: false,
      canUseWatchParty: false,
      adFree: false,
    },
  };
}

export function buildAuthEntitlements(user: EntitlementUserRow, env: Env): AuthEntitlements {
  const effectiveTier = getEffectiveTier(user);
  const isPaid = effectiveTier !== "free";

  return {
    authenticated: true,
    user: {
      id: user.id,
      username: user.username,
      displayName: user.displayName,
      avatarUrl: user.avatarUrl,
      role: user.role,
      userTier: user.userTier,
      effectiveTier,
      subscriptionStatus: user.subscriptionStatus,
      trialEndsAt: user.trialEndsAt?.toISOString() ?? null,
    },
    limits: {
      chatRateLimitMs: getRateLimitMs(effectiveTier, env),
      canCreatePolls: isPaid,
      canUseWatchParty: isPaid,
      adFree: isPaid,
    },
  };
}

export async function activateTrialIfEligible(
  db: DrizzleClient,
  userId: string,
  env: Env,
): Promise<typeof users.$inferSelect | null> {
  const [existing] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
  if (!existing) return null;

  const shouldActivateTrial =
    existing.userTier === "free" &&
    existing.subscriptionStatus === "none" &&
    !existing.trialEndsAt &&
    !existing.hasSeenOnboarding;

  if (!shouldActivateTrial) {
    return existing;
  }

  const trialEndsAt = new Date(Date.now() + getTrialPeriodDays(env) * 24 * 60 * 60 * 1000);

  const [updated] = await db
    .update(users)
    .set({
      trialEndsAt,
      subscriptionStatus: "trial",
      hasSeenOnboarding: true,
      updatedAt: new Date(),
    })
    .where(eq(users.id, userId))
    .returning();

  return updated ?? existing;
}

export async function getUserEntitlements(
  db: DrizzleClient,
  userId: string,
  env: Env,
): Promise<AuthEntitlements | null> {
  const user = await activateTrialIfEligible(db, userId, env);
  if (!user) return null;
  return buildAuthEntitlements(user, env);
}

export async function syncUserMembershipStatus(
  db: DrizzleClient,
  userId: string,
  next: {
    userTier?: UserTier;
    subscriptionStatus?: MembershipStatus;
  },
): Promise<void> {
  const update: Partial<typeof users.$inferInsert> = {
    ...(next.userTier !== undefined && { userTier: next.userTier }),
    ...(next.subscriptionStatus !== undefined && {
      subscriptionStatus: next.subscriptionStatus,
    }),
    updatedAt: new Date(),
  };

  if (Object.keys(update).length === 0) return;
  await db.update(users).set(update).where(eq(users.id, userId));
}