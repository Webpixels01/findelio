"use client";

import type { AnchorHTMLAttributes, ReactNode } from "react";
import {
  trackListingMetric,
  type ListingMetricEvent,
} from "@/components/listing-metrics-tracker";

export default function TrackedContactLink({
  listingId,
  metric,
  children,
  ...props
}: AnchorHTMLAttributes<HTMLAnchorElement> & {
  listingId: string;
  metric: ListingMetricEvent;
  children: ReactNode;
}) {
  return (
    <a
      {...props}
      onClick={(event) => {
        props.onClick?.(event);
        if (!event.defaultPrevented) trackListingMetric(listingId, metric);
      }}
    >
      {children}
    </a>
  );
}
