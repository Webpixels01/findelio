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
  requested_billing_interval: "monthly" | "yearly" | null;
  organization: {
    id: string;
  };
};

export type AccountSubscription = {
  id: string;
  listing: string | { id: string } | null;
  status: string;
  plan: string;
  billing_interval: "monthly" | "yearly";
  current_period_start: string | null;
  current_period_end: string | null;
  cancel_at_period_end: boolean;
  cancelled_at: string | null;
  amount_minor: number;
  currency: string;
};

export type AccountListingOverview = AccountListing & {
  subscription: AccountSubscription | null;
};

export type EditableAccountListing = AccountListing & {
  description: string | null;
  description_translations: Record<string, string> | null;
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
  logo: string | null;
  gallery: AccountGalleryItem[];
  social_links: AccountSocialLink[] | null;
  custom_cta_label: string | null;
  custom_cta_value: string | null;
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
  description: string | null;
  street: string | null;
  postal_code: string;
  city: string;
  canton: string;
  public_email: string | null;
  phone: string | null;
  website_url: string | null;
  address_visibility: "full" | "city" | "hidden";
  requested_billing_interval: "monthly" | "yearly" | null;
};

export type AccountListingUpdate = {
  name: string;
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
  premium?: AccountPremiumListingUpdate;
};

export type AccountSocialLink = {
  platform: "instagram" | "facebook" | "linkedin" | "tiktok" | "youtube" | "x";
  url: string;
};

export type AccountOpeningHour = {
  id?: string;
  day_of_week: number;
  opens_at: string;
  closes_at: string;
};

export type AccountGalleryItem = {
  id: string | number;
  directus_files_id: string;
};

export type AccountPremiumListingUpdate = {
  logo_id: string | null;
  gallery_file_ids: string[];
  social_links: AccountSocialLink[];
  opening_hours: AccountOpeningHour[];
  custom_cta_label: string | null;
  custom_cta_value: string | null;
  description_translations: Record<string, string>;
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
  logo_id?: string | null;
  gallery_file_ids?: string[];
  social_links?: AccountSocialLink[];
  opening_hours?: AccountOpeningHour[];
  custom_cta_label?: string | null;
  custom_cta_value?: string | null;
  description_translations?: Record<string, string>;
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
  openingHours: AccountOpeningHour[];
  premiumEnabled: boolean;
};

export type AccountOrganizationOverview = AccountMembership & {
  listings: AccountListingOverview[];
};

export type AccountListingBillingData = {
  listing: EditableAccountListing;
  subscription: AccountSubscription | null;
  premiumEnabled: boolean;
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

function isActivePremiumSubscription(
  subscription: AccountSubscription,
): boolean {
  if (
    !["active", "past_due"].includes(subscription.status) ||
    subscription.plan !== "premium"
  ) {
    return false;
  }

  if (!subscription.current_period_end) {
    return true;
  }

  const periodEnd = new Date(subscription.current_period_end);
  return !Number.isNaN(periodEnd.getTime()) && periodEnd > new Date();
}

async function hasActivePremiumSubscription(
  accessToken: string,
  listingId: string,
): Promise<boolean> {
  const url = new URL("/items/subscriptions", getDirectusUrl());

  url.searchParams.set(
    "fields",
    "id,listing,status,plan,billing_interval,current_period_start,current_period_end,cancel_at_period_end,cancelled_at,amount_minor,currency",
  );
  url.searchParams.set("limit", "20");
  url.searchParams.set(
    "filter",
    JSON.stringify({
      listing: {
        _eq: listingId,
      },
    }),
  );

  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
    cache: "no-store",
  });
  const subscriptions =
    await readDirectusListResponse<AccountSubscription>(response);

  return subscriptions.some(isActivePremiumSubscription);
}

async function hasPremiumEditingAccess(
  accessToken: string,
  listing: Pick<
    EditableAccountListing,
    "id" | "status" | "requested_billing_interval"
  >,
): Promise<boolean> {
  if (
    listing.requested_billing_interval &&
    ["draft", "pending"].includes(listing.status)
  ) {
    return true;
  }

  return hasActivePremiumSubscription(accessToken, listing.id);
}

