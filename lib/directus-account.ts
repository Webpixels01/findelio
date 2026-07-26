import "server-only";
import { sendListingReviewNotification } from "@/lib/mail";

export type AccountOrganization = {
  id: string;
  name: string;
  slug: string;
  status: string;
};

export type AccountMembership = {
  id: string;
  role: string;
  status: string;
  organization: AccountOrganization;
};

export type AccountListing = {
  id: string;
  name: string;
  slug: string;
  status: string;
  postal_code: string | null;
  city: string | null;
  verification_status: string | null;
  organization: {
    id: string;
  };
};

export type EditableAccountListing = AccountListing & {
  short_description: string | null;
  description: string | null;
  street: string | null;
  canton: {
    id?: string;
    code: string;
    name: string;
  } | null;
  public_email: string | null;
  phone: string | null;
  website_url: string | null;
  address_visibility: "full" | "city" | "hidden" | null;
};

type RawEditableAccountListing = Omit<EditableAccountListing, "canton"> & {
  canton:
    | string
    | {
        id?: string;
        code?: string;
        name?: string;
      }
    | null;
};

export type AccountListingCreate = {
  organization: string;
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
};

export type AccountListingUpdate = {
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
  status: "draft" | "pending";
};

export type AccountListingEditorUpdate = AccountListingUpdate & {
  industry_ids: string[];
  spoken_language_ids: string[];
};

type ListingRevisionStatus =
  | "draft"
  | "pending"
  | "approved"
  | "rejected"
  | "superseded";

type ListingRevisionData = Omit<AccountListingUpdate, "status"> & {
  industry_ids: string[];
  spoken_language_ids: string[];
};

type ListingRevisionChangedFields = Record<
  string,
  {
    old: unknown;
    new: unknown;
  }
>;

type ListingRevision = {
  id: string;
  listing: string | { id: string };
  status: ListingRevisionStatus;
  data: ListingRevisionData;
  changed_fields: ListingRevisionChangedFields | null;
  submitted_by: string | { id: string } | null;
  submitted_at: string | null;
};

export type EditableAccountListingEditorData = {
  listing: EditableAccountListing;
  industryIds: string[];
  spokenLanguageIds: string[];
};

export type AccountOrganizationOverview = AccountMembership & {
  listings: AccountListing[];
};

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

export class DirectusAccountError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly code?: string,
  ) {
    super(message);
    this.name = "DirectusAccountError";
  }
}

function getDirectusServerToken(): string {
  const directusToken = process.env.DIRECTUS_TOKEN;

  if (!directusToken) {
    throw new Error("DIRECTUS_TOKEN fehlt in der Datei .env.local");
  }

  return directusToken;
}

function getDirectusUrl(): string {
  const directusUrl = process.env.DIRECTUS_URL;

  if (!directusUrl) {
    throw new Error("DIRECTUS_URL fehlt in der Datei .env.local");
  }

  return directusUrl;
}

function createDirectusError(
  response: Response,
  errors?: DirectusError[],
): DirectusAccountError {
  return new DirectusAccountError(
    errors?.[0]?.message ?? "Directus-Anfrage fehlgeschlagen.",
    response.status,
    errors?.[0]?.extensions?.code,
  );
}

async function readDirectusListResponse<T>(response: Response): Promise<T[]> {
  let result: DirectusListResponse<T> | null = null;

  try {
    result = (await response.json()) as DirectusListResponse<T>;
  } catch {
    result = null;
  }

  if (!response.ok || !result?.data) {
    throw createDirectusError(response, result?.errors);
  }

  return result.data;
}

async function readDirectusItemResponse<T>(response: Response): Promise<T> {
  let result: DirectusItemResponse<T> | null = null;

  try {
    result = (await response.json()) as DirectusItemResponse<T>;
  } catch {
    result = null;
  }

  if (!response.ok || !result?.data) {
    throw createDirectusError(response, result?.errors);
  }

  return result.data;
}

