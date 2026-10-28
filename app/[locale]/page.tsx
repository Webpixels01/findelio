import type { Metadata } from "next";
import { Suspense } from "react";
import { getTranslations, setRequestLocale } from "next-intl/server";
import type { AppLocale } from "@/i18n/routing";
import SiteHeader from "@/components/site-header";
import SearchForm from "@/components/search-form";
import HomeCompanies from "@/components/home-companies";
import { Link } from "@/i18n/navigation";
import StructuredData from "@/components/structured-data";
import { buildPageMetadata, getSiteUrl, localizedUrl } from "@/lib/seo";

type HomePageProps = {
  params: Promise<{ locale: AppLocale }>;
};

export async function generateMetadata({
  params,
}: HomePageProps): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "Metadata" });

  return buildPageMetadata({
    locale,
    title: t("title"),
    description: t("description"),
  });
}

export default async function HomePage({ params }: HomePageProps) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("Home");

  const steps = [
    ["01", t("step1Title"), t("step1Text")],
    ["02", t("step2Title"), t("step2Text")],
    ["03", t("step3Title"), t("step3Text")],
  ];
  const websiteData = {
    "@context": "https://schema.org",
    "@type": "WebSite",
    "@id": `${getSiteUrl()}/#website`,
    name: "Findelio",
    url: localizedUrl(locale),
    inLanguage: locale,
    publisher: { "@id": `${getSiteUrl()}/#organization` },
  };

  return (
    <>
      <StructuredData data={websiteData} />
      <SiteHeader />
      <main className="page-shell home-design">
        <section className="home-hero">
          <div className="site-container">
            <div className="home-hero-top">
              <div className="home-hero-copy">
                <p className="eyebrow">{t("eyebrow")}</p>
                <h1>{t("title")}</h1>
                <p className="home-intro">{t("description")}</p>
              </div>
              <div className="home-language-art" aria-hidden="true">
                <span>Ciao!</span>
                <span>Grüezi.</span>
                <span>Olá!</span>
              </div>
            </div>
            <SearchForm locale={locale} />
          </div>
        </section>

        <Suspense fallback={null}>
          <HomeCompanies locale={locale} />
        </Suspense>

        <section className="home-how site-container">
          <div className="home-how-heading">
            <h2>{t("howTitle")}</h2>
            <p>{t("howDescription")}</p>
          </div>
          <ol className="home-steps">
            {steps.map(([number, title, text]) => (
              <li key={number}>
                <span className="home-step-number" aria-hidden="true">{number}</span>
                <div>
                  <h3>{title}</h3>
                  <p>{text}</p>
                </div>
              </li>
            ))}
          </ol>
        </section>

        <section className="home-business-section site-container">
          <div className="home-business">
            <div>
              <h2>{t("ctaTitle")}</h2>
              <p>{t("ctaText")}</p>
            </div>
            <Link href="/firma-eintragen" className="home-business-link">
              {t("ctaButton")} <span aria-hidden="true">↗</span>
            </Link>
          </div>
        </section>
      </main>
    </>
  );
}
