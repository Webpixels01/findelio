import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import type { AppLocale } from "@/i18n/routing";
import {
  getListingBySlug,
  getListingOpeningHours,
  getPublicListingPosts,
} from "@/lib/directus";
import SiteHeader from "@/components/site-header";
import CompanyLogo from "@/components/company-logo";
import CompanyGallery from "@/components/company-gallery";
import { Link } from "@/i18n/navigation";
import ListingMetricsTracker from "@/components/listing-metrics-tracker";
import TrackedContactLink from "@/components/tracked-contact-link";
import { getDirectusAssetUrl } from "@/lib/directus-assets";
import Image from "next/image";
import ShareButton from "@/components/share-button";
import StructuredData from "@/components/structured-data";
import { buildPageMetadata, localizedUrl } from "@/lib/seo";

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

type CompanyPageProps = {
  params: Promise<{
    locale: AppLocale;
    slug: string;
  }>;
};

export async function generateMetadata({
  params,
}: CompanyPageProps): Promise<Metadata> {
  const { locale, slug } = await params;
  const [company, t] = await Promise.all([
    getListingBySlug(slug, locale),
    getTranslations({ locale, namespace: "Company" }),
  ]);

  if (!company) return {};

  const plainDescription = company.description
    ? removeHtml(company.description)
    : null;
  const description = plainDescription
    ? plainDescription.length > 160
      ? `${plainDescription.slice(0, 157).trimEnd()}...`
      : plainDescription
    : t("metaDescription", { company: company.name, city: company.city });
  const title = `${company.name} | Findelio`;
  const logoId =
    typeof company.logo === "string" ? company.logo : company.logo?.id;
  const logoUrl = logoId ? getDirectusAssetUrl(logoId) : null;

  return buildPageMetadata({
    locale,
    path: `/unternehmen/${company.slug}`,
    title,
    description,
    image: logoUrl,
    imageAlt: `${company.name} Logo`,
  });
}