function directusServerHeaders(): HeadersInit {
  return {
    Authorization: `Bearer ${getDirectusServerToken()}`,
  };
}

async function ensureDirectusMutationSucceeded(
  response: Response,
): Promise<void> {
  if (response.ok) {
    return;
  }

  let result: DirectusItemResponse<unknown> | null = null;

  try {
    result = (await response.json()) as DirectusItemResponse<unknown>;
  } catch {
    result = null;
  }

  throw createDirectusError(response, result?.errors);
}

async function getOrganizationMemberships(
  accessToken: string,
): Promise<AccountMembership[]> {
  const url = new URL("/items/organization_members", getDirectusUrl());

  url.searchParams.set(
    "fields",
    [
      "id",
      "role",
      "status",
      "organization.id",
      "organization.name",
      "organization.slug",
      "organization.status",
    ].join(","),
  );
  url.searchParams.set("sort", "organization.name");
  url.searchParams.set("limit", "100");

  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
    cache: "no-store",
  });

  const memberships = await readDirectusListResponse<AccountMembership>(
    response,
  );

  return memberships.filter(
    (membership) =>
      membership.status === "active" &&
      membership.organization &&
      typeof membership.organization.id === "string",
  );
}

async function getListingsForOrganizations(
  accessToken: string,
  organizationIds: string[],
): Promise<AccountListing[]> {
  if (organizationIds.length === 0) {
    return [];
  }

  const url = new URL("/items/listings", getDirectusUrl());

  url.searchParams.set(
    "fields",
    [
      "id",
      "name",
      "slug",
      "status",
      "postal_code",
      "city",
      "verification_status",
      "organization.id",
    ].join(","),
  );
  url.searchParams.set("sort", "name");
  url.searchParams.set("limit", "500");
  url.searchParams.set(
    "filter",
    JSON.stringify({
      organization: {
        id: {
          _in: organizationIds,
        },
      },
    }),
  );

  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
    cache: "no-store",
  });

  return readDirectusListResponse<AccountListing>(response);
}

function editableListingFields(): string {
  return [
    "id",
    "name",
    "slug",
    "status",
    "short_description",
    "description",
    "street",
    "postal_code",
    "city",
    "canton",
    "canton.id",
    "canton.code",
    "canton.name",
    "public_email",
    "phone",
    "website_url",
    "address_visibility",
    "verification_status",
    "organization.id",
  ].join(",");
}

export async function getEditableAccountListing(
  accessToken: string,
  listingId: string,
): Promise<EditableAccountListing | null> {
  const memberships = await getOrganizationMemberships(accessToken);
  const activeOrganizationIds = new Set(
    memberships.map((membership) => membership.organization.id),
  );

  if (activeOrganizationIds.size === 0) {
    return null;
  }

  const url = new URL(
    `/items/listings/${encodeURIComponent(listingId)}`,
    getDirectusUrl(),
  );
  url.searchParams.set("fields", editableListingFields());

  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
    cache: "no-store",
  });

  if (response.status === 404) {
    return null;
  }

  const rawListing = await readDirectusItemResponse<RawEditableAccountListing>(
    response,
  );

  if (!activeOrganizationIds.has(rawListing.organization?.id)) {
    return null;
  }

  let canton: EditableAccountListing["canton"] = null;

  if (typeof rawListing.canton === "string") {
    canton = await getCantonById(rawListing.canton);
  } else if (rawListing.canton?.code && rawListing.canton.name) {
    canton = {
      id: rawListing.canton.id,
      code: rawListing.canton.code,
      name: rawListing.canton.name,
    };
  } else if (rawListing.canton?.id) {
    canton = await getCantonById(rawListing.canton.id);
  }

  return {
    ...rawListing,
    canton,
  };
}

type ListingRelationCollection =
  | "listings_industries"
  | "listings_spoken_languages";

