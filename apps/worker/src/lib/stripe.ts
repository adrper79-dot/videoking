import Stripe from "stripe";
import type { Env } from "../types";

/**
 * Creates a Stripe client using the secret key from Worker env.
 */
export function createStripeClient(env: Env): Stripe {
  return new Stripe(env.STRIPE_SECRET_KEY, {
    apiVersion: "2024-04-10",
    httpClient: Stripe.createFetchHttpClient(),
  });
}

/**
 * Calculates the platform fee and creator net amount.
 */
export function calculateFees(
  grossCents: number,
  platformFeePercent: number,
): { platformFeeCents: number; netAmountCents: number } {
  const platformFeeCents = Math.round(grossCents * (platformFeePercent / 100));
  return {
    platformFeeCents,
    netAmountCents: grossCents - platformFeeCents,
  };
}

/**
 * Creates a Stripe Connect Express account for a creator and returns
 * the onboarding link URL.
 */
export async function createConnectAccountAndLink(
  stripe: Stripe,
  email: string,
  returnUrl: string,
  refreshUrl: string,
): Promise<{ accountId: string; onboardingUrl: string }> {
  const account = await stripe.accounts.create({
    type: "express",
    email,
    capabilities: {
      card_payments: { requested: true },
      transfers: { requested: true },
    },
  });

  const accountLink = await stripe.accountLinks.create({
    account: account.id,
    refresh_url: refreshUrl,
    return_url: returnUrl,
    type: "account_onboarding",
  });

  return { accountId: account.id, onboardingUrl: accountLink.url };
}

/**
 * Verifies a Stripe webhook signature and returns the parsed event.
 * Throws if the signature is invalid.
 */
export async function verifyStripeWebhook(
  stripe: Stripe,
  body: string,
  signature: string,
  secret: string,
): Promise<Stripe.Event> {
  return stripe.webhooks.constructEventAsync(body, signature, secret);
}
