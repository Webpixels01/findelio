import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import SiteHeader from "@/components/site-header";
import { Link } from "@/i18n/navigation";
import type { AppLocale } from "@/i18n/routing";
import { buildPageMetadata } from "@/lib/seo";

type CompanyGuidePageProps = {
  params: Promise<{ locale: AppLocale }>;
};

const stepKeys = [
  "register",
  "organization",
  "listing",
  "complete",
  "review",
  "publish",
] as const;

const freeFeatureKeys = ["profile", "classification", "contact"] as const;
const premiumFeatureKeys = [
  "media",
  "details",
  "translations",
  "posts",
  "ranking",
  "statistics",
] as const;

export async function generateMetadata({
  params,
}: CompanyGuidePageProps): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "CompanyGuide" });

  return buildPageMetadata({
    locale,
    path: "/fuer-unternehmen",
    title: t("metaTitle"),
    description: t("metaDescription"),
  });
}

export default async function CompanyGuidePage({
  params,
}: CompanyGuidePageProps) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("CompanyGuide");

  return (
    <>
      <SiteHeader />
      <main className="page-shell bg-[var(--surface)] py-14 sm:py-20">
        <div className="site-container">
          <header className="mx-auto max-w-4xl text-center">
            <p className="eyebrow">{t("eyebrow")}</p>
            <h1 className="mt-3 text-4xl font-extrabold tracking-tight sm:text-6xl">
              {t("title")}
            </h1>
            <p className="mx-auto mt-5 max-w-3xl text-lg leading-8 text-[var(--muted)]">
              {t("intro")}
            </p>
          </header>

          <section className="mt-14">
            <h2 className="text-center text-3xl font-extrabold">
              {t("stepsTitle")}
            </h2>
            <div className="mt-8 grid gap-5 md:grid-cols-2 xl:grid-cols-3">
              {stepKeys.map((key, index) => (
                <article
                  key={key}
                  className="rounded-3xl border border-[var(--border)] bg-white p-7 shadow-lg shadow-[#001734]/5"
                >
                  <span className="inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-[var(--accent)] text-lg font-extrabold text-white">
                    {index + 1}
                  </span>
                  <h3 className="mt-5 text-2xl font-extrabold">
                    {t(`steps.${key}.title`)}
                  </h3>
                  <p className="mt-3 leading-7 text-[var(--muted)]">
                    {t(`steps.${key}.text`)}
                  </p>
                </article>
              ))}
            </div>
          </section>

          <section className="mt-16">
            <div className="text-center">
              <p className="eyebrow">{t("packagesEyebrow")}</p>
              <h2 className="mt-3 text-3xl font-extrabold sm:text-4xl">
                {t("packagesTitle")}
              </h2>
            </div>
            <div className="mx-auto mt-8 grid max-w-5xl gap-6 lg:grid-cols-2">
              <PackageCard
                title={t("free.title")}
                price={t("free.price")}
                description={t("free.description")}
                features={freeFeatureKeys.map((key) => t(`free.features.${key}`))}
              />
              <PackageCard
                premium
                title={t("premium.title")}
                price={t("premium.price")}
                description={t("premium.description")}
                features={premiumFeatureKeys.map((key) =>
                  t(`premium.features.${key}`),
                )}
              />
            </div>
          </section>

          <section className="mx-auto mt-16 max-w-4xl rounded-3xl border border-[#b8dcff] bg-[#eaf5ff] p-8 text-center sm:p-12">
            <h2 className="text-3xl font-extrabold">{t("reviewTitle")}</h2>
            <p className="mx-auto mt-4 max-w-2xl text-lg leading-8 text-[var(--muted)]">
              {t("reviewText")}
            </p>
          </section>

          <section className="mx-auto mt-8 max-w-4xl rounded-3xl border border-[#b9e4cc] bg-[#edf9f2] p-8 text-center sm:p-12">
            <p className="eyebrow">{t("verificationEyebrow")}</p>
            <h2 className="mt-3 text-3xl font-extrabold">
              {t("verificationTitle")}
            </h2>
            <p className="mx-auto mt-4 max-w-2xl text-lg leading-8 text-[var(--muted)]">
              {t("verificationText")}
            </p>
            <p className="mx-auto mt-4 max-w-2xl leading-7 text-[var(--muted)]">
              {t("verificationProofs")}
            </p>
            <p className="mx-auto mt-4 max-w-2xl text-sm font-bold leading-6 text-[var(--muted)]">
              {t("verificationNote")}
            </p>
            <a
              href="mailto:info@findelio.ch"
              className="primary-button mt-7 h-12 px-7"
            >
              {t("verificationCta")}
            </a>
          </section>

          <section className="mx-auto mt-12 max-w-4xl rounded-3xl bg-[var(--foreground)] p-8 text-center text-white sm:p-12">
            <h2 className="text-3xl font-extrabold">{t("ctaTitle")}</h2>
            <p className="mx-auto mt-4 max-w-2xl text-lg leading-8 text-white/75">
              {t("ctaText")}
            </p>
            <Link href="/firma-eintragen" className="primary-button mt-7 h-12 px-7">
              {t("ctaButton")}
            </Link>
          </section>
        </div>
      </main>
    </>
  );
}

function PackageCard({
  title,
  price,
  description,
  features,
  premium = false,
}: {
  title: string;
  price: string;
  description: string;
  features: string[];
  premium?: boolean;
}) {
  return (
    <article
      className={`rounded-3xl border p-8 ${
        premium
          ? "border-[#9dceff] bg-[#eaf5ff]"
          : "border-[var(--border)] bg-white"
      }`}
    >
      <h3 className="text-3xl font-extrabold">{title}</h3>
      <p className="mt-2 text-xl font-extrabold text-[var(--accent)]">{price}</p>
      <p className="mt-4 leading-7 text-[var(--muted)]">{description}</p>
      <ul className="mt-6 space-y-3">
        {features.map((feature) => (
          <li key={feature} className="flex gap-3 leading-6">
            <span className="font-extrabold text-[var(--accent)]" aria-hidden="true">
              ✓
            </span>
            <span>{feature}</span>
          </li>
        ))}
      </ul>
    </article>
  );
}
