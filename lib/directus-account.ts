import "server-only";

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
    code: string;
    name: string;
  } | null;
  public_email: string | null;
  phone: string | null;
  website_url: string | null;
  address_visibility: "full" | "city" | "hidden" | null;
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

  const listing = await readDirectusItemResponse<EditableAccountListing>(
    response,
  );

  if (!activeOrganizationIds.has(listing.organization?.id)) {
    return null;
  }

  return listing;
}

export async function updateEditableAccountListing(
  accessToken: string,
  listingId: string,
  values: AccountListingUpdate,
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
    body: JSON.stringify(values),
    cache: "no-store",
  });

  return readDirectusItemResponse<EditableAccountListing>(response);
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
