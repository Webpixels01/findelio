import type { AppLocale } from "@/i18n/routing";
import type { Listing } from "@/lib/directus";
import { Link } from "@/i18n/navigation";
import { getTranslations } from "next-intl/server";
import CompanyLogo from "@/components/company-logo";
import { htmlToPlainText } from "@/lib/text";

export default async function CompanyCard({
  company,
  locale,
}: {
  company: Listing;
  locale: AppLocale;
}) {
  const t = await getTranslations({ locale, namespace: "Results" });
  const tg = await getTranslations({ locale, namespace: "Growth" });

  const primaryIndustry = company.industries[0]?.industries_id;

  const languages = company.spoken_languages.map(
    (item) => item.spoken_languages_id,
  );

  const isVerified =
    company.verification_status === "verified";
  const descriptionExcerpt = htmlToPlainText(company.description);

  return (
    <article className="company-design-card group">
      <div className="flex items-start gap-4">
        <CompanyLogo
          fileId={company.logo}
          name={company.name}
        />

        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="company-design-name">
              {company.name}
            </h2>

            {isVerified && (
              <span className="rounded-full bg-[#e9f8ef] px-2.5 py-1 text-xs font-bold text-[#137a3d]">
                {t("verified")}
              </span>
            )}
            {company.premium_features_enabled && (
              <span className="rounded-full bg-[#e8f3ff] px-2.5 py-1 text-xs font-extrabold uppercase tracking-wide text-[var(--accent)]">
                {tg("common.premium")}
              </span>
            )}
          </div>

          {primaryIndustry && (
            <Link
              href={`/unternehmen?branche=${encodeURIComponent(
                primaryIndustry.code,
              )}`}
              locale={locale}
              className="mt-1 inline-flex text-sm font-semibold text-[var(--accent)] hover:underline focus-visible:rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]/40"
            >
              {primaryIndustry.name}
            </Link>
          )}
        </div>
      </div>

      {descriptionExcerpt && (
        <p className="company-design-description line-clamp-3">
          {descriptionExcerpt}
        </p>
      )}

      <p className="company-design-place">
        {company.postal_code && `${company.postal_code} `}
        {company.city}, {company.canton.name}
      </p>

      {languages.length > 0 && (
        <div className="company-design-languages">
          {languages.map((language) => (
            <span
              key={language.code}
              className="company-design-language"
            >
              {language.name}
            </span>
          ))}
        </div>
      )}

      <Link
        href={`/unternehmen/${company.slug}`}
        locale={locale}
        className="company-design-link group-hover:underline"
      >
        {t("details")} →
      </Link>
    </article>
  );
}
