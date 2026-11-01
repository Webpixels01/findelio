export const LISTINGS_PAGE_SIZE = 10;

export function normalizeListingPage(value: unknown): number {
  const page = typeof value === "number" ? value : typeof value === "string" && /^\d+$/.test(value) ? Number(value) : 1;
  return Number.isSafeInteger(page) && page > 0 && page <= 1_000_000 ? page : 1;
}

export function dailyListingRank(id: string, date: string): number {
  let hash = 0;
  for (const character of `${date}:${id}`) hash = (hash * 31 + character.charCodeAt(0)) >>> 0;
  return hash;
}

export function listingPageHref(filters: Record<string, string | undefined>, page: number): string {
  const query = new URLSearchParams();
  for (const key of ["sprache", "branche", "kanton", "ort"]) {
    if (filters[key]) query.set(key, filters[key]);
  }
  if (page > 1) query.set("page", String(page));
  return `/unternehmen${query.size ? `?${query}` : ""}`;
}
