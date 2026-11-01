import "server-only";

import Stripe from "stripe";

export type BillingInterval = "monthly" | "yearly";

export class BillingConfigurationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "BillingConfigurationError";
  }
}

let stripeClient: Stripe | null = null;

export function getStripeClient(): Stripe {
  const secretKey = process.env.STRIPE_SECRET_KEY?.trim();

  if (!secretKey) {
    throw new BillingConfigurationError(
      "STRIPE_SECRET_KEY fehlt in der lokalen Umgebung.",
    );
  }

  stripeClient ??= new Stripe(secretKey);
  return stripeClient;
}

export function getStripePriceId(interval: BillingInterval): string {
  const variableName =
    interval === "monthly"
      ? "STRIPE_PRICE_PREMIUM_MONTHLY"
      : "STRIPE_PRICE_PREMIUM_YEARLY";
  const priceId = process.env[variableName]?.trim();

  if (!priceId) {
    throw new BillingConfigurationError(
      `${variableName} fehlt in der lokalen Umgebung.`,
    );
  }

  return priceId;
}

export function getStripeWebhookSecret(): string {
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET?.trim();

  if (!webhookSecret) {
    throw new BillingConfigurationError(
      "STRIPE_WEBHOOK_SECRET fehlt in der lokalen Umgebung.",
    );
  }

  return webhookSecret;
}

export function getSubscriptionPeriod(subscription: Stripe.Subscription): {
  start: Date | null;
  end: Date | null;
} {
  const items = subscription.items.data;

  if (items.length === 0) {
    return { start: null, end: null };
  }

  const starts = items.map((item) => item.current_period_start);
  const ends = items.map((item) => item.current_period_end);

  return {
    start: new Date(Math.min(...starts) * 1000),
    end: new Date(Math.max(...ends) * 1000),
  };
}

export function getStripeObjectId(
  value:
    | string
    | { id: string }
    | null
    | undefined,
): string | null {
  if (typeof value === "string") {
    return value;
  }

  return value?.id ?? null;
}
