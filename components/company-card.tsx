import type { AppLocale } from "@/i18n/routing";
import type { Listing } from "@/lib/directus";
import { Link } from "@/i18n/navigation";
import { getTranslations } from "next-intl/server";
import CompanyLogo from "@/components/company-logo";

export default async function CompanyCard({
  company,
  locale,
}: {
  company: Listing;
  locale: AppLocale;
}) {
  const t = await getTranslations("Results");

  const primaryIndustry = company.industries[0]?.industries_id;

  const languages = company.spoken_languages.map(
    (item) => item.spoken_languages_id,
  );

  const isVerified =
    company.verification_status === "verified";

  return (
    <article className="group rounded-3xl border border-[var(--border)] bg-white p-6 transition hover:-translate-y-1 hover:border-[#0277ee]/40 hover:shadow-xl hover:shadow-[#001734]/8">
      <div className="flex items-start gap-4">
        <CompanyLogo
          fileId={company.logo}
          name={company.name}
        />

        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-xl font-extrabold">
              {company.name}
            </h2>

            {isVerified && (
              <span className="rounded-full bg-[#e9f8ef] px-2.5 py-1 text-xs font-bold text-[#137a3d]">
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
              className="mt-1 inline-flex text-sm font-semibold text-[var(--accent)] hover:underline focus-visible:rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]/40"
            >
              {primaryIndustry.name}
            </Link>
          )}
        </div>
      </div>

      {company.short_description && (
        <p className="mt-5 line-clamp-3 text-[var(--muted)]">
          {company.short_description}
        </p>
      )}

      <p className="mt-5 text-sm font-semibold">
        {company.postal_code && `${company.postal_code} `}
        {company.city}, {company.canton.name}
      </p>

      {languages.length > 0 && (
        <div className="mt-4 flex flex-wrap gap-2">
          {languages.map((language) => (
            <span
              key={language.code}
              className="rounded-full bg-[var(--surface)] px-3 py-1 text-xs font-bold text-[#40536b]"
            >
              {language.name}
            </span>
          ))}
        </div>
      )}

      <Link
        href={`/unternehmen/${company.slug}`}
        locale={locale}
        className="mt-6 inline-flex font-bold text-[var(--accent)] group-hover:underline"
      >
        {t("details")} →
      </Link>
    </article>
  );
}