function subscriptionListingId(
  subscription: AccountSubscription,
): string | null {
  if (typeof subscription.listing === "string") {
    return subscription.listing;
  }

  return subscription.listing?.id ?? null;
}

function selectCurrentSubscription(
  subscriptions: AccountSubscription[],
): AccountSubscription | null {
  const sortedSubscriptions = [...subscriptions].sort((left, right) => {
    const leftEnd = left.current_period_end
      ? new Date(left.current_period_end).getTime()
      : Number.MAX_SAFE_INTEGER;
    const rightEnd = right.current_period_end
      ? new Date(right.current_period_end).getTime()
      : Number.MAX_SAFE_INTEGER;

    return rightEnd - leftEnd;
  });

  return (
    sortedSubscriptions.find(isActivePremiumSubscription) ??
    sortedSubscriptions[0] ??
    null
  );
}

async function getAccountSubscriptions(
  accessToken: string,
  organizationIds: string[],
): Promise<AccountSubscription[]> {
  if (organizationIds.length === 0) {
    return [];
  }

  const url = new URL("/items/subscriptions", getDirectusUrl());

  url.searchParams.set(
    "fields",
    "id,listing,status,plan,billing_interval,current_period_start,current_period_end,cancel_at_period_end,cancelled_at,amount_minor,currency",
  );
  url.searchParams.set("limit", "500");
  url.searchParams.set(
    "filter",
    JSON.stringify({
      organization: {
        _in: organizationIds,
      },
    }),
  );

  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
    cache: "no-store",
  });

  return readDirectusListResponse<AccountSubscription>(response);
}

export async function getAccountListingBillingData(
  accessToken: string,
  listingId: string,
): Promise<AccountListingBillingData | null> {
  const listing = await getEditableAccountListing(accessToken, listingId);

  if (!listing) {
    return null;
  }

  const subscriptions = await getAccountSubscriptions(accessToken, [
    listing.organization.id,
  ]);
  const subscription = selectCurrentSubscription(
    subscriptions.filter(
      (item) => subscriptionListingId(item) === listing.id,
    ),
  );

  return {
    listing,
    subscription,
    premiumEnabled: subscription
      ? isActivePremiumSubscription(subscription)
      : false,
  };
}

async function getAccountListingOpeningHours(
  listingId: string,
): Promise<AccountOpeningHour[]> {
  const url = new URL("/items/listing_opening_hours", getDirectusUrl());

  url.searchParams.set("fields", "id,day_of_week,opens_at,closes_at");
  url.searchParams.set("sort", "day_of_week,opens_at");
  url.searchParams.set("limit", "-1");
  url.searchParams.set(
    "filter",
    JSON.stringify({
      listing: {
        _eq: listingId,
      },
    }),
  );

  const response = await fetch(url, {
    headers: directusServerHeaders(),
    cache: "no-store",
  });

  return readDirectusListResponse<AccountOpeningHour>(response);
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
      "requested_billing_interval",
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
    "description",
    "description_translations",
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
    "logo",
    "social_links",
    "custom_cta_label",
    "custom_cta_value",
    "address_visibility",
    "verification_status",
    "requested_billing_interval",
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

  const gallery = await getAccountListingGallery(rawListing.id);

  return {
    ...rawListing,
    canton,
    gallery,
    social_links: Array.isArray(rawListing.social_links)
      ? rawListing.social_links
      : [],
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

type GalleryRelationRow = {
  id: string | number;
  directus_files_id: string | { id: string } | null;
};

async function getAccountListingGallery(
  listingId: string,
): Promise<AccountGalleryItem[]> {
  const url = new URL("/items/listings_files", getDirectusUrl());
  url.searchParams.set("fields", "id,directus_files_id");
  url.searchParams.set("sort", "id");
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
    headers: directusServerHeaders(),
    cache: "no-store",
  });
  const rows = await readDirectusListResponse<GalleryRelationRow>(response);

  return rows
    .map((row) => ({
      id: row.id,
      directus_files_id: relationId(row.directus_files_id),
    }))
    .filter(
      (
        item,
      ): item is {
        id: string | number;
        directus_files_id: string;
      } => Boolean(item.directus_files_id),
    );
}

type OpeningHourRow = AccountOpeningHour & {
  id: string;
};

