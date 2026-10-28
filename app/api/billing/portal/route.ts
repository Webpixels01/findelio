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
  refreshDirectusSession,
} from "@/lib/directus-auth";
import { routing, type AppLocale } from "@/i18n/routing";
import {
  BillingConfigurationError,
  getStripeClient,
} from "@/lib/stripe-billing";

type PortalBody = {
  listing_id?: unknown;
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

async function getBillingData(accessToken: string, listingId: string) {
  try {
    return await getAccountListingBillingData(accessToken, listingId);
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

    return getAccountListingBillingData(refreshedAccessToken, listingId);
  }
}

export async function POST(request: Request) {
  if (!isTrustedOrigin(request)) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  if (!request.headers.get("content-type")?.includes("application/json")) {
    return NextResponse.json({ error: "invalid_data" }, { status: 415 });
  }

  const body = (await request.json().catch(() => null)) as PortalBody | null;
  const listingId =
    typeof body?.listing_id === "string" ? body.listing_id.trim() : "";
  const locale = isLocale(body?.locale) ? body.locale : routing.defaultLocale;

  if (!uuidPattern.test(listingId)) {
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
    const billingData = await getBillingData(accessToken, listingId);

    if (!billingData) {
      return NextResponse.json({ error: "not_found" }, { status: 404 });
    }

    const customerId = await getProviderCustomerIdForOrganization(
      billingData.listing.organization.id,
    );

    if (!customerId) {
      return NextResponse.json(
        { error: "portal_unavailable" },
        { status: 409 },
      );
    }

    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL?.trim();

    if (!siteUrl) {
      throw new BillingConfigurationError(
        "NEXT_PUBLIC_SITE_URL fehlt in der lokalen Umgebung.",
      );
    }

    const session = await getStripeClient().billingPortal.sessions.create({
      customer: customerId,
      return_url: new URL(
        `/${locale}/dashboard/firmenprofile/${listingId}/abo`,
        siteUrl,
      ).toString(),
    });

    return NextResponse.json(
      { success: true, url: session.url },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    if (error instanceof BillingConfigurationError) {
      return NextResponse.json(
        { error: "billing_not_configured" },
        { status: 503 },
      );
    }

    console.error("Stripe-Kundenportal konnte nicht geöffnet werden:", error);
    return NextResponse.json({ error: "portal_failed" }, { status: 500 });
  }
}
