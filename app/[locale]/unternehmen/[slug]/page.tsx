import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import type { AppLocale } from "@/i18n/routing";
import {
  getListingBySlug,
  getListingOpeningHours,
} from "@/lib/directus";
import SiteHeader from "@/components/site-header";
import CompanyLogo from "@/components/company-logo";
import CompanyGallery from "@/components/company-gallery";
import { Link } from "@/i18n/navigation";

const htmlEntities: Record<string, string> = {
  amp: "&",
  apos: "'",
  quot: '"',
  lt: "<",
  gt: ">",
  nbsp: " ",
  Auml: "Ä",
  auml: "ä",
  Ouml: "Ö",
  ouml: "ö",
  Uuml: "Ü",
  uuml: "ü",
  szlig: "ß",
  Agrave: "À",
  agrave: "à",
  Aacute: "Á",
  aacute: "á",
  Acirc: "Â",
  acirc: "â",
  Atilde: "Ã",
  atilde: "ã",
  Aring: "Å",
  aring: "å",
  AElig: "Æ",
  aelig: "æ",
  Ccedil: "Ç",
  ccedil: "ç",
  Egrave: "È",
  egrave: "è",
  Eacute: "É",
  eacute: "é",
  Ecirc: "Ê",
  ecirc: "ê",
  Euml: "Ë",
  euml: "ë",
  Igrave: "Ì",
  igrave: "ì",
  Iacute: "Í",
  iacute: "í",
  Icirc: "Î",
  icirc: "î",
  Iuml: "Ï",
  iuml: "ï",
  Ntilde: "Ñ",
  ntilde: "ñ",
  Ograve: "Ò",
  ograve: "ò",
  Oacute: "Ó",
  oacute: "ó",
  Ocirc: "Ô",
  ocirc: "ô",
  Otilde: "Õ",
  otilde: "õ",
  Oslash: "Ø",
  oslash: "ø",
  Ugrave: "Ù",
  ugrave: "ù",
  Uacute: "Ú",
  uacute: "ú",
  Ucirc: "Û",
  ucirc: "û",
  Yacute: "Ý",
  yacute: "ý",
  yuml: "ÿ",
  OElig: "Œ",
  oelig: "œ",
  Scaron: "Š",
  scaron: "š",
  Yuml: "Ÿ",
  Zcaron: "Ž",
  zcaron: "ž",
  euro: "€",
};

