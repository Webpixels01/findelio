import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import type { AppLocale } from "@/i18n/routing";
import SiteHeader from "@/components/site-header";
import SearchForm, { type SearchValues } from "@/components/search-form";
import CompanyResults from "@/components/company-results";
import { loadListingPage } from "@/app/actions/listings";
import { normalizeListingPage } from "@/lib/listing-pagination";
import { notFound } from "next/navigation";
import { Link } from "@/i18n/navigation";
import { buildPageMetadata } from "@/lib/seo";

function value(input: string | string[] | undefined) {
  return Array.isArray(input) ? input[0] : input;
}

type CompaniesPageProps = {
  params: Promise<{ locale: AppLocale }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export async function generateMetadata({
  params,
  searchParams,
}: CompaniesPageProps): Promise<Metadata> {
  const [{ locale }, query] = await Promise.all([params, searchParams]);
  const [t, metadata] = await Promise.all([
    getTranslations({ locale, namespace: "Results" }),
    getTranslations({ locale, namespace: "Metadata" }),
  ]);
  const hasFilters = ["sprache", "branche", "kanton", "ort"].some((key) =>
    Boolean(value(query[key])?.trim()),
  );

  const page = normalizeListingPage(value(query.page));
  return buildPageMetadata({
    locale,
    path: page > 1 ? `/unternehmen?page=${page}` : "/unternehmen",
    title: `${t("title")}${page > 1 ? ` – ${t("pageTitle", { page })}` : ""} | Findelio`,
    description: metadata("description"),
    noIndex: hasFilters,
  });
}

export default async function CompaniesPage({
  params,
  searchParams,
}: CompaniesPageProps) {
  const { locale } = await params;
  const query = await searchParams;

  setRequestLocale(locale);

  const filters: SearchValues = {
    sprache: value(query.sprache),
    branche: value(query.branche),
    kanton: value(query.kanton),
    ort: value(query.ort),
  };

  const page = normalizeListingPage(value(query.page));
  const [results, t] = await Promise.all([
    loadListingPage(locale, filters, page),
    getTranslations("Results"),
  ]);
  if (page > 1 && results.items.length === 0) notFound();

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
            </div>

            <Link
              href="/unternehmen"
              className="secondary-button h-11 px-4"
            >
              {t("clearFilters")}
            </Link>
          </div>

          <CompanyResults
            key={JSON.stringify([locale, filters, page, results.orderDate])}
            initial={results}
            locale={locale}
            filters={filters}
          >
            <div className="mt-8">
              <SearchForm locale={locale} values={filters} compact />
            </div>
          </CompanyResults>
        </div>
      </main>
    </>
  );
}
