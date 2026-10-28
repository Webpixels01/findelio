import "server-only";
import type { AppLocale } from "@/i18n/routing";

export type ListingRevisionChangedValue = {
  old: unknown;
  new: unknown;
};

export type ListingRevisionData = {
  name: string;
  description: string | null;
  description_translations?: Record<string, string>;
  street: string | null;
  postal_code: string;
  city: string;
  canton: string;
  public_email: string | null;
  phone: string | null;
  website_url: string | null;
  address_visibility: "full" | "city" | "hidden";
  industry_ids: string[];
  spoken_language_ids: string[];
  logo_id?: string | null;
  gallery_file_ids?: string[];
  social_links?: Array<{
    platform: string;
    url: string;
  }>;
  opening_hours?: Array<{
    day_of_week: number;
    opens_at: string;
    closes_at: string;
  }>;
  custom_cta_label?: string | null;
  custom_cta_value?: string | null;
};

export type PendingListingRevision = {
  id: string;
  status: "pending";
  review_version: number;
  changed_fields: Record<string, ListingRevisionChangedValue> | null;
  submitted_at: string | null;
  submitted_by: {
    id: string;
    first_name: string | null;
    last_name: string | null;
    email: string;
  } | null;
  listing: {
    id: string;
    name: string;
    slug: string;
    status: string;
    organization: {
      id: string;
      name: string;
    } | null;
  };
};

export type ListingRevisionDetail = PendingListingRevision & {
  data: ListingRevisionData;
};

export type ReviewOptionMaps = {
  cantons: Record<string, string>;
  industries: Record<string, string>;
  spokenLanguages: Record<string, string>;
};

type DirectusError = {
  message?: string;
  extensions?: { code?: string };
};

type DirectusListResponse<T> = {
  data?: T[];
  errors?: DirectusError[];
};

type DirectusItemResponse<T> = {
  data?: T;
  errors?: DirectusError[];
};

type DirectoryTranslation = {
  languages_code: string | { code?: string } | null;
  name: string | null;
};

type DirectoryRow = {
  id: string;
  code?: string;
  name: string;
  translations?: DirectoryTranslation[] | null;
};

const directusLanguageCodes: Record<AppLocale, string> = {
  "de-ch": "de-CH",
  en: "en-US",
  sk: "sk-SK",
  cs: "cs-CZ",
  hu: "hu-HU",
  pl: "pl-PL",
  ru: "ru-RU",
  "pt-pt": "pt-PT",
  ro: "ro-RO",
  vi: "vi-VN",
};

export class DirectusReviewError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly code?: string,
  ) {
    super(message);
    this.name = "DirectusReviewError";
  }
}

function getDirectusUrl(): string {
  const directusUrl = process.env.DIRECTUS_URL;

  if (!directusUrl) {
    throw new Error("DIRECTUS_URL fehlt in der Datei .env.local");
  }

  return directusUrl;
}

async function readListResponse<T>(response: Response): Promise<T[]> {
  let result: DirectusListResponse<T> | null = null;

  try {
    result = (await response.json()) as DirectusListResponse<T>;
  } catch {
    result = null;
  }

  if (!response.ok || !result?.data) {
    throw new DirectusReviewError(
      result?.errors?.[0]?.message ?? "Directus-Anfrage fehlgeschlagen.",
      response.status,
      result?.errors?.[0]?.extensions?.code,
    );
  }

  return result.data;
}

async function readItemResponse<T>(response: Response): Promise<T> {
  let result: DirectusItemResponse<T> | null = null;

  try {
    result = (await response.json()) as DirectusItemResponse<T>;
  } catch {
    result = null;
  }

  if (!response.ok || !result?.data) {
    throw new DirectusReviewError(
      result?.errors?.[0]?.message ?? "Directus-Anfrage fehlgeschlagen.",
      response.status,
      result?.errors?.[0]?.extensions?.code,
    );
  }

  return result.data;
}

function authorizationHeaders(accessToken: string): Record<string, string> {
  return { Authorization: `Bearer ${accessToken}` };
}

export async function getPendingListingRevisions(
  accessToken: string,
): Promise<PendingListingRevision[]> {
  const url = new URL("/items/listing_revisions", getDirectusUrl());

  url.searchParams.set(
    "fields",
    [
      "id",
      "status",
      "review_version",
      "changed_fields",
      "submitted_at",
      "submitted_by.id",
      "submitted_by.first_name",
      "submitted_by.last_name",
      "submitted_by.email",
      "listing.id",
      "listing.name",
      "listing.slug",
      "listing.status",
      "listing.organization.id",
      "listing.organization.name",
    ].join(","),
  );
  url.searchParams.set(
    "filter",
    JSON.stringify({ status: { _eq: "pending" } }),
  );
  url.searchParams.set("sort", "-submitted_at");
  url.searchParams.set("limit", "200");

  const response = await fetch(url, {
    headers: authorizationHeaders(accessToken),
    cache: "no-store",
  });

  return readListResponse<PendingListingRevision>(response);
}