type ReferenceCollection = "industries" | "spoken_languages";

type ListingRelationField = "industries_id" | "spoken_languages_id";

type ListingRelationRow = {
  id: string | number;
  industries_id?: string | number | { id: string | number } | null;
  spoken_languages_id?: string | number | { id: string | number } | null;
};

type ReferenceItem = {
  id: string | number;
};

type ListingRelationConfig = {
  junctionCollection: ListingRelationCollection;
  referenceCollection: ReferenceCollection;
  referenceField: ListingRelationField;
};

const industryRelationConfig: ListingRelationConfig = {
  junctionCollection: "listings_industries",
  referenceCollection: "industries",
  referenceField: "industries_id",
};

const spokenLanguageRelationConfig: ListingRelationConfig = {
  junctionCollection: "listings_spoken_languages",
  referenceCollection: "spoken_languages",
  referenceField: "spoken_languages_id",
};

function relationId(
  value: string | number | { id: string | number } | null | undefined,
): string | null {
  if (typeof value === "string" || typeof value === "number") {
    return String(value);
  }

  if (value && (typeof value.id === "string" || typeof value.id === "number")) {
    return String(value.id);
  }

  return null;
}

async function getListingRelationRows(
  listingId: string,
  config: ListingRelationConfig,
): Promise<ListingRelationRow[]> {
  const url = new URL(
    `/items/${config.junctionCollection}`,
    getDirectusUrl(),
  );

  url.searchParams.set("fields", `id,${config.referenceField}`);
  url.searchParams.set("limit", "-1");
  url.searchParams.set(
    "filter",
    JSON.stringify({
      listings_id: {
        _eq: listingId,
      },
    }),
  );

  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${getDirectusServerToken()}`,
    },
    cache: "no-store",
  });

  return readDirectusListResponse<ListingRelationRow>(response);
}

async function getListingRelationIds(
  listingId: string,
  config: ListingRelationConfig,
): Promise<string[]> {
  const rows = await getListingRelationRows(listingId, config);

  return rows
    .map((row) => relationId(row[config.referenceField]))
    .filter((id): id is string => Boolean(id));
}

async function validateReferenceIds(
  ids: string[],
  collection: ReferenceCollection,
): Promise<void> {
  if (ids.length === 0) {
    return;
  }

  const url = new URL(`/items/${collection}`, getDirectusUrl());
  url.searchParams.set("fields", "id");
  url.searchParams.set("limit", "-1");
  url.searchParams.set(
    "filter",
    JSON.stringify({
      id: {
        _in: ids,
      },
    }),
  );

  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${getDirectusServerToken()}`,
    },
    cache: "no-store",
  });
  const existingItems = await readDirectusListResponse<ReferenceItem>(response);
  const existingIds = new Set(existingItems.map((item) => String(item.id)));

  if (ids.some((id) => !existingIds.has(id))) {
    throw new DirectusAccountError(
      "Mindestens eine ausgewählte Verknüpfung ist ungültig.",
      400,
      "INVALID_RELATION",
    );
  }
}

