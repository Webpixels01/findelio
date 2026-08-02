import { getTranslations, setRequestLocale } from "next-intl/server";
import type { AppLocale } from "@/i18n/routing";
import SiteHeader from "@/components/site-header";
import SearchForm, { type SearchValues } from "@/components/search-form";
import CompanyCard from "@/components/company-card";
import { getListings } from "@/lib/directus";
import { Link } from "@/i18n/navigation";
import ListingMetricsTracker from "@/components/listing-metrics-tracker";

function value(input: string | string[] | undefined) {
  return Array.isArray(input) ? input[0] : input;
}

export default async function CompaniesPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: AppLocale }>;
  searchParams: Promise<
    Record<string, string | string[] | undefined>
  >;
}) {
  const { locale } = await params;
  const query = await searchParams;

  setRequestLocale(locale);

  const filters: SearchValues = {
    sprache: value(query.sprache),
    branche: value(query.branche),
    kanton: value(query.kanton),
    ort: value(query.ort),
  };

  const [results, t] = await Promise.all([
    getListings(locale, {
      language: filters.sprache,
      industry: filters.branche,
      canton: filters.kanton,
      location: filters.ort,
    }),
    getTranslations("Results"),
  ]);

  return (
    <>
      <SiteHeader />

      <main className="page-shell bg-[var(--surface)] py-12 lg:py-16">
        <div className="site-container">
          <p className="eyebrow">{t("eyebrow")}</p>

          <div className="mt-3 flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
            <div>
              <h1 className="text-4xl font-extrabold tracking-tight sm:text-5xl">
                {t("title")}
              </h1>

              <p className="mt-3 text-lg text-[var(--muted)]">
                {t("count", { count: results.length })}
              </p>
            </div>

            <Link
              href="/unternehmen"
              className="secondary-button h-11 px-4"
            >
              {t("clearFilters")}
            </Link>
          </div>

          <div className="mt-8">
            <SearchForm
              locale={locale}
              values={filters}
              compact
            />
          </div>

          {results.length > 0 ? (
            <>
            <ListingMetricsTracker
              listingIds={results.filter((item) => item.premium_features_enabled).map((item) => item.id)}
              event="search_impressions"
            />
            <div className="mt-10 grid gap-6 lg:grid-cols-2">
              {results.map((company) => (
                <CompanyCard
                  key={company.id}
                  company={company}
                  locale={locale}
                />
              ))}
            </div>
            </>
          ) : (
            <div className="mt-10 rounded-3xl border border-dashed border-[#b9c9d9] bg-white p-10 text-center">
              <p className="text-xl font-bold">
                {t("noResults")}
              </p>

              <Link
                href="/unternehmen"
                className="primary-button mt-6 h-11 px-5"
              >
                {t("clearFilters")}
              </Link>
            </div>
          )}
        </div>
      </main>
    </>
  );
}
