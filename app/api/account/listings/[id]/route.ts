import { NextResponse } from "next/server";
import {
  clearAuthCookies,
  getAccessToken,
  getRefreshToken,
  saveAuthTokens,
} from "@/lib/auth";
import {
  DirectusAccountError,
  type AccountListingEditorUpdate,
  type AccountOpeningHour,
  type AccountPremiumListingUpdate,
  type AccountSocialLink,
  updateEditableAccountListing,
} from "@/lib/directus-account";
import {
  DirectusAuthError,
  getDirectusCurrentUser,
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
const socialPlatforms = new Set([
  "instagram",
  "facebook",
  "linkedin",
  "tiktok",
  "youtube",
  "x",
]);
const timePattern = /^([01]\d|2[0-3]):[0-5]\d$/;

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

function relationIds(value: unknown, maximumItems: number): string[] | null {
  if (!Array.isArray(value) || value.length > maximumItems) {
    return null;
  }

  const ids: string[] = [];

  for (const item of value) {
    if (typeof item !== "string") {
      return null;
    }

    const id = item.trim();

    if (!id || id.length > 100) {
      return null;
    }

    ids.push(id);
  }

  return Array.from(new Set(ids));
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

function fileId(value: unknown): string | null | undefined {
  if (value === null) {
    return null;
  }

  if (
    typeof value !== "string" ||
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      value,
    )
  ) {
    return undefined;
  }

  return value;
}

function socialLinks(value: unknown): AccountSocialLink[] | null {
  if (!Array.isArray(value) || value.length > 6) {
    return null;
  }

  const links: AccountSocialLink[] = [];
  const usedPlatforms = new Set<string>();

  for (const item of value) {
    if (!item || typeof item !== "object") {
      return null;
    }

    const data = item as Record<string, unknown>;
    const platform = stringValue(data.platform);
    const rawUrl = stringValue(data.url);

    if (
      !socialPlatforms.has(platform) ||
      usedPlatforms.has(platform) ||
      !rawUrl ||
      rawUrl.length > 500
    ) {
      return null;
    }

    let parsedUrl: URL;

    try {
      parsedUrl = new URL(rawUrl);
    } catch {
      return null;
    }

    if (!["http:", "https:"].includes(parsedUrl.protocol)) {
      return null;
    }

    usedPlatforms.add(platform);
    links.push({
      platform: platform as AccountSocialLink["platform"],
      url: parsedUrl.toString(),
    });
  }

  return links;
}

function openingHours(value: unknown): AccountOpeningHour[] | null {
  if (!Array.isArray(value) || value.length > 21) {
    return null;
  }

  const hours: AccountOpeningHour[] = [];
  const intervalsByDay = new Map<number, AccountOpeningHour[]>();

  for (const item of value) {
    if (!item || typeof item !== "object") {
      return null;
    }

    const data = item as Record<string, unknown>;
    const day = data.day_of_week;
    const opensAt = stringValue(data.opens_at);
    const closesAt = stringValue(data.closes_at);

    if (
      typeof day !== "number" ||
      !Number.isInteger(day) ||
      day < 1 ||
      day > 7 ||
      !timePattern.test(opensAt) ||
      !timePattern.test(closesAt) ||
      opensAt >= closesAt
    ) {
      return null;
    }

    const interval = {
      day_of_week: day,
      opens_at: opensAt,
      closes_at: closesAt,
    };
    hours.push(interval);
    intervalsByDay.set(day, [
      ...(intervalsByDay.get(day) ?? []),
      interval,
    ]);
  }

  for (const intervals of intervalsByDay.values()) {
    intervals.sort((first, second) =>
      first.opens_at.localeCompare(second.opens_at),
    );

    if (
      intervals.some(
        (interval, index) =>
          index > 0 &&
          interval.opens_at < intervals[index - 1].closes_at,
      )
    ) {
      return null;
    }
  }

  return hours;
}

function premiumValues(
  value: unknown,
): AccountPremiumListingUpdate | null | undefined {
  if (value === undefined) {
    return undefined;
  }

  if (!value || typeof value !== "object") {
    return null;
  }

  const data = value as Record<string, unknown>;
  const logoId = fileId(data.logo_id);
  const galleryFileIds = relationIds(data.gallery_file_ids, 10);
  const validatedSocialLinks = socialLinks(data.social_links);
  const validatedOpeningHours = openingHours(data.opening_hours);

  if (
    logoId === undefined ||
    galleryFileIds === null ||
    validatedSocialLinks === null ||
    validatedOpeningHours === null
  ) {
    return null;
  }

  if (galleryFileIds.some((id) => fileId(id) === undefined)) {
    return null;
  }

  return {
    logo_id: logoId,
    gallery_file_ids: galleryFileIds,
    social_links: validatedSocialLinks,
    opening_hours: validatedOpeningHours,
  };
}

function validateBody(body: unknown): AccountListingEditorUpdate | null {
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
  const industryIds = relationIds(data.industry_ids, 100);
  const spokenLanguageIds = relationIds(data.spoken_language_ids, 100);
  const premium = premiumValues(data.premium);

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
    !addressVisibilityValues.has(addressVisibility) ||
    industryIds === null ||
    spokenLanguageIds === null ||
    premium === null
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
    address_visibility:
      addressVisibility as AccountListingEditorUpdate["address_visibility"],
    status: status as AccountListingEditorUpdate["status"],
    industry_ids: industryIds,
    spoken_language_ids: spokenLanguageIds,
    ...(premium ? { premium } : {}),
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
  values: AccountListingEditorUpdate,
) {
  const currentUser = await getDirectusCurrentUser(accessToken);

  return updateEditableAccountListing(
    accessToken,
    listingId,
    values,
    currentUser.id,
  );
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

  const updateValues: AccountListingEditorUpdate = {
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
      if (error.status === 400) {
        return NextResponse.json(
          {
            error:
              error.code === "INVALID_FILE"
                ? "invalid_image"
                : "invalid_selection",
          },
          { status: 400 },
        );
      }

      if (error.status === 403) {
        return NextResponse.json(
          {
            error:
              error.code === "PREMIUM_REQUIRED"
                ? "premium_required"
                : "forbidden",
          },
          { status: 403 },
        );
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
