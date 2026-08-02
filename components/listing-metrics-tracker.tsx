"use client";

import { useEffect } from "react";

export type ListingMetricEvent =
  | "search_impressions"
  | "profile_views"
  | "website_clicks"
  | "phone_clicks"
  | "email_clicks"
  | "social_clicks"
  | "custom_cta_clicks"
  | "post_views"
  | "post_cta_clicks";

export function trackListingMetric(
  listingId: string,
  event: ListingMetricEvent,
) {
  const payload = JSON.stringify({ listingIds: [listingId], event });
  if (navigator.sendBeacon) {
    navigator.sendBeacon(
      "/api/metrics",
      new Blob([payload], { type: "application/json" }),
    );
    return;
  }
  void fetch("/api/metrics", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: payload,
    keepalive: true,
  });
}

export default function ListingMetricsTracker({
  listingIds,
  event,
}: {
  listingIds: string[];
  event: ListingMetricEvent;
}) {
  useEffect(() => {
    if (listingIds.length === 0) return;
    void fetch("/api/metrics", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ listingIds, event }),
      keepalive: true,
    });
  }, [event, listingIds]);

  return null;
}
