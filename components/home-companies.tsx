import { unstable_rethrow } from "next/navigation";
import { getTranslations } from "next-intl/server";
import type { AppLocale } from "@/i18n/routing";
import { Link } from "@/i18n/navigation";
import { getListingsPage, type Listing } from "@/lib/directus";
import CompanyCard from "@/components/company-card";

export default async function HomeCompanies({ locale }: { locale: AppLocale }) {
  let companies: Listing[];
  try {
    const result = await getListingsPage(locale);
    companies = result.listings.slice(0, 3);
  } catch (error) {
    unstable_rethrow(error);
    console.error("Firmenvorschau auf der Startseite konnte nicht geladen werden.");
    return null;
  }

  if (!companies.length) return null;
  const t = await getTranslations({ locale, namespace: "Home" });

  return (
    <section className="home-companies site-container" aria-labelledby="home-companies-title">
      <div className="home-companies-heading">
        <div>
          <h2 id="home-companies-title">{t("companiesTitle")}</h2>
          <p>{t("companiesDescription")}</p>
        </div>
        <Link href="/unternehmen" locale={locale} className="home-companies-all">
          {t("companiesAll")} <span aria-hidden="true">↗</span>
        </Link>
      </div>
      <div className="home-companies-grid">
        {companies.map(company => <CompanyCard key={company.id} company={company} locale={locale} />)}
      </div>
    </section>
  );
}
