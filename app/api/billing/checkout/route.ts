import { NextResponse } from "next/server";
import {
  clearAuthCookies,
  getAccessToken,
  getRefreshToken,
  saveAuthTokens,
} from "@/lib/auth";
import { getProviderCustomerIdForOrganization } from "@/lib/directus-billing";
import {
  DirectusAccountError,
  getAccountListingBillingData,
} from "@/lib/directus-account";
import {
  DirectusAuthError,
  getDirectusCurrentUser,
  refreshDirectusSession,
} from "@/lib/directus-auth";
import { routing, type AppLocale } from "@/i18n/routing";
import {
  BillingConfigurationError,
  getStripeClient,
  getStripePriceId,
  type BillingInterval,
} from "@/lib/stripe-billing";

type CheckoutBody = {
  listing_id?: unknown;
  billing_interval?: unknown;
  locale?: unknown;
};

const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function isTrustedOrigin(request: Request): boolean {
  const origin = request.headers.get("origin");

  if (!origin) return true;

  const expectedOrigin = new URL(
    process.env.NEXT_PUBLIC_SITE_URL ?? request.url,
  ).origin;

  return origin === expectedOrigin;
}

function isLocale(value: unknown): value is AppLocale {
  return (
    typeof value === "string" &&
    routing.locales.includes(value as AppLocale)
  );
}

async function refreshAccessToken(): Promise<string | null> {
  const refreshToken = await getRefreshToken();

  if (!refreshToken) return null;

  try {
    const tokens = await refreshDirectusSession(refreshToken);
    await saveAuthTokens(tokens);
    return tokens.access_token;
  } catch {
    await clearAuthCookies();
    return null;
  }
}

async function getBillingContext(accessToken: string, listingId: string) {
  try {
    return await Promise.all([
      getAccountListingBillingData(accessToken, listingId),
      getDirectusCurrentUser(accessToken),
    ]);
  } catch (error) {
    const isUnauthorized =
      (error instanceof DirectusAccountError ||
        error instanceof DirectusAuthError) &&
      error.status === 401;

    if (!isUnauthorized) {
      throw error;
    }

    const refreshedAccessToken = await refreshAccessToken();

    if (!refreshedAccessToken) {
      throw error;
    }

    return Promise.all([
      getAccountListingBillingData(refreshedAccessToken, listingId),
      getDirectusCurrentUser(refreshedAccessToken),
    ]);
  }
}

export async function POST(request: Request) {
  if (!isTrustedOrigin(request)) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  if (!request.headers.get("content-type")?.includes("application/json")) {
    return NextResponse.json({ error: "invalid_data" }, { status: 415 });
  }

  const body = (await request.json().catch(() => null)) as CheckoutBody | null;
  const listingId =
    typeof body?.listing_id === "string" ? body.listing_id.trim() : "";
  const interval = body?.billing_interval;
  const locale = isLocale(body?.locale) ? body.locale : routing.defaultLocale;

  if (
    !uuidPattern.test(listingId) ||
    !["monthly", "yearly"].includes(String(interval))
  ) {
    return NextResponse.json({ error: "invalid_data" }, { status: 400 });
  }

  let accessToken = await getAccessToken();

  if (!accessToken) {
    accessToken = await refreshAccessToken();
  }

  if (!accessToken) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  try {
    const [billingData, user] = await getBillingContext(accessToken, listingId);

    if (!billingData) {
      return NextResponse.json({ error: "not_found" }, { status: 404 });
    }

    if (billingData.premiumEnabled) {
      return NextResponse.json({ error: "already_active" }, { status: 409 });
    }

    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL?.trim();

    if (!siteUrl) {
      throw new BillingConfigurationError(
        "NEXT_PUBLIC_SITE_URL fehlt in der lokalen Umgebung.",
      );
    }

    const billingInterval = interval as BillingInterval;
    const stripe = getStripeClient();
    const customerId = await getProviderCustomerIdForOrganization(
      billingData.listing.organization.id,
    );
    const billingPageUrl = new URL(
      `/${locale}/dashboard/firmenprofile/${listingId}/abo`,
      siteUrl,
    );
    const successUrl = new URL(billingPageUrl);
    const cancelUrl = new URL(billingPageUrl);

    successUrl.searchParams.set("checkout", "success");
    successUrl.searchParams.set("session_id", "{CHECKOUT_SESSION_ID}");
    cancelUrl.searchParams.set("checkout", "cancelled");
    cancelUrl.searchParams.set("interval", billingInterval);

    const metadata = {
      listing_id: billingData.listing.id,
      organization_id: billingData.listing.organization.id,
      billing_interval: billingInterval,
    };
    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      customer: customerId ?? undefined,
      customer_email: customerId ? undefined : user.email,
      client_reference_id: billingData.listing.id,
      line_items: [
        {
          price: getStripePriceId(billingInterval),
          quantity: 1,
        },
      ],
      metadata,
      subscription_data: {
        metadata,
      },
      success_url: successUrl.toString(),
      cancel_url: cancelUrl.toString(),
    });

    if (!session.url) {
      throw new Error("Stripe Checkout hat keine Weiterleitungs-URL geliefert.");
    }

    return NextResponse.json(
      { success: true, url: session.url },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    if (error instanceof BillingConfigurationError) {
      console.warn("Stripe ist noch nicht vollständig konfiguriert:", error.message);
      return NextResponse.json(
        { error: "billing_not_configured" },
        { status: 503 },
      );
    }

    if (error instanceof DirectusAuthError && error.status === 401) {
      await clearAuthCookies();
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }

    console.error("Stripe Checkout konnte nicht erstellt werden:", error);
    return NextResponse.json(
      { error: "checkout_failed" },
      { status: 500 },
    );
  }
}