function decodeHtmlEntities(value: string): string {
  return value.replace(
    /&(#x[0-9a-fA-F]+|#\d+|[A-Za-z][A-Za-z0-9]+);/g,
    (match, entity: string) => {
      if (entity.startsWith("#x")) {
        const codePoint = Number.parseInt(entity.slice(2), 16);

        return Number.isNaN(codePoint)
          ? match
          : String.fromCodePoint(codePoint);
      }

      if (entity.startsWith("#")) {
        const codePoint = Number.parseInt(entity.slice(1), 10);

        return Number.isNaN(codePoint)
          ? match
          : String.fromCodePoint(codePoint);
      }

      return htmlEntities[entity] ?? match;
    },
  );
}

function removeHtml(value: string): string {
  const plainText = value
    .replace(/<[^>]*>/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  return decodeHtmlEntities(plainText);
}

function getWebsiteLabel(url: string): string {
  return url.replace(/^https?:\/\//, "").replace(/\/$/, "");
}

function formatTime(value: string): string {
  return value.slice(0, 5);
}

export default async function CompanyPage({
  params,
}: {
  params: Promise<{
    locale: AppLocale;
    slug: string;
  }>;
}) {
  const { locale, slug } = await params;

  setRequestLocale(locale);

  const company = await getListingBySlug(slug, locale);

  if (!company) {
    notFound();
  }

  const [t, openingHours] = await Promise.all([
    getTranslations("Company"),
    company.premium_features_enabled
      ? getListingOpeningHours(company.id)
      : Promise.resolve([]),
  ]);

  const primaryIndustry = company.industries[0]?.industries_id;

  const languages = company.spoken_languages.map(
    (item) => item.spoken_languages_id,
  );

  const isVerified = company.verification_status === "verified";

  const description = company.description
    ? removeHtml(company.description)
    : company.short_description;

  const fullAddress =
    company.address_visibility === "full"
      ? [
          company.street,
          [company.postal_code, company.city].filter(Boolean).join(" "),
          company.canton.name,
        ]
          .filter(Boolean)
          .join(", ")
      : null;

  const cityAddress =
    company.address_visibility === "city"
      ? [
          [company.postal_code, company.city].filter(Boolean).join(" "),
          company.canton.name,
        ]
          .filter(Boolean)
          .join(", ")
      : null;

  const visibleAddress = fullAddress ?? cityAddress;

  const hasContactInformation = Boolean(
    visibleAddress ||
      company.phone ||
      company.public_email ||
      company.website_url ||
      company.social_links?.length,
  );

  const weekdays = [
    { number: 1, name: t("weekdays.1") },
    { number: 2, name: t("weekdays.2") },
    { number: 3, name: t("weekdays.3") },
    { number: 4, name: t("weekdays.4") },
    { number: 5, name: t("weekdays.5") },
    { number: 6, name: t("weekdays.6") },
    { number: 7, name: t("weekdays.7") },
  ];

  return (
    <>
      <SiteHeader />

      <main className="page-shell bg-[var(--surface)] py-12 lg:py-16">
        <div className="site-container">
          <Link
            href="/unternehmen"
            className="font-bold text-[var(--accent)]"
          >
            ← {t("back")}
          </Link>

          <div className="mt-7 grid gap-7 lg:grid-cols-[1.5fr_0.8fr]">
            <article className="rounded-3xl border border-[var(--border)] bg-white p-7 md:p-10">
              <div className="flex items-start gap-5">
                <CompanyLogo
                  fileId={company.logo}
                  name={company.name}
                  size="detail"
                />

                <div>
                  <div className="flex flex-wrap items-center gap-3">
                    <h1 className="text-3xl font-extrabold sm:text-4xl">
                      {company.name}
                    </h1>

                    {isVerified && (
                      <span className="rounded-full bg-[#e9f8ef] px-3 py-1 text-xs font-bold text-[#137a3d]">
                        {t("verified")}
                      </span>
                    )}
                  </div>

                  {primaryIndustry && (
                    <Link
                      href={`/unternehmen?branche=${encodeURIComponent(
                        primaryIndustry.code,
                      )}`}
                      locale={locale}
                      className="mt-2 inline-flex font-bold text-[var(--accent)] hover:underline focus-visible:rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]/40"
                    >
                      {primaryIndustry.name}
                    </Link>
                  )}

                  <p className="mt-2 text-sm font-semibold text-[var(--muted)]">
                    {company.city}, {company.canton.name}
                  </p>
                </div>
              </div>

              {description && (
                <div className="mt-9 border-t border-[var(--border)] pt-8">
                  <h2 className="text-2xl font-extrabold">
                    {t("about")}
                  </h2>

                  <p className="mt-4 whitespace-pre-line text-lg leading-8 text-[var(--muted)]">
                    {description}
                  </p>
                </div>
              )}

              {languages.length > 0 && (
                <div className="mt-9">
                  <h2 className="text-xl font-extrabold">
                    {t("languages")}
                  </h2>

                  <div className="mt-3 flex flex-wrap gap-2">
                    {languages.map((language) => (
                      <span
                        key={language.code}
                        className="rounded-full bg-[var(--surface)] px-4 py-2 text-sm font-bold"
                      >
                        {language.name}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              <CompanyGallery
                items={company.gallery ?? []}
                title={t("gallery")}
                companyName={company.name}
              />
            </article>

            <div className="space-y-7">
              <aside className="rounded-3xl border border-[var(--border)] bg-white p-7">
                <h2 className="text-2xl font-extrabold">
                  {t("contact")}
                </h2>

                {hasContactInformation && (
                  <dl className="mt-6 space-y-5">
                    {visibleAddress && (
                      <div>
                        <dt className="text-sm font-bold text-[var(--muted)]">
                          {t("address")}
                        </dt>

                        <dd className="mt-1 font-semibold">
                          {visibleAddress}
                        </dd>
                      </div>
                    )}

                    {company.phone && (
                      <div>
                        <dt className="text-sm font-bold text-[var(--muted)]">
                          {t("phone")}
                        </dt>

                        <dd className="mt-1">
                          <a
                            href={`tel:${company.phone.replace(/\s/g, "")}`}
                            className="font-semibold text-[var(--accent)]"
                          >
                            {company.phone}
                          </a>
                        </dd>
                      </div>
                    )}

                    {company.public_email && (
                      <div>
                        <dt className="text-sm font-bold text-[var(--muted)]">
                          {t("email")}
                        </dt>

                        <dd className="mt-1 break-all">
                          <a
                            href={`mailto:${company.public_email}`}
                            className="font-semibold text-[var(--accent)]"
                          >
                            {company.public_email}
                          </a>
                        </dd>
                      </div>
                    )}

                    {company.website_url && (
                      <div>
                        <dt className="text-sm font-bold text-[var(--muted)]">
                          {t("website")}
                        </dt>

                        <dd className="mt-1 break-all">
                          <a
                            href={company.website_url}
                            target="_blank"
                            rel="noreferrer"
                            className="font-semibold text-[var(--accent)]"
                          >
                            {getWebsiteLabel(company.website_url)}
                          </a>
                        </dd>
                      </div>
                    )}

                    {company.social_links &&
                      company.social_links.length > 0 && (
                        <div>
                          <dt className="text-sm font-bold text-[var(--muted)]">
                            {t("socialMedia")}
                          </dt>

                          <dd className="mt-2 flex flex-wrap gap-2">
                            {company.social_links.map((socialLink) => (
                              <a
                                key={`${socialLink.platform}-${socialLink.url}`}
                                href={socialLink.url}
                                target="_blank"
                                rel="noreferrer"
                                className="rounded-xl bg-[var(--surface)] px-3 py-2 text-sm font-bold text-[var(--accent)]"
                              >
                                {socialLink.platform}
                              </a>
                            ))}
                          </dd>
                        </div>
                      )}
                  </dl>
                )}
              </aside>

              {company.premium_features_enabled && (
                <aside className="rounded-3xl border border-[var(--border)] bg-white p-7">
                  <h2 className="text-2xl font-extrabold">
                    {t("openingHours")}
                  </h2>

                  <div className="mt-6 space-y-3">
                    {weekdays.map((weekday) => {
                      const intervals = openingHours.filter(
                        (item) => item.day_of_week === weekday.number,
                      );

                      return (
                        <div
                          key={weekday.number}
                          className="flex items-start justify-between gap-5 border-b border-[var(--border)] pb-3 last:border-b-0 last:pb-0"
                        >
                          <span className="font-semibold">
                            {weekday.name}
                          </span>

                          <span className="text-right text-sm text-[var(--muted)]">
                            {intervals.length > 0
                              ? intervals
                                  .map(
                                    (interval) =>
                                      `${formatTime(interval.opens_at)}–${formatTime(
                                        interval.closes_at,
                                      )}`,
                                  )
                                  .join(", ")
                              : t("closed")}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </aside>
              )}
            </div>
          </div>
        </div>
      </main>
    </>
  );
}