async function syncListingRelations(
  listingId: string,
  desiredIds: string[],
  config: ListingRelationConfig,
): Promise<void> {
  const rows = await getListingRelationRows(listingId, config);
  const desiredIdSet = new Set(desiredIds);
  const existingReferenceIds = new Set<string>();
  const rowIdsToDelete: Array<string | number> = [];

  for (const row of rows) {
    const currentReferenceId = relationId(row[config.referenceField]);

    if (
      !currentReferenceId ||
      !desiredIdSet.has(currentReferenceId) ||
      existingReferenceIds.has(currentReferenceId)
    ) {
      rowIdsToDelete.push(row.id);
      continue;
    }

    existingReferenceIds.add(currentReferenceId);
  }

  const idsToCreate = desiredIds.filter(
    (referenceId) => !existingReferenceIds.has(referenceId),
  );
  const authorization = `Bearer ${getDirectusServerToken()}`;

  if (rowIdsToDelete.length > 0) {
    const deleteResponse = await fetch(
      new URL(`/items/${config.junctionCollection}`, getDirectusUrl()),
      {
        method: "DELETE",
        headers: {
          Authorization: authorization,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(rowIdsToDelete),
        cache: "no-store",
      },
    );

    await ensureDirectusMutationSucceeded(deleteResponse);
  }

  if (idsToCreate.length > 0) {
    const createResponse = await fetch(
      new URL(`/items/${config.junctionCollection}`, getDirectusUrl()),
      {
        method: "POST",
        headers: {
          Authorization: authorization,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(
          idsToCreate.map((referenceId) => ({
            listings_id: listingId,
            [config.referenceField]: referenceId,
          })),
        ),
        cache: "no-store",
      },
    );

    await ensureDirectusMutationSucceeded(createResponse);
  }
}

async function getOpenListingRevisions(
  listingId: string,
): Promise<ListingRevision[]> {
  const url = new URL("/items/listing_revisions", getDirectusUrl());

  url.searchParams.set(
    "fields",
    "id,listing,status,data,changed_fields,submitted_by,submitted_at",
  );
  url.searchParams.set("limit", "100");
  url.searchParams.set(
    "filter",
    JSON.stringify({
      _and: [
        { listing: { _eq: listingId } },
        { status: { _in: ["draft", "pending"] } },
      ],
    }),
  );

  const response = await fetch(url, {
    headers: directusServerHeaders(),
    cache: "no-store",
  });

  return readDirectusListResponse<ListingRevision>(response);
}

async function getCantonById(
  cantonId: string,
): Promise<{ id: string; code: string; name: string } | null> {
  const url = new URL(
    `/items/cantons/${encodeURIComponent(cantonId)}`,
    getDirectusUrl(),
  );
  url.searchParams.set("fields", "id,code,name");

  const response = await fetch(url, {
    headers: directusServerHeaders(),
    cache: "no-store",
  });

  if (response.status === 404) {
    return null;
  }

  return readDirectusItemResponse<{ id: string; code: string; name: string }>(
    response,
  );
}

async function mergeOpenRevisionIntoEditorData(
  editorData: EditableAccountListingEditorData,
): Promise<EditableAccountListingEditorData> {
  if (editorData.listing.status !== "published") {
    return editorData;
  }

  const revisions = await getOpenListingRevisions(editorData.listing.id);
  const revision =
    revisions.find((item) => item.status === "pending") ?? revisions[0];

  if (!revision?.data || typeof revision.data !== "object") {
    return editorData;
  }

  const canton = await getCantonById(revision.data.canton);

  if (!canton) {
    return editorData;
  }

  return {
    listing: {
      ...editorData.listing,
      ...revision.data,
      status: revision.status,
      canton,
    },
    industryIds: Array.isArray(revision.data.industry_ids)
      ? revision.data.industry_ids
      : editorData.industryIds,
    spokenLanguageIds: Array.isArray(revision.data.spoken_language_ids)
      ? revision.data.spoken_language_ids
      : editorData.spokenLanguageIds,
  };
}

function normalizedStringArray(values: string[]): string[] {
  return Array.from(new Set(values)).sort();
}

function valuesEqual(oldValue: unknown, newValue: unknown): boolean {
  return JSON.stringify(oldValue) === JSON.stringify(newValue);
}

function createChangedFields(
  listing: EditableAccountListing,
  currentIndustryIds: string[],
  currentSpokenLanguageIds: string[],
  values: ListingRevisionData,
): ListingRevisionChangedFields {
  const publishedValues: Record<string, unknown> = {
    name: listing.name,
    short_description: listing.short_description,
    description: listing.description,
    street: listing.street,
    postal_code: listing.postal_code,
    city: listing.city,
    canton: listing.canton?.id ?? null,
    public_email: listing.public_email,
    phone: listing.phone,
    website_url: listing.website_url,
    address_visibility: listing.address_visibility,
    industry_ids: normalizedStringArray(currentIndustryIds),
    spoken_language_ids: normalizedStringArray(currentSpokenLanguageIds),
  };
  const revisionValues: Record<string, unknown> = {
    ...values,
    industry_ids: normalizedStringArray(values.industry_ids),
    spoken_language_ids: normalizedStringArray(values.spoken_language_ids),
  };

  return Object.fromEntries(
    Object.entries(revisionValues)
      .filter(([field, newValue]) =>
        !valuesEqual(publishedValues[field], newValue),
      )
      .map(([field, newValue]) => [
        field,
        {
          old: publishedValues[field] ?? null,
          new: newValue ?? null,
        },
      ]),
  );
}

async function createListingRevision(
  listingId: string,
  values: ListingRevisionData,
  changedFields: ListingRevisionChangedFields,
  status: "draft" | "pending",
  submittedBy: string,
): Promise<ListingRevision> {
  const url = new URL("/items/listing_revisions", getDirectusUrl());
  url.searchParams.set(
    "fields",
    "id,listing,status,data,changed_fields,submitted_by,submitted_at",
  );

  const response = await fetch(url, {
    method: "POST",
    headers: {
      ...directusServerHeaders(),
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      listing: listingId,
      status,
      data: values,
      changed_fields: changedFields,
      submitted_by: submittedBy,
      submitted_at: status === "pending" ? new Date().toISOString() : null,
    }),
    cache: "no-store",
  });

  return readDirectusItemResponse<ListingRevision>(response);
}

async function updateListingRevision(
  revisionId: string,
  values: ListingRevisionData,
  changedFields: ListingRevisionChangedFields,
  status: "draft" | "pending",
  submittedBy: string,
): Promise<ListingRevision> {
  const url = new URL(
    `/items/listing_revisions/${encodeURIComponent(revisionId)}`,
    getDirectusUrl(),
  );
  url.searchParams.set(
    "fields",
    "id,listing,status,data,changed_fields,submitted_by,submitted_at",
  );

  const response = await fetch(url, {
    method: "PATCH",
    headers: {
      ...directusServerHeaders(),
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      status,
      data: values,
      changed_fields: changedFields,
      submitted_by: submittedBy,
      submitted_at: status === "pending" ? new Date().toISOString() : null,
    }),
    cache: "no-store",
  });

  return readDirectusItemResponse<ListingRevision>(response);
}

