import "server-only";
import type { AppLocale } from "@/i18n/routing";

export type ListingRevisionChangedValue = {
  old: unknown;
  new: unknown;
};

export type ListingRevisionData = {
  name: string;
  short_description: string | null;
  description: string | null;
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

async function ensureMutationSucceeded(response: Response): Promise<void> {
  if (response.ok) return;

  let result: DirectusItemResponse<unknown> | null = null;

  try {
    result = (await response.json()) as DirectusItemResponse<unknown>;
  } catch {
    result = null;
  }

  throw new DirectusReviewError(
    result?.errors?.[0]?.message ?? "Directus-Änderung fehlgeschlagen.",
    response.status,
    result?.errors?.[0]?.extensions?.code,
  );
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

async function syncListingJunction(
  accessToken: string,
  listingId: string,
  collection: "listings_industries" | "listings_spoken_languages",
  referenceField: "industries_id" | "spoken_languages_id",
  desiredIds: string[],
): Promise<void> {
  const readUrl = new URL(`/items/${collection}`, getDirectusUrl());
  readUrl.searchParams.set("fields", `id,${referenceField}`);
  readUrl.searchParams.set("limit", "-1");
  readUrl.searchParams.set(
    "filter",
    JSON.stringify({ listings_id: { _eq: listingId } }),
  );

  const existingRows = await readListResponse<
    { id: number; industries_id?: string; spoken_languages_id?: string }
  >(
    await fetch(readUrl, {
      headers: authorizationHeaders(accessToken),
      cache: "no-store",
    }),
  );
  const desired = Array.from(new Set(desiredIds));
  const desiredSet = new Set(desired);
  const existingSet = new Set<string>();
  const rowIdsToDelete: number[] = [];

  for (const row of existingRows) {
    const referenceId = row[referenceField];
    if (!referenceId || !desiredSet.has(referenceId)) {
      rowIdsToDelete.push(row.id);
    } else {
      existingSet.add(referenceId);
    }
  }

  if (rowIdsToDelete.length > 0) {
    await ensureMutationSucceeded(
      await fetch(new URL(`/items/${collection}`, getDirectusUrl()), {
        method: "DELETE",
        headers: {
          ...authorizationHeaders(accessToken),
          "Content-Type": "application/json",
        },
        body: JSON.stringify(rowIdsToDelete),
        cache: "no-store",
      }),
    );
  }

  const idsToCreate = desired.filter((id) => !existingSet.has(id));

  if (idsToCreate.length > 0) {
    await ensureMutationSucceeded(
      await fetch(new URL(`/items/${collection}`, getDirectusUrl()), {
        method: "POST",
        headers: {
          ...authorizationHeaders(accessToken),
          "Content-Type": "application/json",
        },
        body: JSON.stringify(
          idsToCreate.map((id) => ({
            listings_id: listingId,
            [referenceField]: id,
          })),
        ),
        cache: "no-store",
      }),
    );
  }
}

function relatedId(
  value: string | { id: string } | null | undefined,
): string | null {
  if (typeof value === "string") return value;
  return value?.id ?? null;
}

async function syncListingGallery(
  accessToken: string,
  listingId: string,
  desiredFileIds: string[],
): Promise<void> {
  const readUrl = new URL("/items/listings_files", getDirectusUrl());
  readUrl.searchParams.set("fields", "id,directus_files_id");
  readUrl.searchParams.set("limit", "-1");
  readUrl.searchParams.set(
    "filter",
    JSON.stringify({ listings_id: { _eq: listingId } }),
  );

  const existingRows = await readListResponse<
    {
      id: number;
      directus_files_id: string | { id: string } | null;
    }
  >(
    await fetch(readUrl, {
      headers: authorizationHeaders(accessToken),
      cache: "no-store",
    }),
  );
  const desiredIds = Array.from(new Set(desiredFileIds));
  const desiredSet = new Set(desiredIds);
  const existingSet = new Set<string>();
  const rowIdsToDelete: number[] = [];

  for (const row of existingRows) {
    const fileId = relatedId(row.directus_files_id);

    if (!fileId || !desiredSet.has(fileId) || existingSet.has(fileId)) {
      rowIdsToDelete.push(row.id);
    } else {
      existingSet.add(fileId);
    }
  }

  if (rowIdsToDelete.length > 0) {
    await ensureMutationSucceeded(
      await fetch(new URL("/items/listings_files", getDirectusUrl()), {
        method: "DELETE",
        headers: {
          ...authorizationHeaders(accessToken),
          "Content-Type": "application/json",
        },
        body: JSON.stringify(rowIdsToDelete),
        cache: "no-store",
      }),
    );
  }

  const idsToCreate = desiredIds.filter((id) => !existingSet.has(id));

  if (idsToCreate.length > 0) {
    await ensureMutationSucceeded(
      await fetch(new URL("/items/listings_files", getDirectusUrl()), {
        method: "POST",
        headers: {
          ...authorizationHeaders(accessToken),
          "Content-Type": "application/json",
        },
        body: JSON.stringify(
          idsToCreate.map((fileId) => ({
            listings_id: listingId,
            directus_files_id: fileId,
          })),
        ),
        cache: "no-store",
      }),
    );
  }
}

type ReviewOpeningHour = {
  id?: string;
  day_of_week: number;
  opens_at: string;
  closes_at: string;
};

function openingHourKey(value: ReviewOpeningHour): string {
  return `${value.day_of_week}:${value.opens_at.slice(0, 5)}:${value.closes_at.slice(0, 5)}`;
}

async function syncListingOpeningHours(
  accessToken: string,
  listingId: string,
  desiredOpeningHours: ReviewOpeningHour[],
): Promise<void> {
  const readUrl = new URL("/items/listing_opening_hours", getDirectusUrl());
  readUrl.searchParams.set("fields", "id,day_of_week,opens_at,closes_at");
  readUrl.searchParams.set("limit", "-1");
  readUrl.searchParams.set(
    "filter",
    JSON.stringify({ listing: { _eq: listingId } }),
  );

  const existingRows = await readListResponse<
    ReviewOpeningHour & { id: string }
  >(
    await fetch(readUrl, {
      headers: authorizationHeaders(accessToken),
      cache: "no-store",
    }),
  );
  const desiredByKey = new Map(
    desiredOpeningHours.map((item) => [openingHourKey(item), item]),
  );
  const existingKeys = new Set<string>();
  const rowIdsToDelete: string[] = [];

  for (const row of existingRows) {
    const key = openingHourKey(row);

    if (!desiredByKey.has(key) || existingKeys.has(key)) {
      rowIdsToDelete.push(row.id);
    } else {
      existingKeys.add(key);
    }
  }

  if (rowIdsToDelete.length > 0) {
    await ensureMutationSucceeded(
      await fetch(
        new URL("/items/listing_opening_hours", getDirectusUrl()),
        {
          method: "DELETE",
          headers: {
            ...authorizationHeaders(accessToken),
            "Content-Type": "application/json",
          },
          body: JSON.stringify(rowIdsToDelete),
          cache: "no-store",
        },
      ),
    );
  }

  const valuesToCreate = Array.from(desiredByKey.entries())
    .filter(([key]) => !existingKeys.has(key))
    .map(([, item]) => ({
      listing: listingId,
      day_of_week: item.day_of_week,
      opens_at: item.opens_at,
      closes_at: item.closes_at,
    }));

  if (valuesToCreate.length > 0) {
    await ensureMutationSucceeded(
      await fetch(
        new URL("/items/listing_opening_hours", getDirectusUrl()),
        {
          method: "POST",
          headers: {
            ...authorizationHeaders(accessToken),
            "Content-Type": "application/json",
          },
          body: JSON.stringify(valuesToCreate),
          cache: "no-store",
        },
      ),
    );
  }
}

async function finishRevision(
  accessToken: string,
  revisionId: string,
  values: Record<string, unknown>,
): Promise<void> {
  await ensureMutationSucceeded(
    await fetch(
      new URL(
        `/items/listing_revisions/${encodeURIComponent(revisionId)}`,
        getDirectusUrl(),
      ),
      {
        method: "PATCH",
        headers: {
          ...authorizationHeaders(accessToken),
          "Content-Type": "application/json",
        },
        body: JSON.stringify(values),
        cache: "no-store",
      },
    ),
  );
}

export async function approveListingRevision(
  accessToken: string,
  revisionId: string,
  reviewedBy: string,
): Promise<void> {
  const revision = await getPendingListingRevision(accessToken, revisionId);

  if (!revision) {
    throw new DirectusReviewError("Revision nicht gefunden.", 404, "NOT_FOUND");
  }

  const data = revision.data;
  const listingId = revision.listing.id;
  const reviewedAt = new Date().toISOString();

  await ensureMutationSucceeded(
    await fetch(
      new URL(`/items/listings/${encodeURIComponent(listingId)}`, getDirectusUrl()),
      {
        method: "PATCH",
        headers: {
          ...authorizationHeaders(accessToken),
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: data.name,
          short_description: data.short_description,
          description: data.description,
          street: data.street,
          postal_code: data.postal_code,
          city: data.city,
          canton: data.canton,
          public_email: data.public_email,
          phone: data.phone,
          website_url: data.website_url,
          address_visibility: data.address_visibility,
          ...(data.logo_id !== undefined
            ? { logo: data.logo_id }
            : {}),
          ...(data.social_links !== undefined
            ? { social_links: data.social_links }
            : {}),
          ...(data.custom_cta_label !== undefined
            ? { custom_cta_label: data.custom_cta_label }
            : {}),
          ...(data.custom_cta_value !== undefined
            ? { custom_cta_value: data.custom_cta_value }
            : {}),
          status: "published",
          published_at: reviewedAt,
        }),
        cache: "no-store",
      },
    ),
  );

  await Promise.all([
    syncListingJunction(
      accessToken,
      listingId,
      "listings_industries",
      "industries_id",
      data.industry_ids,
    ),
    syncListingJunction(
      accessToken,
      listingId,
      "listings_spoken_languages",
      "spoken_languages_id",
      data.spoken_language_ids,
    ),
    ...(data.gallery_file_ids
      ? [
          syncListingGallery(
            accessToken,
            listingId,
            data.gallery_file_ids,
          ),
        ]
      : []),
    ...(data.opening_hours
      ? [
          syncListingOpeningHours(
            accessToken,
            listingId,
            data.opening_hours,
          ),
        ]
      : []),
  ]);

  await finishRevision(accessToken, revisionId, {
    status: "approved",
    rejection_reason: null,
    reviewed_by: reviewedBy,
    reviewed_at: reviewedAt,
  });
}

export async function rejectListingRevision(
  accessToken: string,
  revisionId: string,
  reviewedBy: string,
  reason: string,
): Promise<void> {
  const revision = await getPendingListingRevision(accessToken, revisionId);

  if (!revision) {
    throw new DirectusReviewError("Revision nicht gefunden.", 404, "NOT_FOUND");
  }

  if (revision.listing.status === "pending") {
    await ensureMutationSucceeded(
      await fetch(
        new URL(
          `/items/listings/${encodeURIComponent(revision.listing.id)}`,
          getDirectusUrl(),
        ),
        {
          method: "PATCH",
          headers: {
            ...authorizationHeaders(accessToken),
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ status: "draft" }),
          cache: "no-store",
        },
      ),
    );
  }

  await finishRevision(accessToken, revisionId, {
    status: "rejected",
    rejection_reason: reason,
    reviewed_by: reviewedBy,
    reviewed_at: new Date().toISOString(),
  });
}

export async function suspendListingFromRevision(
  accessToken: string,
  revisionId: string,
  reviewedBy: string,
  reason: string,
): Promise<void> {
  const revision = await getPendingListingRevision(accessToken, revisionId);

  if (!revision) {
    throw new DirectusReviewError("Revision nicht gefunden.", 404, "NOT_FOUND");
  }

  const reviewedAt = new Date().toISOString();

  await ensureMutationSucceeded(
    await fetch(
      new URL(
        `/items/listings/${encodeURIComponent(revision.listing.id)}`,
        getDirectusUrl(),
      ),
      {
        method: "PATCH",
        headers: {
          ...authorizationHeaders(accessToken),
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ status: "suspended" }),
        cache: "no-store",
      },
    ),
  );

  await finishRevision(accessToken, revisionId, {
    status: "rejected",
    rejection_reason: reason,
    reviewed_by: reviewedBy,
    reviewed_at: reviewedAt,
  });
}