async function syncListingGallery(
  listingId: string,
  desiredFileIds: string[],
): Promise<void> {
  const url = new URL("/items/listings_files", getDirectusUrl());
  url.searchParams.set("fields", "id,directus_files_id");
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
    headers: directusServerHeaders(),
    cache: "no-store",
  });
  const rows = await readDirectusListResponse<GalleryRelationRow>(response);
  const desiredIds = Array.from(new Set(desiredFileIds));
  const desiredIdSet = new Set(desiredIds);
  const existingIds = new Set<string>();
  const rowIdsToDelete: Array<string | number> = [];

  for (const row of rows) {
    const fileId = relationId(row.directus_files_id);

    if (
      !fileId ||
      !desiredIdSet.has(fileId) ||
      existingIds.has(fileId)
    ) {
      rowIdsToDelete.push(row.id);
      continue;
    }

    existingIds.add(fileId);
  }

  if (rowIdsToDelete.length > 0) {
    const deleteResponse = await fetch(
      new URL("/items/listings_files", getDirectusUrl()),
      {
        method: "DELETE",
        headers: {
          ...directusServerHeaders(),
          "Content-Type": "application/json",
        },
        body: JSON.stringify(rowIdsToDelete),
        cache: "no-store",
      },
    );

    await ensureDirectusMutationSucceeded(deleteResponse);
  }

  const idsToCreate = desiredIds.filter((id) => !existingIds.has(id));

  if (idsToCreate.length > 0) {
    const createResponse = await fetch(
      new URL("/items/listings_files", getDirectusUrl()),
      {
        method: "POST",
        headers: {
          ...directusServerHeaders(),
          "Content-Type": "application/json",
        },
        body: JSON.stringify(
          idsToCreate.map((fileId) => ({
            listings_id: listingId,
            directus_files_id: fileId,
          })),
        ),
        cache: "no-store",
      },
    );

    await ensureDirectusMutationSucceeded(createResponse);
  }
}

function openingHourKey(value: AccountOpeningHour): string {
  return `${value.day_of_week}:${value.opens_at.slice(0, 5)}:${value.closes_at.slice(0, 5)}`;
}

async function syncListingOpeningHours(
  listingId: string,
  desiredOpeningHours: AccountOpeningHour[],
): Promise<void> {
  const url = new URL("/items/listing_opening_hours", getDirectusUrl());
  url.searchParams.set("fields", "id,day_of_week,opens_at,closes_at");
  url.searchParams.set("limit", "-1");
  url.searchParams.set(
    "filter",
    JSON.stringify({
      listing: {
        _eq: listingId,
      },
    }),
  );

  const response = await fetch(url, {
    headers: directusServerHeaders(),
    cache: "no-store",
  });
  const rows = await readDirectusListResponse<OpeningHourRow>(response);
  const desiredByKey = new Map(
    desiredOpeningHours.map((item) => [openingHourKey(item), item]),
  );
  const existingKeys = new Set<string>();
  const rowIdsToDelete: string[] = [];

  for (const row of rows) {
    const key = openingHourKey(row);

    if (!desiredByKey.has(key) || existingKeys.has(key)) {
      rowIdsToDelete.push(row.id);
      continue;
    }

    existingKeys.add(key);
  }

  if (rowIdsToDelete.length > 0) {
    const deleteResponse = await fetch(
      new URL("/items/listing_opening_hours", getDirectusUrl()),
      {
        method: "DELETE",
        headers: {
          ...directusServerHeaders(),
          "Content-Type": "application/json",
        },
        body: JSON.stringify(rowIdsToDelete),
        cache: "no-store",
      },
    );

    await ensureDirectusMutationSucceeded(deleteResponse);
  }

  const valuesToCreate = Array.from(desiredByKey.entries())
    .filter(([key]) => !existingKeys.has(key))
    .map(([, value]) => ({
      listing: listingId,
      day_of_week: value.day_of_week,
      opens_at: value.opens_at,
      closes_at: value.closes_at,
    }));

  if (valuesToCreate.length > 0) {
    const createResponse = await fetch(
      new URL("/items/listing_opening_hours", getDirectusUrl()),
      {
        method: "POST",
        headers: {
          ...directusServerHeaders(),
          "Content-Type": "application/json",
        },
        body: JSON.stringify(valuesToCreate),
        cache: "no-store",
      },
    );

    await ensureDirectusMutationSucceeded(createResponse);
  }
}