async function supersedeListingRevision(revisionId: string): Promise<void> {
  const response = await fetch(
    new URL(
      `/items/listing_revisions/${encodeURIComponent(revisionId)}`,
      getDirectusUrl(),
    ),
    {
      method: "PATCH",
      headers: {
        ...directusServerHeaders(),
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ status: "superseded" }),
      cache: "no-store",
    },
  );

  await ensureDirectusMutationSucceeded(response);
}

async function savePublishedListingRevision(
  listing: EditableAccountListing,
  values: AccountListingEditorUpdate,
  submittedBy: string,
): Promise<EditableAccountListing> {
  const revisionData: ListingRevisionData = {
    name: values.name,
    short_description: values.short_description,
    description: values.description,
    street: values.street,
    postal_code: values.postal_code,
    city: values.city,
    canton: values.canton,
    public_email: values.public_email,
    phone: values.phone,
    website_url: values.website_url,
    address_visibility: values.address_visibility,
    industry_ids: Array.from(new Set(values.industry_ids)),
    spoken_language_ids: Array.from(new Set(values.spoken_language_ids)),
  };
  const status = values.status;
  const [currentIndustryIds, currentSpokenLanguageIds, openRevisions] =
    await Promise.all([
      getListingRelationIds(listing.id, industryRelationConfig),
      getListingRelationIds(listing.id, spokenLanguageRelationConfig),
      getOpenListingRevisions(listing.id),
    ]);
  const changedFields = createChangedFields(
    listing,
    currentIndustryIds,
    currentSpokenLanguageIds,
    revisionData,
  );
  const currentRevision =
    openRevisions.find((revision) => revision.status === "pending") ??
    openRevisions[0];

  const shouldNotifyAdmin =
    status === "pending" && currentRevision?.status !== "pending";

  if (currentRevision) {
    await updateListingRevision(
      currentRevision.id,
      revisionData,
      changedFields,
      status,
      submittedBy,
    );

    await Promise.all(
      openRevisions
        .filter((revision) => revision.id !== currentRevision.id)
        .map((revision) => supersedeListingRevision(revision.id)),
    );
  } else {
    await createListingRevision(
      listing.id,
      revisionData,
      changedFields,
      status,
      submittedBy,
    );
  }

  if (shouldNotifyAdmin) {
    try {
      await sendListingReviewNotification({
        listingId: listing.id,
        listingName: revisionData.name,
        kind: "listing_revision",
        changedFields: Object.keys(changedFields),
      });
    } catch (error) {
      console.error("Admin-Benachrichtigung konnte nicht gesendet werden:", error);
    }
  }

  return {
    ...listing,
    ...revisionData,
    status,
    canton: listing.canton,
  };
}

