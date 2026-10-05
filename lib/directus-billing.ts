import "server-only";

import type Stripe from "stripe";
import {
  getStripeObjectId,
  getSubscriptionPeriod,
  type BillingInterval,
} from "@/lib/stripe-billing";

type DirectusError = {
  message?: string;
  extensions?: {
    code?: string;
  };
};

type DirectusListResponse<T> = {
  data?: T[];
  errors?: DirectusError[];
};

type DirectusItemResponse<T> = {
  data?: T;
  errors?: DirectusError[];
};

type ProviderSubscriptionRecord = {
  id: string;
  provider_customer_id: string | null;
  provider_subscription_id: string | null;
};

type ProviderSubscriptionPayload = {
  organization: string;
  listing: string;
  status: "pending" | "active" | "past_due" | "cancelled" | "expired";
  plan: "premium";
  billing_interval: BillingInterval;
  payment_provider: "stripe";
  provider_customer_id: string | null;
  provider_subscription_id: string;
  current_period_start: string | null;
  current_period_end: string | null;
  cancel_at_period_end: boolean;
  cancelled_at: string | null;
  provider_price_id: string | null;
  amount_minor: number;
  currency: string;
};

function getDirectusUrl(): string {
  const directusUrl = process.env.DIRECTUS_URL?.trim();

  if (!directusUrl) {
    throw new Error("DIRECTUS_URL fehlt in der lokalen Umgebung.");
  }

  return directusUrl;
}

function getDirectusServerToken(): string {
  const token = process.env.DIRECTUS_TOKEN?.trim();

  if (!token) {
    throw new Error("DIRECTUS_TOKEN fehlt in der lokalen Umgebung.");
  }

  return token;
}

function directusHeaders(): HeadersInit {
  return {
    Authorization: `Bearer ${getDirectusServerToken()}`,
    "Content-Type": "application/json",
  };
}

async function readList<T>(response: Response): Promise<T[]> {
  const result = (await response.json().catch(() => null)) as
    | DirectusListResponse<T>
    | null;

  if (!response.ok || !result?.data) {
    throw new Error(
      result?.errors?.[0]?.message ??
        `Directus-Anfrage fehlgeschlagen (${response.status}).`,
    );
  }

  return result.data;
}

async function readItem<T>(response: Response): Promise<T> {
  const result = (await response.json().catch(() => null)) as
    | DirectusItemResponse<T>
    | null;

  if (!response.ok || !result?.data) {
    throw new Error(
      result?.errors?.[0]?.message ??
        `Directus-Anfrage fehlgeschlagen (${response.status}).`,
    );
  }

  return result.data;
}

export async function getProviderCustomerIdForOrganization(
  organizationId: string,
): Promise<string | null> {
  const url = new URL("/items/subscriptions", getDirectusUrl());

  url.searchParams.set("fields", "provider_customer_id");
  url.searchParams.set("limit", "1");
  url.searchParams.set("sort", "-current_period_end");
  url.searchParams.set(
    "filter",
    JSON.stringify({
      _and: [
        { organization: { _eq: organizationId } },
        { provider_customer_id: { _nnull: true } },
      ],
    }),
  );

  const response = await fetch(url, {
    headers: directusHeaders(),
    cache: "no-store",
  });
  const records = await readList<ProviderSubscriptionRecord>(response);

  return records[0]?.provider_customer_id ?? null;
}

function mapSubscriptionStatus(
  status: Stripe.Subscription.Status,
): ProviderSubscriptionPayload["status"] {
  switch (status) {
    case "active":
    case "trialing":
      return "active";
    case "past_due":
    case "unpaid":
      return "past_due";
    case "canceled":
      return "cancelled";
    case "incomplete_expired":
      return "expired";
    default:
      return "pending";
  }
}

function createProviderSubscriptionPayload(
  subscription: Stripe.Subscription,
): ProviderSubscriptionPayload | null {
  const listingId = subscription.metadata.listing_id?.trim();
  const organizationId = subscription.metadata.organization_id?.trim();
  const billingInterval = subscription.metadata.billing_interval?.trim();

  if (
    !listingId ||
    !organizationId ||
    !["monthly", "yearly"].includes(billingInterval)
  ) {
    return null;
  }

  const firstItem = subscription.items.data[0];
  const { start, end } = getSubscriptionPeriod(subscription);
  const cancellationScheduled = Boolean(
    subscription.cancel_at_period_end ||
      (subscription.cancel_at &&
        subscription.cancel_at * 1000 > Date.now()),
  );

  return {
    organization: organizationId,
    listing: listingId,
    status: mapSubscriptionStatus(subscription.status),
    plan: "premium",
    billing_interval: billingInterval as BillingInterval,
    payment_provider: "stripe",
    provider_customer_id: getStripeObjectId(subscription.customer),
    provider_subscription_id: subscription.id,
    current_period_start: start?.toISOString() ?? null,
    current_period_end: end?.toISOString() ?? null,
    // The customer portal can schedule the cancellation through `cancel_at`
    // instead of setting `cancel_at_period_end`, even when both dates match.
    // Directus stores the product-level meaning: access ends in the future.
    cancel_at_period_end: cancellationScheduled,
    cancelled_at: subscription.canceled_at
      ? new Date(subscription.canceled_at * 1000).toISOString()
      : null,
    provider_price_id: firstItem
      ? getStripeObjectId(firstItem.price)
      : null,
    amount_minor: firstItem?.price.unit_amount ?? 0,
    currency: subscription.currency.toUpperCase(),
  };
}

async function findProviderSubscription(
  providerSubscriptionId: string,
): Promise<ProviderSubscriptionRecord | null> {
  const url = new URL("/items/subscriptions", getDirectusUrl());

  url.searchParams.set(
    "fields",
    "id,provider_customer_id,provider_subscription_id",
  );
  url.searchParams.set("limit", "1");
  url.searchParams.set(
    "filter",
    JSON.stringify({
      provider_subscription_id: {
        _eq: providerSubscriptionId,
      },
    }),
  );

  const response = await fetch(url, {
    headers: directusHeaders(),
    cache: "no-store",
  });
  const records = await readList<ProviderSubscriptionRecord>(response);

  return records[0] ?? null;
}

export async function syncStripeSubscription(
  subscription: Stripe.Subscription,
): Promise<boolean> {
  const payload = createProviderSubscriptionPayload(subscription);

  if (!payload) {
    console.warn(
      `Stripe-Abo ${subscription.id} besitzt keine vollständigen Findelio-Metadaten.`,
    );
    return false;
  }

  const currentRecord = await findProviderSubscription(subscription.id);
  const url = currentRecord
    ? new URL(
        `/items/subscriptions/${encodeURIComponent(currentRecord.id)}`,
        getDirectusUrl(),
      )
    : new URL("/items/subscriptions", getDirectusUrl());
  const response = await fetch(url, {
    method: currentRecord ? "PATCH" : "POST",
    headers: directusHeaders(),
    body: JSON.stringify(payload),
    cache: "no-store",
  });

  await readItem<ProviderSubscriptionRecord>(response);
  return true;
}