type DirectusFileMetadata = {
  id: string;
  type: string | null;
  folder: string | null;
  uploaded_by: string | null;
};

async function getPublicFolderId(): Promise<string> {
  const url = new URL("/folders", getDirectusUrl());
  url.searchParams.set("fields", "id,name");
  url.searchParams.set("limit", "1");
  url.searchParams.set(
    "filter",
    JSON.stringify({
      name: {
        _eq: "Public",
      },
    }),
  );

  const response = await fetch(url, {
    headers: directusServerHeaders(),
    cache: "no-store",
  });
  const folders = await readDirectusListResponse<{
    id: string;
    name: string;
  }>(response);
  const folderId = folders[0]?.id;

  if (!folderId) {
    throw new DirectusAccountError(
      "Der öffentliche Dateiordner ist nicht konfiguriert.",
      500,
      "UPLOAD_FOLDER_MISSING",
    );
  }

  return folderId;
}

async function validatePremiumFileIds(
  listing: EditableAccountListing,
  fileIds: string[],
  currentUserId: string,
): Promise<void> {
  const uniqueIds = Array.from(new Set(fileIds));

  if (uniqueIds.length === 0) {
    return;
  }

  const existingListingFileIds = new Set([
    ...(listing.logo ? [listing.logo] : []),
    ...listing.gallery.map((item) => item.directus_files_id),
  ]);
  const openRevisions = await getOpenListingRevisions(listing.id);

  for (const revision of openRevisions) {
    if (revision.data.logo_id) {
      existingListingFileIds.add(revision.data.logo_id);
    }

    for (const fileId of revision.data.gallery_file_ids ?? []) {
      existingListingFileIds.add(fileId);
    }
  }

  const url = new URL("/files", getDirectusUrl());
  url.searchParams.set("fields", "id,type,folder,uploaded_by");
  url.searchParams.set("limit", "-1");
  url.searchParams.set(
    "filter",
    JSON.stringify({
      id: {
        _in: uniqueIds,
      },
    }),
  );

  const response = await fetch(url, {
    headers: directusServerHeaders(),
    cache: "no-store",
  });
  const files = await readDirectusListResponse<DirectusFileMetadata>(response);
  const filesById = new Map(files.map((file) => [file.id, file]));
  const publicFolderId = await getPublicFolderId();

  for (const fileId of uniqueIds) {
    const file = filesById.get(fileId);

    if (
      !file ||
      !file.type?.startsWith("image/") ||
      (!existingListingFileIds.has(fileId) &&
        (file.uploaded_by !== currentUserId ||
          file.folder !== publicFolderId))
    ) {
      throw new DirectusAccountError(
        "Eine ausgewählte Bilddatei ist nicht freigegeben.",
        400,
        "INVALID_FILE",
      );
    }
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

  const {
    logo_id: logoId,
    gallery_file_ids: galleryFileIds,
    social_links: socialLinks,
    opening_hours: openingHours,
    ...baseRevisionData
  } = revision.data;

  return {
    listing: {
      ...editorData.listing,
      ...baseRevisionData,
      status: revision.status,
      canton,
      logo: logoId === undefined ? editorData.listing.logo : logoId,
      gallery: Array.isArray(galleryFileIds)
        ? galleryFileIds.map((fileId, index) => ({
            id: `revision-${index}`,
            directus_files_id: fileId,
          }))
        : editorData.listing.gallery,
    social_links: Array.isArray(socialLinks)
        ? socialLinks
        : editorData.listing.social_links,
      custom_cta_label:
        revision.data.custom_cta_label === undefined
          ? editorData.listing.custom_cta_label
          : revision.data.custom_cta_label,
      custom_cta_value:
        revision.data.custom_cta_value === undefined
          ? editorData.listing.custom_cta_value
          : revision.data.custom_cta_value,
    },
    industryIds: Array.isArray(revision.data.industry_ids)
      ? revision.data.industry_ids
      : editorData.industryIds,
    spokenLanguageIds: Array.isArray(revision.data.spoken_language_ids)
      ? revision.data.spoken_language_ids
      : editorData.spokenLanguageIds,
    openingHours: Array.isArray(openingHours)
      ? openingHours
      : editorData.openingHours,
    premiumEnabled: editorData.premiumEnabled,
  };
}

function normalizedStringArray(values: string[]): string[] {
  return Array.from(new Set(values)).sort();
}

function normalizedOpeningHours(
  values: AccountOpeningHour[],
): AccountOpeningHour[] {
  return values
    .map(({ day_of_week, opens_at, closes_at }) => ({
      day_of_week,
      opens_at: opens_at.slice(0, 5),
      closes_at: closes_at.slice(0, 5),
    }))
    .sort(
      (first, second) =>
        first.day_of_week - second.day_of_week ||
        first.opens_at.localeCompare(second.opens_at) ||
        first.closes_at.localeCompare(second.closes_at),
    );
}

function valuesEqual(oldValue: unknown, newValue: unknown): boolean {
  return JSON.stringify(oldValue) === JSON.stringify(newValue);
}

function shouldNotifyAdminAboutRevision(
  status: "draft" | "pending",
  currentRevision: ListingRevision | undefined,
  revisionData: ListingRevisionData,
): boolean {
  return (
    status === "pending" &&
    (currentRevision?.status !== "pending" ||
      !valuesEqual(currentRevision.data, revisionData))
  );
}

function createChangedFields(
  listing: EditableAccountListing,
  currentIndustryIds: string[],
  currentSpokenLanguageIds: string[],
  currentOpeningHours: AccountOpeningHour[],
  values: ListingRevisionData,
): ListingRevisionChangedFields {
  const publishedValues: Record<string, unknown> = {
    name: listing.name,
    description: listing.description,
    description_translations: listing.description_translations ?? {},
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
    logo_id: listing.logo,
    gallery_file_ids: listing.gallery.map(
      (item) => item.directus_files_id,
    ),
    social_links: listing.social_links ?? [],
    custom_cta_label: listing.custom_cta_label,
    custom_cta_value: listing.custom_cta_value,
    opening_hours: normalizedOpeningHours(currentOpeningHours),
  };
  const revisionValues: Record<string, unknown> = {
    ...values,
    industry_ids: normalizedStringArray(values.industry_ids),
    spoken_language_ids: normalizedStringArray(values.spoken_language_ids),
    ...(values.gallery_file_ids
      ? {
          gallery_file_ids: values.gallery_file_ids,
        }
      : {}),
    ...(values.opening_hours
      ? {
          opening_hours: normalizedOpeningHours(values.opening_hours),
        }
      : {}),
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
  accessToken: string,
  listing: EditableAccountListing,
  values: AccountListingEditorUpdate,
  submittedBy: string,
): Promise<EditableAccountListing> {
  const revisionData: ListingRevisionData = {
    name: values.name,
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
    ...(values.premium
      ? {
          logo_id: values.premium.logo_id,
          gallery_file_ids: values.premium.gallery_file_ids,
          social_links: values.premium.social_links,
          opening_hours: values.premium.opening_hours,
          custom_cta_label: values.premium.custom_cta_label,
          custom_cta_value: values.premium.custom_cta_value,
          description_translations:
            values.premium.description_translations,
        }
      : {}),
  };
  const status = values.status;
  const [
    currentIndustryIds,
    currentSpokenLanguageIds,
    currentOpeningHours,
    openRevisions,
  ] =
    await Promise.all([
      getListingRelationIds(listing.id, industryRelationConfig),
      getListingRelationIds(listing.id, spokenLanguageRelationConfig),
      getAccountListingOpeningHours(listing.id),
      getOpenListingRevisions(listing.id),
    ]);
  const changedFields = createChangedFields(
    listing,
    currentIndustryIds,
    currentSpokenLanguageIds,
    currentOpeningHours,
    revisionData,
  );
  const currentRevision =
    openRevisions.find((revision) => revision.status === "pending") ??
    openRevisions[0];

  const shouldNotifyAdmin = shouldNotifyAdminAboutRevision(
    status,
    currentRevision,
    revisionData,
  );

  let savedRevision: ListingRevision;

  if (currentRevision) {
    savedRevision = await updateListingRevision(
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
    savedRevision = await createListingRevision(
      listing.id,
      revisionData,
      changedFields,
      status,
      submittedBy,
    );
  }

  if (shouldNotifyAdmin) {
    try {
      await sendListingReviewNotification(accessToken, {
        listingId: listing.id,
        revisionId: savedRevision.id,
        kind: "listing_revision",
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

  const [industryIds, spokenLanguageIds, openingHours, premiumEnabled] =
    await Promise.all([
      getListingRelationIds(listingId, industryRelationConfig),
      getListingRelationIds(listingId, spokenLanguageRelationConfig),
      getAccountListingOpeningHours(listingId),
      hasPremiumEditingAccess(accessToken, listing),
    ]);

  return mergeOpenRevisionIntoEditorData({
    listing,
    industryIds,
    spokenLanguageIds,
    openingHours,
    premiumEnabled,
  });
}

export type UploadedAccountImage = {
  id: string;
  assetUrl: string;
};

const supportedImageTypes = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
]);
const maximumImageSize = 8 * 1024 * 1024;

export async function uploadAccountListingImages(
  accessToken: string,
  listingId: string,
  files: File[],
  currentUserId: string,
): Promise<UploadedAccountImage[]> {
  if (files.length === 0 || files.length > 10) {
    throw new DirectusAccountError(
      "Es wurden zu viele Dateien ausgewählt.",
      400,
      "TOO_MANY_FILES",
    );
  }

  for (const file of files) {
    if (!supportedImageTypes.has(file.type)) {
      throw new DirectusAccountError(
        "Die Datei ist kein unterstütztes Bild.",
        400,
        "INVALID_IMAGE",
      );
    }

    if (file.size > maximumImageSize) {
      throw new DirectusAccountError(
        "Die Bilddatei ist zu gross.",
        413,
        "FILE_TOO_LARGE",
      );
    }
  }

  const listing = await getEditableAccountListing(accessToken, listingId);

  if (!listing) {
    throw new DirectusAccountError(
      "Firmenprofil nicht gefunden oder nicht freigegeben.",
      404,
      "FORBIDDEN",
    );
  }

  const premiumEnabled = await hasPremiumEditingAccess(accessToken, listing);

  if (!premiumEnabled) {
    throw new DirectusAccountError(
      "Für Bild-Uploads ist ein aktives Premium-Abo erforderlich.",
      403,
      "PREMIUM_REQUIRED",
    );
  }

  const folderId = await getPublicFolderId();
  const uploadedImages: UploadedAccountImage[] = [];

  for (const file of files) {
    const formData = new FormData();
    formData.append("folder", folderId);
    formData.append("uploaded_by", currentUserId);
    formData.append(
      "title",
      `${listing.name} – ${file.name}`.slice(0, 240),
    );
    formData.append("file", file, file.name);

    const uploadUrl = new URL("/files", getDirectusUrl());
    uploadUrl.searchParams.set("fields", "id");

    const response = await fetch(uploadUrl, {
      method: "POST",
      headers: directusServerHeaders(),
      body: formData,
      cache: "no-store",
    });
    const uploadedFile =
      await readDirectusItemResponse<DirectusFileMetadata>(response);

    uploadedImages.push({
      id: uploadedFile.id,
      assetUrl: new URL(
        `/assets/${encodeURIComponent(uploadedFile.id)}`,
        getDirectusUrl(),
      ).toString(),
    });
  }

  return uploadedImages;
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

export async function hasActiveAccountMembership(
  accessToken: string,
): Promise<boolean> {
  const memberships = await getOrganizationMemberships(accessToken);
  return memberships.length > 0;
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

export async function createAccountOrganization(
  accessToken: string,
  name: string,
): Promise<AccountOrganization> {
  const memberships = await getOrganizationMemberships(accessToken);

  if (memberships.length > 0) {
    throw new DirectusAccountError(
      "Das Firmenkonto ist bereits einer Organisation zugeordnet.",
      409,
      "ALREADY_CONFIGURED",
    );
  }

  const url = new URL("/findelio-account-setup", getDirectusUrl());

  const response = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ name }),
    cache: "no-store",
  });

  return readDirectusItemResponse<AccountOrganization>(response);
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

  if (values.premium) {
    const premiumEnabled = await hasPremiumEditingAccess(
      accessToken,
      currentListing,
    );

    if (!premiumEnabled) {
      throw new DirectusAccountError(
        "Für diese Änderungen ist ein aktives Premium-Abo erforderlich.",
        403,
        "PREMIUM_REQUIRED",
      );
    }

    await validatePremiumFileIds(
      currentListing,
      [
        ...(values.premium.logo_id ? [values.premium.logo_id] : []),
        ...values.premium.gallery_file_ids,
      ],
      submittedBy,
    );
  }

  if (currentListing.status === "published") {
    return savePublishedListingRevision(
      accessToken,
      currentListing,
      values,
      submittedBy,
    );
  }

  const safeListingValues: AccountListingUpdate & {
    logo?: string | null;
    social_links?: AccountSocialLink[];
    custom_cta_label?: string | null;
    custom_cta_value?: string | null;
    description_translations?: Record<string, string>;
  } = {
    name: values.name,
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
    ...(values.premium
      ? {
          logo: values.premium.logo_id,
          social_links: values.premium.social_links,
          custom_cta_label: values.premium.custom_cta_label,
          custom_cta_value: values.premium.custom_cta_value,
          description_translations:
            values.premium.description_translations,
        }
      : {}),
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
    ...(values.premium
      ? [
          syncListingGallery(
            listingId,
            values.premium.gallery_file_ids,
          ),
          syncListingOpeningHours(
            listingId,
            values.premium.opening_hours,
          ),
        ]
      : []),
  ]);

  const openRevisions = await getOpenListingRevisions(listingId);
  const currentRevision =
    openRevisions.find((revision) => revision.status === "pending") ??
    openRevisions[0];

  if (values.status === "pending" || currentRevision) {
    const revisionData: ListingRevisionData = {
      name: values.name,
      description: values.description,
      street: values.street,
      postal_code: values.postal_code,
      city: values.city,
      canton: values.canton,
      public_email: values.public_email,
      phone: values.phone,
      website_url: values.website_url,
      address_visibility: values.address_visibility,
      industry_ids: uniqueIndustryIds,
      spoken_language_ids: uniqueSpokenLanguageIds,
      ...(values.premium
        ? {
            logo_id: values.premium.logo_id,
            gallery_file_ids: values.premium.gallery_file_ids,
            social_links: values.premium.social_links,
            opening_hours: values.premium.opening_hours,
            custom_cta_label: values.premium.custom_cta_label,
            custom_cta_value: values.premium.custom_cta_value,
            description_translations:
              values.premium.description_translations,
          }
        : {}),
    };
    const changedFields: ListingRevisionChangedFields = Object.fromEntries(
      Object.entries(revisionData).map(([field, newValue]) => [
        field,
        { old: null, new: newValue ?? null },
      ]),
    );
    const shouldNotifyAdmin = shouldNotifyAdminAboutRevision(
      values.status,
      currentRevision,
      revisionData,
    );
    let savedRevision: ListingRevision;

    if (currentRevision) {
      savedRevision = await updateListingRevision(
        currentRevision.id,
        revisionData,
        changedFields,
        values.status,
        submittedBy,
      );

      await Promise.all(
        openRevisions
          .filter((revision) => revision.id !== currentRevision.id)
          .map((revision) => supersedeListingRevision(revision.id)),
      );
    } else {
      savedRevision = await createListingRevision(
        listingId,
        revisionData,
        changedFields,
        values.status,
        submittedBy,
      );
    }

    if (shouldNotifyAdmin) {
      try {
        await sendListingReviewNotification(accessToken, {
          listingId,
          revisionId: savedRevision.id,
          kind: "new_listing",
        });
      } catch (error) {
        console.error(
          "Admin-Benachrichtigung konnte nicht gesendet werden:",
          error,
        );
      }
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
  const subscriptions = await getAccountSubscriptions(
    accessToken,
    organizationIds,
  );

  return uniqueMemberships.map((membership) => ({
    ...membership,
    listings: listings
      .filter(
        (listing) => listing.organization?.id === membership.organization.id,
      )
      .map((listing) => ({
        ...listing,
        subscription: selectCurrentSubscription(
          subscriptions.filter(
            (subscription) =>
              subscriptionListingId(subscription) === listing.id,
          ),
        ),
      })),
  }));
}