export async function getEditableAccountListingEditorData(
  accessToken: string,
  listingId: string,
): Promise<EditableAccountListingEditorData | null> {
  const listing = await getEditableAccountListing(accessToken, listingId);

  if (!listing) {
    return null;
  }

  const [industryIds, spokenLanguageIds] = await Promise.all([
    getListingRelationIds(listingId, industryRelationConfig),
    getListingRelationIds(listingId, spokenLanguageRelationConfig),
  ]);

  return mergeOpenRevisionIntoEditorData({
    listing,
    industryIds,
    spokenLanguageIds,
  });
}

export async function getActiveAccountOrganizations(
  accessToken: string,
): Promise<AccountOrganization[]> {
  const memberships = await getOrganizationMemberships(accessToken);

  return Array.from(
    new Map(
      memberships
        .filter((membership) => membership.organization.status === "active")
        .map((membership) => [
          membership.organization.id,
          membership.organization,
        ]),
    ).values(),
  );
}

function slugifyListingName(name: string): string {
  const transliterated = name
    .replace(/ä/gi, "ae")
    .replace(/ö/gi, "oe")
    .replace(/ü/gi, "ue")
    .replace(/ß/g, "ss")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();

  return (
    transliterated
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 140)
      .replace(/-+$/g, "") || "unternehmen"
  );
}

type ListingSlugItem = {
  slug: string;
};