export default async function CompanyPage({
  params,
}: CompanyPageProps) {
  const { locale, slug } = await params;

  setRequestLocale(locale);

  const company = await getListingBySlug(slug, locale);

  if (!company) {
    notFound();
  }

  const [t, tg, th, openingHours, posts] = await Promise.all([
    getTranslations("Company"),
    getTranslations("Growth"),
    getTranslations("Header"),
    company.premium_features_enabled
      ? getListingOpeningHours(company.id)
      : Promise.resolve([]),
    company.premium_features_enabled
      ? getPublicListingPosts(company.id)
      : Promise.resolve([]),
  ]);

  const primaryIndustry = company.industries[0]?.industries_id;

  const languages = company.spoken_languages.map(
    (item) => item.spoken_languages_id,
  );

  const isVerified = company.verification_status === "verified";

  const description = company.description
    ? removeHtml(company.description)
    : null;

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

  const listingUrl = localizedUrl(
    locale,
    `/unternehmen/${company.slug}`,
  );
  const logoId =
    typeof company.logo === "string" ? company.logo : company.logo?.id;
  const logoUrl = logoId ? getDirectusAssetUrl(logoId) : undefined;
  const sameAs = Array.from(
    new Set(
      [
        company.website_url,
        ...(company.social_links?.map((socialLink) => socialLink.url) ?? []),
      ].filter((url): url is string => Boolean(url)),
    ),
  );
  const schemaAddress =
    company.address_visibility === "hidden"
      ? undefined
      : {
          "@type": "PostalAddress",
          ...(company.address_visibility === "full" && company.street
            ? { streetAddress: company.street }
            : {}),
          ...(company.postal_code ? { postalCode: company.postal_code } : {}),
          addressLocality: company.city,
          addressRegion: company.canton.name,
          addressCountry: "CH",
        };
  const openingHoursSpecification = openingHours.map((interval) => ({
    "@type": "OpeningHoursSpecification",
    dayOfWeek: `https://schema.org/${[
      "Monday",
      "Tuesday",
      "Wednesday",
      "Thursday",
      "Friday",
      "Saturday",
      "Sunday",
    ][interval.day_of_week - 1]}`,
    opens: formatTime(interval.opens_at),
    closes: formatTime(interval.closes_at),
  }));
  const businessData = {
    "@context": "https://schema.org",
    "@type": "LocalBusiness",
    "@id": `${listingUrl}#business`,
    name: company.name,
    url: listingUrl,
    ...(description ? { description } : {}),
    ...(logoUrl ? { logo: logoUrl, image: logoUrl } : {}),
    ...(primaryIndustry ? { category: primaryIndustry.name } : {}),
    ...(company.phone ? { telephone: company.phone } : {}),
    ...(company.public_email ? { email: company.public_email } : {}),
    ...(schemaAddress ? { address: schemaAddress } : {}),
    ...(languages.length > 0
      ? { knowsLanguage: languages.map((language) => language.name) }
      : {}),
    ...(sameAs.length > 0 ? { sameAs } : {}),
    ...(openingHoursSpecification.length > 0
      ? { openingHoursSpecification }
      : {}),
  };
  const breadcrumbData = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      {
        "@type": "ListItem",
        position: 1,
        name: "Findelio",
        item: localizedUrl(locale),
      },
      {
        "@type": "ListItem",
        position: 2,
        name: th("findCompanies"),
        item: localizedUrl(locale, "/unternehmen"),
      },
      {
        "@type": "ListItem",
        position: 3,
        name: company.name,
        item: listingUrl,
      },
    ],
  };

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
      <StructuredData data={[businessData, breadcrumbData]} />
      <SiteHeader />

      <main className="page-shell bg-[var(--surface)] py-12 lg:py-16">
        {company.premium_features_enabled && (
          <ListingMetricsTracker listingIds={[company.id]} event="profile_views" />
        )}
        {company.premium_features_enabled && posts.length > 0 && (
          <ListingMetricsTracker listingIds={[company.id]} event="post_views" />
        )}
        <div className="site-container">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <Link
              href="/unternehmen"
              className="font-bold text-[var(--accent)]"
            >
              ← {t("back")}
            </Link>
            <ShareButton variant="inline" kind="listing" />
          </div>

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

              {posts.length > 0 && (
                <section className="mt-9 border-t border-[var(--border)] pt-8">
                  <h2 className="text-2xl font-extrabold">{tg("publicPosts.title")}</h2>
                  <div className="mt-5 grid gap-5 sm:grid-cols-2">
                    {posts.map((post) => (
                      <article key={post.id} className="overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--surface)]">
                        {post.image && (
                          <div className="relative aspect-[16/9]">
                            <Image src={getDirectusAssetUrl(post.image)} alt="" fill sizes="(max-width: 640px) 100vw, 50vw" className="object-cover" />
                          </div>
                        )}
                        <div className="p-5">
                          <p className="text-xs font-extrabold uppercase tracking-wider text-[var(--accent)]">{tg(`posts.types.${post.type}`)}</p>
                          <h3 className="mt-2 text-xl font-extrabold">{post.title}</h3>
                          {post.body && <p className="mt-3 whitespace-pre-line text-[var(--muted)]">{removeHtml(post.body)}</p>}
                          {post.cta_label && post.cta_url && (
                            <TrackedContactLink listingId={company.id} metric="post_cta_clicks" href={post.cta_url} target="_blank" rel="noreferrer" className="primary-button mt-5 h-11 px-5">
                              {post.cta_label}
                            </TrackedContactLink>
                          )}
                        </div>
                      </article>
                    ))}
                  </div>
                </section>
              )}
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
                          <a
                            href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(visibleAddress)}`}
                            target="_blank"
                            rel="noreferrer"
                            aria-label={`${visibleAddress} – ${t("openInGoogleMaps")}`}
                            className="text-[var(--accent)] underline decoration-[var(--accent)]/40 underline-offset-4 transition-colors hover:text-[var(--primary)] hover:decoration-[var(--primary)] focus-visible:rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]/40"
                          >
                            {visibleAddress} <span aria-hidden="true">↗</span>
                          </a>
                        </dd>
                      </div>
                    )}

                    {company.phone && (
                      <div>
                        <dt className="text-sm font-bold text-[var(--muted)]">
                          {t("phone")}
                        </dt>

                        <dd className="mt-1">
                          <TrackedContactLink
                            listingId={company.id}
                            metric="phone_clicks"
                            href={`tel:${company.phone.replace(/\s/g, "")}`}
                            className="font-semibold text-[var(--accent)]"
                          >
                            {company.phone}
                          </TrackedContactLink>
                        </dd>
                      </div>
                    )}

                    {company.public_email && (
                      <div>
                        <dt className="text-sm font-bold text-[var(--muted)]">
                          {t("email")}
                        </dt>

                        <dd className="mt-1 break-all">
                          <TrackedContactLink
                            listingId={company.id}
                            metric="email_clicks"
                            href={`mailto:${company.public_email}`}
                            className="font-semibold text-[var(--accent)]"
                          >
                            {company.public_email}
                          </TrackedContactLink>
                        </dd>
                      </div>
                    )}

                    {company.website_url && (
                      <div>
                        <dt className="text-sm font-bold text-[var(--muted)]">
                          {t("website")}
                        </dt>

                        <dd className="mt-1 break-all">
                          <TrackedContactLink
                            listingId={company.id}
                            metric="website_clicks"
                            href={company.website_url}
                            target="_blank"
                            rel="noreferrer"
                            className="font-semibold text-[var(--accent)]"
                          >
                            {getWebsiteLabel(company.website_url)}
                          </TrackedContactLink>
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
                              <TrackedContactLink
                                listingId={company.id}
                                metric="social_clicks"
                                key={`${socialLink.platform}-${socialLink.url}`}
                                href={socialLink.url}
                                target="_blank"
                                rel="noreferrer"
                                className="rounded-xl bg-[var(--surface)] px-3 py-2 text-sm font-bold text-[var(--accent)]"
                              >
                                {socialLink.platform}
                              </TrackedContactLink>
                            ))}
                          </dd>
                        </div>
                      )}
                  </dl>
                )}
              </aside>

              {company.custom_cta_label && company.custom_cta_value && (
                <TrackedContactLink
                  listingId={company.id}
                  metric="custom_cta_clicks"
                  href={company.custom_cta_value}
                  target={company.custom_cta_value.startsWith("http") ? "_blank" : undefined}
                  rel={company.custom_cta_value.startsWith("http") ? "noreferrer" : undefined}
                  className="primary-button w-full min-h-12 px-6 text-center"
                >
                  {company.custom_cta_label}
                </TrackedContactLink>
              )}

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
