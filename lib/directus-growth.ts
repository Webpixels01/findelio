import "server-only";

import {
  DirectusAccountError,
  getAccountListingBillingData,
} from "@/lib/directus-account";

export type ListingPostStatus = "draft" | "pending" | "published" | "rejected" | "archived";
export type AccountListingPost = {
  id: string;
  listing: string | { id: string; name?: string };
  type: "update" | "offer" | "event";
  status: ListingPostStatus;
  title: string;
  body: string | null;
  image: string | null;
  cta_label: string | null;
  cta_url: string | null;
  starts_at: string | null;
  ends_at: string | null;
  submitted_by?: string | { id: string; email?: string } | null;
  submitted_at: string | null;
  published_at: string | null;
  rejection_reason: string | null;
  replaces_post?: string | { id: string } | null;
};

export type ListingPostInput = Pick<
  AccountListingPost,
  "type" | "title" | "body" | "image" | "cta_label" | "cta_url" | "starts_at" | "ends_at"
> & { status: "draft" | "pending" };

export type ListingMetricSummary = {
  search_impressions: number;
  profile_views: number;
  website_clicks: number;
  phone_clicks: number;
  email_clicks: number;
  social_clicks: number;
  custom_cta_clicks: number;
  post_views: number;
  post_cta_clicks: number;
};

type DirectusResponse<T> = { data?: T; errors?: Array<{ message?: string }> };

function directusUrl() {
  const value = process.env.DIRECTUS_URL;
  if (!value) throw new Error("DIRECTUS_URL fehlt.");
  return value;
}

function serverHeaders() {
  const token = process.env.DIRECTUS_TOKEN;
  if (!token) throw new Error("DIRECTUS_TOKEN fehlt.");
  return { Authorization: `Bearer ${token}` };
}

async function readList<T>(response: Response): Promise<T[]> {
  const result = (await response.json().catch(() => null)) as DirectusResponse<T[]> | null;
  if (!response.ok || !result?.data) {
    throw new DirectusAccountError(result?.errors?.[0]?.message ?? "Directus-Fehler", response.status, "DIRECTUS_ERROR");
  }
  return result.data;
}

async function ensurePremium(accessToken: string, listingId: string) {
  const billing = await getAccountListingBillingData(accessToken, listingId);
  if (!billing) throw new DirectusAccountError("Nicht gefunden.", 404, "NOT_FOUND");
  if (!billing.premiumEnabled) throw new DirectusAccountError("Premium erforderlich.", 403, "PREMIUM_REQUIRED");
  return billing;
}

export async function getAccountListingPosts(accessToken: string, listingId: string) {
  await ensurePremium(accessToken, listingId);
  const url = new URL("/items/listing_posts", directusUrl());
  url.searchParams.set("fields", "id,listing,type,status,title,body,image,cta_label,cta_url,starts_at,ends_at,submitted_at,published_at,rejection_reason,replaces_post");
  url.searchParams.set("sort", "-date_created");
  url.searchParams.set("filter", JSON.stringify({ listing: { _eq: listingId } }));
  return readList<AccountListingPost>(await fetch(url, { headers: serverHeaders(), cache: "no-store" }));
}

function relationId(value: string | { id: string } | null | undefined): string | null {
  if (typeof value === "string") return value;
  return value?.id ?? null;
}

export async function createAccountListingPost(
  accessToken: string,
  listingId: string,
  currentUserId: string,
  input: ListingPostInput,
): Promise<string> {
  await ensurePremium(accessToken, listingId);
  const url = new URL("/items/listing_posts", directusUrl());
  const response = await fetch(url, {
    method: "POST",
    headers: { ...serverHeaders(), "Content-Type": "application/json" },
    body: JSON.stringify({
      ...input,
      listing: listingId,
      submitted_by: currentUserId,
      submitted_at: input.status === "pending" ? new Date().toISOString() : null,
    }),
    cache: "no-store",
  });
  if (!response.ok) throw new DirectusAccountError("Beitrag konnte nicht gespeichert werden.", response.status, "SAVE_FAILED");
  const result = (await response.json().catch(() => null)) as DirectusResponse<{ id: string }> | null;
  const postId = result?.data?.id;
  if (!postId) throw new DirectusAccountError("Beitrags-ID fehlt.", 500, "SAVE_FAILED");
  return postId;
}