export async function getPendingListingRevision(
  accessToken: string,
  revisionId: string,
): Promise<ListingRevisionDetail | null> {
  const url = new URL(
    `/items/listing_revisions/${encodeURIComponent(revisionId)}`,
    getDirectusUrl(),
  );
  url.searchParams.set(
    "fields",
    [
      "id",
      "status",
      "review_version",
      "data",
      "changed_fields",
      "submitted_at",
      "submitted_by.id",
      "submitted_by.first_name",
      "submitted_by.last_name",
      "submitted_by.email",
      "listing.id",
      "listing.name",
      "listing.slug",
      "listing.status",
      "listing.organization.id",
      "listing.organization.name",
    ].join(","),
  );

  const response = await fetch(url, {
    headers: authorizationHeaders(accessToken),
    cache: "no-store",
  });

  if (response.status === 404) return null;

  const revision = await readItemResponse<ListingRevisionDetail>(response);
  return revision.status === "pending" ? revision : null;
}

function relationCode(value: DirectoryTranslation["languages_code"]): string | null {
  if (typeof value === "string") return value;
  if (value && typeof value === "object" && typeof value.code === "string") {
    return value.code;
  }
  return null;
}

async function getDirectoryRows(
  accessToken: string,
  collection: "cantons" | "industries" | "spoken_languages",
): Promise<DirectoryRow[]> {
  const url = new URL(`/items/${collection}`, getDirectusUrl());
  url.searchParams.set(
    "fields",
    collection === "cantons"
      ? "id,code,name"
      : "id,code,name,translations.languages_code,translations.name",
  );
  url.searchParams.set("limit", "-1");

  const response = await fetch(url, {
    headers: authorizationHeaders(accessToken),
    cache: "no-store",
  });

  return readListResponse<DirectoryRow>(response);
}

function localizedDirectoryMap(
  rows: DirectoryRow[],
  languageCode: string,
  includeCode = false,
): Record<string, string> {
  return Object.fromEntries(
    rows.map((row) => {
      const translatedName = row.translations?.find(
        (translation) => relationCode(translation.languages_code) === languageCode,
      )?.name;
      const name = translatedName?.trim() || row.name;
      const label = includeCode && row.code ? `${row.code} – ${name}` : name;
      return [row.id, label];
    }),
  );
}

export async function getReviewOptionMaps(
  accessToken: string,
  locale: AppLocale,
): Promise<ReviewOptionMaps> {
  const [cantons, industries, spokenLanguages] = await Promise.all([
    getDirectoryRows(accessToken, "cantons"),
    getDirectoryRows(accessToken, "industries"),
    getDirectoryRows(accessToken, "spoken_languages"),
  ]);
  const languageCode = directusLanguageCodes[locale];

  return {
    cantons: localizedDirectoryMap(cantons, languageCode, true),
    industries: localizedDirectoryMap(industries, languageCode),
    spokenLanguages: localizedDirectoryMap(spokenLanguages, languageCode),
  };
}

async function decideRevision(
  accessToken: string,
  revisionId: string,
  reviewVersion: number,
  action: "approve" | "reject" | "suspend",
  reason = "",
): Promise<void> {
  await readItemResponse(await fetch(new URL("/findelio-referrals/approve-revision", getDirectusUrl()), {
    method: "POST",
    headers: { ...authorizationHeaders(accessToken), "Content-Type": "application/json" },
    body: JSON.stringify({ revision_id: revisionId, review_version: reviewVersion, action, reason }),
    cache: "no-store",
  }));
}

export async function approveListingRevision(accessToken: string, revisionId: string, reviewVersion: number): Promise<void> {
  await decideRevision(accessToken, revisionId, reviewVersion, "approve");
}

export async function rejectListingRevision(accessToken: string, revisionId: string, reviewVersion: number, reason: string): Promise<void> {
  await decideRevision(accessToken, revisionId, reviewVersion, "reject", reason);
}

export async function suspendListingFromRevision(accessToken: string, revisionId: string, reviewVersion: number, reason: string): Promise<void> {
  await decideRevision(accessToken, revisionId, reviewVersion, "suspend", reason);
}
