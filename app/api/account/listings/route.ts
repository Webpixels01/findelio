import { NextResponse } from "next/server";
import {
  clearAuthCookies,
  getAccessToken,
  getRefreshToken,
  saveAuthTokens,
} from "@/lib/auth";
import {
  createAccountListing,
  DirectusAccountError,
  type AccountListingCreate,
} from "@/lib/directus-account";
import {
  DirectusAuthError,
  refreshDirectusSession,
} from "@/lib/directus-auth";
import { getCantonIdByCode } from "@/lib/directus";

const cantonCodes = new Set([
  "AG", "AI", "AR", "BE", "BL", "BS", "FR", "GE", "GL", "GR", "JU",
  "LU", "NE", "NW", "OW", "SG", "SH", "SO", "SZ", "TG", "TI", "UR",
  "VD", "VS", "ZG", "ZH",
]);
const addressVisibilityValues = new Set(["full", "city", "hidden"]);
const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

type ValidatedCreateValues = Omit<AccountListingCreate, "canton"> & {
  canton: string;
  plan: "free" | "premium";
  billing_interval: "monthly" | "yearly";
};

function isTrustedOrigin(request: Request): boolean {
  const origin = request.headers.get("origin");

  if (!origin) return true;

  const expectedOrigin = new URL(
    process.env.NEXT_PUBLIC_SITE_URL ?? request.url,
  ).origin;

  return origin === expectedOrigin;
}

function stringValue(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function optionalString(value: unknown): string | null {
  const normalized = stringValue(value);
  return normalized || null;
}

function hasValidLength(value: string | null, maximum: number): boolean {
  return value === null || value.length <= maximum;
}

function normalizeWebsite(value: unknown): string | null {
  const rawValue = stringValue(value);

  if (!rawValue) return null;

  const candidate = /^https?:\/\//i.test(rawValue)
    ? rawValue
    : `https://${rawValue}`;
  const parsedUrl = new URL(candidate);

  if (!["http:", "https:"].includes(parsedUrl.protocol)) {
    throw new Error("INVALID_WEBSITE");
  }

  return parsedUrl.toString();
}

function validateBody(body: unknown): ValidatedCreateValues | null {
  if (!body || typeof body !== "object") return null;

  const data = body as Record<string, unknown>;
  const organization = stringValue(data.organization_id);
  const name = stringValue(data.name);
  const shortDescription = optionalString(data.short_description);
  const description = optionalString(data.description);
  const street = optionalString(data.street);
  const postalCode = stringValue(data.postal_code);
  const city = stringValue(data.city);
  const canton = stringValue(data.canton).toUpperCase();
  const publicEmail = optionalString(data.public_email)?.toLowerCase() ?? null;
  const phone = optionalString(data.phone);
  const addressVisibility = stringValue(data.address_visibility);
  const plan = stringValue(data.plan);
  const billingInterval = stringValue(data.billing_interval);

  let websiteUrl: string | null;

  try {
    websiteUrl = normalizeWebsite(data.website_url);
  } catch {
    return null;
  }

  if (
    !uuidPattern.test(organization) ||
    !name ||
    !postalCode ||
    !city ||
    !cantonCodes.has(canton) ||
    !addressVisibilityValues.has(addressVisibility) ||
    !["free", "premium"].includes(plan) ||
    !["monthly", "yearly"].includes(billingInterval)
  ) {
    return null;
  }

  if (
    !hasValidLength(name, 180) ||
    !hasValidLength(shortDescription, 500) ||
    !hasValidLength(description, 20000) ||
    !hasValidLength(street, 200) ||
    !hasValidLength(postalCode, 20) ||
    !hasValidLength(city, 120) ||
    !hasValidLength(publicEmail, 254) ||
    !hasValidLength(phone, 60) ||
    !hasValidLength(websiteUrl, 500)
  ) {
    return null;
  }

  if (publicEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(publicEmail)) {
    return null;
  }

  return {
    organization,
    name,
    short_description: shortDescription,
    description,
    street,
    postal_code: postalCode,
    city,
    canton,
    public_email: publicEmail,
    phone,
    website_url: websiteUrl,
    address_visibility:
      addressVisibility as AccountListingCreate["address_visibility"],
    plan: plan as ValidatedCreateValues["plan"],
    billing_interval:
      billingInterval as ValidatedCreateValues["billing_interval"],
  };
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

export async function POST(request: Request) {
  if (!isTrustedOrigin(request)) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  if (!request.headers.get("content-type")?.includes("application/json")) {
    return NextResponse.json({ error: "invalid_data" }, { status: 415 });
  }

  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid_data" }, { status: 400 });
  }

  const values = validateBody(body);

  if (!values) {
    return NextResponse.json({ error: "invalid_data" }, { status: 400 });
  }

  let cantonId: string | null;

  try {
    cantonId = await getCantonIdByCode(values.canton);
  } catch (error) {
    console.error("Kanton konnte nicht aufgelöst werden:", error);
    return NextResponse.json({ error: "create_failed" }, { status: 500 });
  }

  if (!cantonId) {
    return NextResponse.json({ error: "invalid_data" }, { status: 400 });
  }

  const {
    plan,
    billing_interval: billingInterval,
    ...listingValues
  } = values;
  const createValues: AccountListingCreate = {
    ...listingValues,
    canton: cantonId,
  };

  let accessToken = await getAccessToken();

  if (!accessToken) accessToken = await refreshAccessToken();

  if (!accessToken) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  try {
    const listing = await createAccountListing(accessToken, createValues);

    return NextResponse.json(
      {
        success: true,
        listing: { id: listing.id },
        checkout_required: plan === "premium",
        billing_interval: billingInterval,
      },
      { status: 201, headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    if (error instanceof DirectusAccountError && error.status === 401) {
      const refreshedAccessToken = await refreshAccessToken();

      if (!refreshedAccessToken) {
        return NextResponse.json({ error: "unauthorized" }, { status: 401 });
      }

      try {
        const listing = await createAccountListing(
          refreshedAccessToken,
          createValues,
        );

        return NextResponse.json(
          {
            success: true,
            listing: { id: listing.id },
            checkout_required: plan === "premium",
            billing_interval: billingInterval,
          },
          { status: 201, headers: { "Cache-Control": "no-store" } },
        );
      } catch (retryError) {
        error = retryError;
      }
    }

    if (error instanceof DirectusAccountError) {
      if (error.status === 403) {
        return NextResponse.json({ error: "forbidden" }, { status: 403 });
      }

      console.warn(
        "Firmenprofil konnte nicht erstellt werden:",
        error.code ?? error.status,
      );
    } else if (error instanceof DirectusAuthError) {
      await clearAuthCookies();
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    } else {
      console.error("Firmenprofil konnte nicht erstellt werden:", error);
    }

    return NextResponse.json({ error: "create_failed" }, { status: 500 });
  }
}