export async function updateAccountListingPost(
  accessToken: string,
  listingId: string,
  postId: string,
  currentUserId: string,
  input: ListingPostInput,
): Promise<string> {
  await ensurePremium(accessToken, listingId);
  const posts = await getAccountListingPosts(accessToken, listingId);
  const current = posts.find((post) => post.id === postId);

  if (!current || current.status === "archived") {
    throw new DirectusAccountError("Nicht gefunden.", 404, "NOT_FOUND");
  }

  if (current.status === "published") {
    const existingReplacement = posts.find((post) =>
      relationId(post.replaces_post) === current.id &&
      ["draft", "pending", "rejected"].includes(post.status),
    );

    if (existingReplacement) {
      return updateAccountListingPost(
        accessToken,
        listingId,
        existingReplacement.id,
        currentUserId,
        input,
      );
    }

    const response = await fetch(new URL("/items/listing_posts", directusUrl()), {
      method: "POST",
      headers: { ...serverHeaders(), "Content-Type": "application/json" },
      body: JSON.stringify({
        ...input,
        listing: listingId,
        replaces_post: current.id,
        submitted_by: currentUserId,
        submitted_at: input.status === "pending" ? new Date().toISOString() : null,
        published_at: null,
      }),
      cache: "no-store",
    });
    if (!response.ok) throw new DirectusAccountError("Beitrag konnte nicht gespeichert werden.", response.status, "SAVE_FAILED");
    const result = (await response.json().catch(() => null)) as DirectusResponse<{ id: string }> | null;
    const replacementId = result?.data?.id;
    if (!replacementId) throw new DirectusAccountError("Beitrags-ID fehlt.", 500, "SAVE_FAILED");
    return replacementId;
  }

  const response = await fetch(new URL(`/items/listing_posts/${encodeURIComponent(postId)}`, directusUrl()), {
    method: "PATCH",
    headers: { ...serverHeaders(), "Content-Type": "application/json" },
    body: JSON.stringify({
      ...input,
      submitted_by: currentUserId,
      submitted_at: input.status === "pending" ? new Date().toISOString() : null,
      reviewed_by: null,
      reviewed_at: null,
      published_at: null,
      rejection_reason: null,
    }),
    cache: "no-store",
  });
  if (!response.ok) throw new DirectusAccountError("Beitrag konnte nicht gespeichert werden.", response.status, "SAVE_FAILED");
  return postId;
}

export async function archiveAccountListingPost(
  accessToken: string,
  listingId: string,
  postId: string,
) {
  const posts = await getAccountListingPosts(accessToken, listingId);
  if (!posts.some((post) => post.id === postId)) {
    throw new DirectusAccountError("Nicht gefunden.", 404, "NOT_FOUND");
  }
  const response = await fetch(new URL(`/items/listing_posts/${encodeURIComponent(postId)}`, directusUrl()), {
    method: "PATCH",
    headers: { ...serverHeaders(), "Content-Type": "application/json" },
    body: JSON.stringify({ status: "archived" }),
    cache: "no-store",
  });
  if (!response.ok) throw new DirectusAccountError("Beitrag konnte nicht archiviert werden.", response.status, "SAVE_FAILED");
}

