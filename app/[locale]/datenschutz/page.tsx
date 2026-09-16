import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import SiteHeader from "@/components/site-header";
import type { AppLocale } from "@/i18n/routing";
import { buildPageMetadata } from "@/lib/seo";

type PrivacyPageProps = {
  params: Promise<{ locale: AppLocale }>;
};

export async function generateMetadata({
  params,
}: PrivacyPageProps): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "Legal" });

  return buildPageMetadata({
    locale,
    path: "/datenschutz",
    title: t("privacyMetaTitle"),
    description: t("privacyMetaDescription"),
  });
}

export default async function PrivacyPage({ params }: PrivacyPageProps) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("Legal");
  const tg = await getTranslations("Growth.statistics");

  const dataItems = [
    t("technicalData"),
    t("accountData"),
    t("listingData"),
    t("contactData"),
  ];

  return (
    <>
      <SiteHeader />
      <main className="page-shell bg-[var(--surface)] py-14 sm:py-20">
        <article className="site-container max-w-4xl">
          <p className="eyebrow">{t("legalEyebrow")}</p>
          <h1 className="mt-3 text-4xl font-extrabold tracking-tight sm:text-5xl">
            {t("privacyTitle")}
          </h1>
          <p className="mt-5 text-sm font-bold text-[var(--muted)]">
            {t("lastUpdated")}
          </p>
          <p className="mt-5 max-w-3xl text-lg leading-8 text-[var(--muted)]">
            {t("privacyIntro")}
          </p>

          <div className="mt-10 space-y-6">
            <PrivacySection title={t("controllerTitle")}>
              <p>{t("controllerText")}</p>
              <address className="mt-4 not-italic">
                <strong className="text-[var(--foreground)]">Webpixels</strong>
                <br />
                Jan Cabanik, Kirchgasse 13, 8532 Warth, {t("switzerland")}
                <br />
                <a
                  href="mailto:info@findelio.ch"
                  className="font-bold text-[var(--accent)] hover:underline"
                >
                  info@findelio.ch
                </a>
              </address>
            </PrivacySection>

            <PrivacySection title={t("processedDataTitle")}>
              <p>{t("processedDataIntro")}</p>
              <ul className="mt-4 list-disc space-y-3 pl-6">
                {dataItems.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </PrivacySection>

            <PrivacySection title={t("purposesTitle")}>
              <p>{t("purposesText")}</p>
            </PrivacySection>

            <PrivacySection title={t("legalBasisTitle")}>
              <p>{t("legalBasisText")}</p>
            </PrivacySection>

            <PrivacySection title={t("cookiesTitle")}>
              <p>{t("cookiesText")}</p>
            </PrivacySection>

            <PrivacySection title={t("recipientsTitle")}>
              <p>{t("recipientsText")}</p>
            </PrivacySection>

            <PrivacySection title={t("retentionTitle")}>
              <p>{t("retentionText")}</p>
            </PrivacySection>

            <PrivacySection title={t("securityTitle")}>
              <p>{t("securityText")}</p>
            </PrivacySection>

            <PrivacySection title={t("rightsTitle")}>
              <p>{t("rightsText")}</p>
            </PrivacySection>

            <PrivacySection title={t("thirdPartyTitle")}>
              <p>{t("thirdPartyText")}</p>
            </PrivacySection>

            <PrivacySection title={tg("privacyTitle")}>
              <p>{tg("privacyText")}</p>
            </PrivacySection>

            <PrivacySection title={t("changesTitle")}>
              <p>{t("changesText")}</p>
            </PrivacySection>
          </div>
        </article>
      </main>
    </>
  );
}

function PrivacySection({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-3xl border border-[var(--border)] bg-white p-7 sm:p-9">
      <h2 className="text-2xl font-extrabold">{title}</h2>
      <div className="mt-4 leading-7 text-[var(--muted)]">{children}</div>
    </section>
  );
}
