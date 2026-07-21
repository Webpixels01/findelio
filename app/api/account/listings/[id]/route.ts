import { NextResponse } from "next/server";
import {
  clearAuthCookies,
  getAccessToken,
  getRefreshToken,
  saveAuthTokens,
} from "@/lib/auth";
import {
  DirectusAccountError,
  type AccountListingUpdate,
  updateEditableAccountListing,
} from "@/lib/directus-account";
import {
  DirectusAuthError,
  refreshDirectusSession,
} from "@/lib/directus-auth";
import { getCantonIdByCode } from "@/lib/directus";

const cantonCodes = new Set([
  "AG",
  "AI",
  "AR",
  "BE",
  "BL",
  "BS",
  "FR",
  "GE",
  "GL",
  "GR",
  "JU",
  "LU",
  "NE",
  "NW",
  "OW",
  "SG",
  "SH",
  "SO",
  "SZ",
  "TG",
  "TI",
  "UR",
  "VD",
  "VS",
  "ZG",
  "ZH",
]);

const statusValues = new Set(["draft", "pending"]);
const addressVisibilityValues = new Set(["full", "city", "hidden"]);

function isTrustedOrigin(request: Request): boolean {
  const origin = request.headers.get("origin");

  if (!origin) {
    return true;
  }

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

  if (!rawValue) {
    return null;
  }

  const candidate = /^https?:\/\//i.test(rawValue)
    ? rawValue
    : `https://${rawValue}`;
  const parsedUrl = new URL(candidate);

  if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
    throw new Error("INVALID_WEBSITE");
  }

  return parsedUrl.toString();
}

function validateBody(body: unknown): AccountListingUpdate | null {
  if (!body || typeof body !== "object") {
    return null;
  }

  const data = body as Record<string, unknown>;
  const name = stringValue(data.name);
  const shortDescription = optionalString(data.short_description);
  const description = optionalString(data.description);
  const street = optionalString(data.street);
  const postalCode = stringValue(data.postal_code);
  const city = stringValue(data.city);
  const canton = stringValue(data.canton).toUpperCase();
  const publicEmail = optionalString(data.public_email)?.toLowerCase() ?? null;
  const phone = optionalString(data.phone);
  const status = stringValue(data.status);
  const addressVisibility = stringValue(data.address_visibility);

  let websiteUrl: string | null;

  try {
    websiteUrl = normalizeWebsite(data.website_url);
  } catch {
    return null;
  }

  if (
    !name ||
    !postalCode ||
    !city ||
    !cantonCodes.has(canton) ||
    !statusValues.has(status) ||
    !addressVisibilityValues.has(addressVisibility)
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

  if (
    publicEmail &&
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(publicEmail)
  ) {
    return null;
  }

  return {
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
    address_visibility: addressVisibility as AccountListingUpdate["address_visibility"],
    status: status as AccountListingUpdate["status"],
  };
}

async function refreshAccessToken(): Promise<string | null> {
  const refreshToken = await getRefreshToken();

  if (!refreshToken) {
    return null;
  }

  try {
    const tokens = await refreshDirectusSession(refreshToken);
    await saveAuthTokens(tokens);
    return tokens.access_token;
  } catch {
    await clearAuthCookies();
    return null;
  }
}

async function updateWithToken(
  accessToken: string,
  listingId: string,
  values: AccountListingUpdate,
) {
  return updateEditableAccountListing(accessToken, listingId, values);
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!isTrustedOrigin(request)) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  if (!request.headers.get("content-type")?.includes("application/json")) {
    return NextResponse.json({ error: "invalid_data" }, { status: 415 });
  }

  const { id } = await params;
  const listingId = id.trim();

  if (!listingId) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
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
    return NextResponse.json({ error: "save_failed" }, { status: 500 });
  }

  if (!cantonId) {
    return NextResponse.json({ error: "invalid_data" }, { status: 400 });
  }

  const updateValues: AccountListingUpdate = {
    ...values,
    canton: cantonId,
  };

  let accessToken = await getAccessToken();

  if (!accessToken) {
    accessToken = await refreshAccessToken();
  }

  if (!accessToken) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  try {
    const listing = await updateWithToken(accessToken, listingId, updateValues);

    return NextResponse.json(
      { success: true, listing },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    if (error instanceof DirectusAccountError && error.status === 401) {
      const refreshedAccessToken = await refreshAccessToken();

      if (!refreshedAccessToken) {
        return NextResponse.json(
          { error: "unauthorized" },
          { status: 401 },
        );
      }

      try {
        const listing = await updateWithToken(
          refreshedAccessToken,
          listingId,
          updateValues,
        );

        return NextResponse.json(
          { success: true, listing },
          { headers: { "Cache-Control": "no-store" } },
        );
      } catch (retryError) {
        error = retryError;
      }
    }

    if (error instanceof DirectusAccountError) {
      if (error.status === 403) {
        return NextResponse.json({ error: "forbidden" }, { status: 403 });
      }

      if (error.status === 404) {
        return NextResponse.json({ error: "not_found" }, { status: 404 });
      }

      console.warn(
        "Firmenprofil konnte nicht gespeichert werden:",
        error.code ?? error.status,
      );
    } else if (error instanceof DirectusAuthError) {
      await clearAuthCookies();
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    } else {
      console.error("Firmenprofil konnte nicht gespeichert werden:", error);
    }

    return NextResponse.json({ error: "save_failed" }, { status: 500 });
  }
}