async function createUniqueListingSlug(name: string): Promise<string> {
  const baseSlug = slugifyListingName(name);
  const url = new URL("/items/listings", getDirectusUrl());

  url.searchParams.set("fields", "slug");
  url.searchParams.set("limit", "500");
  url.searchParams.set(
    "filter",
    JSON.stringify({
      slug: {
        _starts_with: baseSlug,
      },
    }),
  );

  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${getDirectusServerToken()}`,
    },
    cache: "no-store",
  });

  const existingSlugs = new Set(
    (await readDirectusListResponse<ListingSlugItem>(response)).map(
      (item) => item.slug,
    ),
  );

  if (!existingSlugs.has(baseSlug)) {
    return baseSlug;
  }

  for (let suffix = 2; suffix <= 9999; suffix += 1) {
    const candidate = `${baseSlug.slice(0, 135)}-${suffix}`;

    if (!existingSlugs.has(candidate)) {
      return candidate;
    }
  }

  return `${baseSlug.slice(0, 125)}-${crypto.randomUUID().slice(0, 8)}`;
}

export async function createAccountListing(
  accessToken: string,
  values: AccountListingCreate,
): Promise<EditableAccountListing> {
  const memberships = await getOrganizationMemberships(accessToken);
  const hasActiveMembership = memberships.some(
    (membership) =>
      membership.organization.id === values.organization &&
      membership.organization.status === "active",
  );

  if (!hasActiveMembership) {
    throw new DirectusAccountError(
      "Die Organisation gehört nicht zu einer aktiven Mitgliedschaft.",
      403,
      "FORBIDDEN",
    );
  }

  const slug = await createUniqueListingSlug(values.name);
  const url = new URL("/items/listings", getDirectusUrl());
  url.searchParams.set("fields", editableListingFields());

  const response = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      ...values,
      slug,
    }),
    cache: "no-store",
  });

  return readDirectusItemResponse<EditableAccountListing>(response);
}

export async function updateEditableAccountListing(
  accessToken: string,
  listingId: string,
  values: AccountListingEditorUpdate,
  submittedBy: string,
): Promise<EditableAccountListing> {
  const currentListing = await getEditableAccountListing(
    accessToken,
    listingId,
  );

  if (!currentListing) {
    throw new DirectusAccountError(
      "Firmenprofil nicht gefunden oder nicht freigegeben.",
      404,
      "FORBIDDEN",
    );
  }

  const uniqueIndustryIds = Array.from(new Set(values.industry_ids));
  const uniqueSpokenLanguageIds = Array.from(
    new Set(values.spoken_language_ids),
  );

  await Promise.all([
    validateReferenceIds(
      uniqueIndustryIds,
      industryRelationConfig.referenceCollection,
    ),
    validateReferenceIds(
      uniqueSpokenLanguageIds,
      spokenLanguageRelationConfig.referenceCollection,
    ),
  ]);

  if (currentListing.status === "published") {
    return savePublishedListingRevision(currentListing, values, submittedBy);
  }

  const safeListingValues: AccountListingUpdate = {
    name: values.name,
    short_description: values.short_description,
    description: values.description,
    street: values.street,
    postal_code: values.postal_code,
    city: values.city,
    canton: values.canton,
    public_email: values.public_email,
    phone: values.phone,
    website_url: values.website_url,
    address_visibility: values.address_visibility,
    status: values.status,
  };
  const url = new URL(
    `/items/listings/${encodeURIComponent(listingId)}`,
    getDirectusUrl(),
  );
  url.searchParams.set("fields", editableListingFields());

  const response = await fetch(url, {
    method: "PATCH",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(safeListingValues),
    cache: "no-store",
  });
  const updatedListing =
    await readDirectusItemResponse<EditableAccountListing>(response);

  await Promise.all([
    syncListingRelations(
      listingId,
      uniqueIndustryIds,
      industryRelationConfig,
    ),
    syncListingRelations(
      listingId,
      uniqueSpokenLanguageIds,
      spokenLanguageRelationConfig,
    ),
  ]);

  if (values.status === "pending" && currentListing.status !== "pending") {
    try {
      await sendListingReviewNotification({
        listingId,
        listingName: updatedListing.name,
        kind: "new_listing",
      });
    } catch (error) {
      console.error("Admin-Benachrichtigung konnte nicht gesendet werden:", error);
    }
  }

  return updatedListing;
}

export async function getAccountOrganizationOverview(
  accessToken: string,
): Promise<AccountOrganizationOverview[]> {
  const memberships = await getOrganizationMemberships(accessToken);

  const uniqueMemberships = Array.from(
    new Map(
      memberships.map((membership) => [
        membership.organization.id,
        membership,
      ]),
    ).values(),
  );

  const organizationIds = uniqueMemberships.map(
    (membership) => membership.organization.id,
  );
  const listings = await getListingsForOrganizations(
    accessToken,
    organizationIds,
  );

  return uniqueMemberships.map((membership) => ({
    ...membership,
    listings: listings.filter(
      (listing) => listing.organization?.id === membership.organization.id,
    ),
  }));
}
