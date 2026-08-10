import "server-only";

export type PremiumGrant = {
  id: string;
  listing: string | { id: string };
  granted_by: string | { id: string } | null;
  reason: string;
  starts_at: string;
  ends_at: string | null;
  revoked_at: string | null;
  revoked_by: string | { id: string } | null;
  date_created: string;
  date_updated: string;
};

export type AdminPremiumListing = {
  id: string;
  name: string;
  slug: string;
  status: string;
  organization: { id: string; name: string } | null;
  grants: PremiumGrant[];
};

type DirectusResponse<T> = {
  data?: T;
  errors?: Array<{ message?: string }>;
};

function getDirectusUrl(): string {
  const value = process.env.DIRECTUS_URL?.trim();
  if (!value) throw new Error("DIRECTUS_URL fehlt in der Laufzeitumgebung");
  return value;
}

function getServerHeaders(): HeadersInit {
  const token = process.env.DIRECTUS_TOKEN?.trim();
  if (!token) throw new Error("DIRECTUS_TOKEN fehlt in der Laufzeitumgebung");
  return { Authorization: `Bearer ${token}` };
}

function listingId(value: PremiumGrant["listing"]): string {
  return typeof value === "string" ? value : value.id;
}

function isActiveGrant(grant: PremiumGrant, now = new Date()): boolean {
  if (grant.revoked_at) return false;

  const startsAt = new Date(grant.starts_at);
  if (Number.isNaN(startsAt.getTime()) || startsAt > now) return false;

  if (!grant.ends_at) return true;
  const endsAt = new Date(grant.ends_at);
  return !Number.isNaN(endsAt.getTime()) && endsAt > now;
}

async function read<T>(response: Response): Promise<T> {
  let result: DirectusResponse<T> | null = null;
  try {
    result = (await response.json()) as DirectusResponse<T>;
  } catch {
    result = null;
  }

  if (!response.ok || result?.data === undefined) {
    throw new Error(result?.errors?.[0]?.message ?? "Directus-Anfrage fehlgeschlagen.");
  }

  return result.data;
}

export async function getPremiumGrants(): Promise<PremiumGrant[]> {
  const url = new URL("/items/premium_grants", getDirectusUrl());
  url.searchParams.set(
    "fields",
    "id,listing,granted_by,reason,starts_at,ends_at,revoked_at,revoked_by,date_created,date_updated",
  );
  url.searchParams.set("limit", "-1");
  url.searchParams.set("sort", "-date_created");

  const response = await fetch(url, {
    headers: getServerHeaders(),
    cache: "no-store",
  });
  return read<PremiumGrant[]>(response);
}

export async function getActivePremiumGrantListingIds(): Promise<Set<string>> {
  let grants: PremiumGrant[];
  try {
    grants = await getPremiumGrants();
  } catch (error) {
    console.warn("Premium-Freischaltungen konnten nicht geprüft werden:", error);
    return new Set();
  }
  const now = new Date();
  return new Set(
    grants
      .filter((grant) => isActiveGrant(grant, now))
      .map((grant) => listingId(grant.listing)),
  );
}

export async function getActivePremiumGrant(
  listingIdValue: string,
): Promise<PremiumGrant | null> {
  let grants: PremiumGrant[];
  try {
    grants = await getPremiumGrants();
  } catch (error) {
    console.warn("Premium-Freischaltung konnte nicht geprüft werden:", error);
    return null;
  }
  return (
    grants
      .filter((grant) => listingId(grant.listing) === listingIdValue)
      .find((grant) => isActiveGrant(grant)) ?? null
  );
}

export async function getAdminPremiumListings(): Promise<AdminPremiumListing[]> {
  const [listings, grants] = await Promise.all([
    (async () => {
      const url = new URL("/items/listings", getDirectusUrl());
      url.searchParams.set("fields", "id,name,slug,status,organization.id,organization.name");
      url.searchParams.set("limit", "-1");
      url.searchParams.set("sort", "organization.name,name");
      const response = await fetch(url, {
        headers: getServerHeaders(),
        cache: "no-store",
      });
      return read<Array<Omit<AdminPremiumListing, "grants">>>(response);
    })(),
    getPremiumGrants(),
  ]);

  return listings.map((listing) => ({
    ...listing,
    grants: grants.filter((grant) => listingId(grant.listing) === listing.id),
  }));
}

export async function createPremiumGrant({
  listing,
  grantedBy,
  reason,
  endsAt,
}: {
  listing: string;
  grantedBy: string;
  reason: string;
  endsAt: string | null;
}): Promise<PremiumGrant> {
  const response = await fetch(new URL("/items/premium_grants", getDirectusUrl()), {
    method: "POST",
    headers: { ...getServerHeaders(), "Content-Type": "application/json" },
    body: JSON.stringify({
      listing,
      granted_by: grantedBy,
      reason,
      starts_at: new Date().toISOString(),
      ends_at: endsAt,
    }),
    cache: "no-store",
  });
  return read<PremiumGrant>(response);
}

export async function revokePremiumGrant({
  grantId,
  revokedBy,
}: {
  grantId: string;
  revokedBy: string;
}): Promise<PremiumGrant> {
  const response = await fetch(
    new URL(`/items/premium_grants/${encodeURIComponent(grantId)}`, getDirectusUrl()),
    {
      method: "PATCH",
      headers: { ...getServerHeaders(), "Content-Type": "application/json" },
      body: JSON.stringify({
        revoked_at: new Date().toISOString(),
        revoked_by: revokedBy,
      }),
      cache: "no-store",
    },
  );
  return read<PremiumGrant>(response);
}

export function isPremiumGrantActive(grant: PremiumGrant): boolean {
  return isActiveGrant(grant);
}
