import "server-only";
import type { PublicData } from "@/components/customer-reviews";

// Fetch anonymously: pending reviews and account details must never enter public HTML.
export async function getPublicReviews(listingId: string): Promise<PublicData | null> {
  try {
    const url = new URL("/findelio-review-notification/customer-reviews", process.env.DIRECTUS_URL);
    url.searchParams.set("listing", listingId);
    const response = await fetch(url, { cache: "no-store", signal: AbortSignal.timeout(3000) });
    if (!response.ok) return null;
    const { data } = await response.json() as { data: PublicData };
    if (!Array.isArray(data?.reviews) || !Number.isInteger(data.count) || data.count < 0 ||
      !Number.isFinite(data.average) || (data.count > 0 && (data.average < 1 || data.average > 5))) return null;
    return { reviews: data.reviews, count: data.count, average: data.average, own: null, canReview: false, authenticated: false };
  } catch {
    // Reviews can still load in the browser; their service must not break the profile.
    return null;
  }
}
