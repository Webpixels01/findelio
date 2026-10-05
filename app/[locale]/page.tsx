import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import type { AppLocale } from "@/i18n/routing";
import SiteHeader from "@/components/site-header";
import SearchForm from "@/components/search-form";
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
      <main className="page-shell">
        <section className="relative overflow-hidden bg-gradient-to-b from-[#eff7ff] via-[#f8fbff] to-white py-20 lg:py-28">
          <div className="absolute -left-24 top-12 h-72 w-72 rounded-full bg-[#0277ee]/8 blur-3xl" />
          <div className="absolute -right-28 top-24 h-80 w-80 rounded-full bg-[#001734]/6 blur-3xl" />
          <div className="site-container relative">
            <div className="mx-auto max-w-4xl text-center">
              <p className="eyebrow">{t("eyebrow")}</p>
              <h1 className="mt-4 text-4xl font-extrabold leading-[1.05] tracking-tight sm:text-5xl lg:text-7xl">{t("title")}</h1>
              <p className="mx-auto mt-6 max-w-2xl text-lg leading-8 text-[var(--muted)] sm:text-xl">{t("description")}</p>
            </div>
            <SearchForm locale={locale} />
          </div>
        </section>

        <section className="py-20">
          <div className="site-container">
            <div className="mx-auto max-w-2xl text-center">
              <h2 className="text-3xl font-extrabold tracking-tight sm:text-4xl">{t("howTitle")}</h2>
              <p className="mt-3 text-lg text-[var(--muted)]">{t("howDescription")}</p>
            </div>
            <div className="mt-12 grid gap-6 md:grid-cols-3">
              {steps.map(([number, title, text]) => (
                <article key={number} className="rounded-3xl border border-[var(--border)] bg-white p-7 shadow-lg shadow-[#001734]/4">
                  <span className="inline-flex h-10 min-w-10 items-center justify-center rounded-xl bg-[#eaf4ff] px-3 font-extrabold text-[var(--accent)]">{number}</span>
                  <h3 className="mt-5 text-2xl font-extrabold">{title}</h3>
                  <p className="mt-3 leading-7 text-[var(--muted)]">{text}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="pb-20">
          <div className="site-container">
            <div className="rounded-[2rem] bg-[#001734] px-7 py-10 text-white md:flex md:items-center md:justify-between md:gap-10 md:px-12">
              <div>
                <h2 className="text-3xl font-extrabold">{t("ctaTitle")}</h2>
                <p className="mt-3 max-w-2xl text-white/70">{t("ctaText")}</p>
              </div>
              <Link href="/firma-eintragen" className="mt-7 inline-flex h-12 shrink-0 items-center justify-center rounded-xl bg-[#0277ee] px-6 font-extrabold transition hover:bg-white hover:text-[#001734] md:mt-0">
                {t("ctaButton")}
              </Link>
            </div>
          </div>
        </section>
      </main>
    </>
  );
}
