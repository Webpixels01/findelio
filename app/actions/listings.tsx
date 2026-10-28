"use server";

import { hasLocale } from "next-intl";
import { routing } from "@/i18n/routing";
import { getListingsPage } from "@/lib/directus";
import { normalizeListingPage } from "@/lib/listing-pagination";
import CompanyCard from "@/components/company-card";
import ListingMetricsTracker from "@/components/listing-metrics-tracker";

export async function loadListingPage(
  locale: string,
  filters: Record<string, string | undefined>,
  page: number,
  orderDate?: string,
) {
  if (!hasLocale(routing.locales, locale)) throw new Error("Invalid locale");
  if (!filters || typeof filters !== "object" || page !== normalizeListingPage(page)) throw new Error("Invalid page");
  const clean = (key: string) => {
    const value = filters[key];
    if (value !== undefined && (typeof value !== "string" || value.length > 200)) throw new Error("Invalid filter");
    return value?.trim() || undefined;
  };
  if (orderDate !== undefined && (typeof orderDate !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(orderDate))) throw new Error("Invalid date");
  const result = await getListingsPage(locale, {
    language: clean("sprache"), industry: clean("branche"), canton: clean("kanton"), location: clean("ort"),
  }, page, orderDate);
  return {
    total: result.total, page: result.page, orderDate: result.orderDate,
    items: await Promise.all(result.listings.map(async (company) => ({
      id: company.id,
      card: <>
        {await CompanyCard({ company, locale })}
        {company.premium_features_enabled && <ListingMetricsTracker listingIds={[company.id]} event="search_impressions" />}
      </>,
    }))),
  };
}