export async function getPendingListingPosts(accessToken: string) {
  const url = new URL("/items/listing_posts", directusUrl());
  url.searchParams.set("fields", "id,listing.id,listing.name,type,status,title,body,image,cta_label,cta_url,starts_at,ends_at,submitted_by.id,submitted_by.email,submitted_at,published_at,rejection_reason,replaces_post");
  url.searchParams.set("sort", "submitted_at");
  url.searchParams.set("filter", JSON.stringify({ status: { _eq: "pending" } }));
  return readList<AccountListingPost>(await fetch(url, { headers: { Authorization: `Bearer ${accessToken}` }, cache: "no-store" }));
}

export async function decideListingPost(
  accessToken: string,
  postId: string,
  reviewerId: string,
  action: "approve" | "reject",
  reason: string,
) {
  const postUrl = new URL(`/items/listing_posts/${encodeURIComponent(postId)}`, directusUrl());
  postUrl.searchParams.set("fields", "id,status,replaces_post");
  const postResponse = await fetch(postUrl, {
    headers: { Authorization: `Bearer ${accessToken}` },
    cache: "no-store",
  });
  const postResult = (await postResponse.json().catch(() => null)) as DirectusResponse<{
    id: string;
    status: ListingPostStatus;
    replaces_post?: string | { id: string } | null;
  }> | null;
  if (!postResponse.ok || postResult?.data?.status !== "pending") {
    throw new DirectusAccountError("Entscheidung fehlgeschlagen.", postResponse.status || 400, "SAVE_FAILED");
  }
  const replacedPostId = relationId(postResult.data.replaces_post);
  const response = await fetch(new URL(`/items/listing_posts/${encodeURIComponent(postId)}`, directusUrl()), {
    method: "PATCH",
    headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      status: action === "approve" ? "published" : "rejected",
      reviewed_by: reviewerId,
      reviewed_at: new Date().toISOString(),
      published_at: action === "approve" ? new Date().toISOString() : null,
      rejection_reason: action === "reject" ? reason : null,
    }),
    cache: "no-store",
  });
  if (!response.ok) throw new DirectusAccountError("Entscheidung fehlgeschlagen.", response.status, "SAVE_FAILED");

  if (action === "approve" && replacedPostId) {
    const archiveResponse = await fetch(new URL(`/items/listing_posts/${encodeURIComponent(replacedPostId)}`, directusUrl()), {
      method: "PATCH",
      headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
      body: JSON.stringify({ status: "archived" }),
      cache: "no-store",
    });
    if (!archiveResponse.ok) {
      throw new DirectusAccountError("Vorheriger Beitrag konnte nicht archiviert werden.", archiveResponse.status, "SAVE_FAILED");
    }
  }
}

const metricKeys: Array<keyof ListingMetricSummary> = [
  "search_impressions", "profile_views", "website_clicks", "phone_clicks",
  "email_clicks", "social_clicks", "custom_cta_clicks", "post_views", "post_cta_clicks",
];

export async function getListingMetricSummary(
  accessToken: string,
  listingId: string,
  days = 30,
): Promise<ListingMetricSummary> {
  await ensurePremium(accessToken, listingId);
  const start = new Date();
  start.setUTCDate(start.getUTCDate() - Math.max(1, Math.min(days, 366)) + 1);
  const url = new URL("/items/listing_metrics_daily", directusUrl());
  url.searchParams.set("fields", metricKeys.join(","));
  url.searchParams.set("limit", "-1");
  url.searchParams.set("filter", JSON.stringify({
    _and: [{ listing: { _eq: listingId } }, { metric_date: { _gte: start.toISOString().slice(0, 10) } }],
  }));
  const rows = await readList<Record<keyof ListingMetricSummary, number>>(
    await fetch(url, { headers: serverHeaders(), cache: "no-store" }),
  );
  return rows.reduce<ListingMetricSummary>((sum, row) => {
    for (const key of metricKeys) sum[key] += Number(row[key] ?? 0);
    return sum;
  }, Object.fromEntries(metricKeys.map((key) => [key, 0])) as ListingMetricSummary);
}
