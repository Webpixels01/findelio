import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import SiteHeader from "@/components/site-header";
import { Link } from "@/i18n/navigation";
import type { AppLocale } from "@/i18n/routing";
import { buildPageMetadata } from "@/lib/seo";

type CookiePageProps = {
  params: Promise<{ locale: AppLocale }>;
};

export async function generateMetadata({
  params,
}: CookiePageProps): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "CookiePolicy" });

  return buildPageMetadata({
    locale,
    path: "/cookies",
    title: t("metaTitle"),
    description: t("metaDescription"),
  });
}

export default async function CookiePage({ params }: CookiePageProps) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("CookiePolicy");

  const cookies = [
    {
      name: "findelio_access_token",
      purpose: t("cookies.access.purpose"),
      duration: t("cookies.access.duration"),
    },
    {
      name: "findelio_refresh_token",
      purpose: t("cookies.refresh.purpose"),
      duration: t("cookies.refresh.duration"),
    },
    {
      name: "NEXT_LOCALE",
      purpose: t("cookies.locale.purpose"),
      duration: t("cookies.locale.duration"),
    },
  ];

  return (
    <>
      <SiteHeader />
      <main className="page-shell bg-[var(--surface)] py-14 sm:py-20">
        <article className="site-container max-w-4xl">
          <p className="eyebrow">{t("eyebrow")}</p>
          <h1 className="mt-3 text-4xl font-extrabold tracking-tight sm:text-5xl">
            {t("title")}
          </h1>
          <p className="mt-5 text-sm font-bold text-[var(--muted)]">
            {t("lastUpdated")}
          </p>
          <p className="mt-5 max-w-3xl text-lg leading-8 text-[var(--muted)]">
            {t("intro")}
          </p>

          <div className="mt-10 space-y-6">
            <CookieSection title={t("necessaryTitle")}>
              <p>{t("necessaryText")}</p>
            </CookieSection>

            <CookieSection title={t("analyticsTitle")}>
              <p>{t("analyticsText")}</p>
            </CookieSection>

            <CookieSection title={t("inventoryTitle")}>
              <p>{t("inventoryText")}</p>
              <div className="mt-6 grid gap-4">
                {cookies.map((cookie) => (
                  <article
                    key={cookie.name}
                    className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5"
                  >
                    <h3 className="break-all font-mono text-sm font-bold text-[var(--foreground)] sm:text-base">
                      {cookie.name}
                    </h3>
                    <dl className="mt-4 grid gap-4 sm:grid-cols-2">
                      <div>
                        <dt className="text-sm font-extrabold text-[var(--foreground)]">
                          {t("purposeLabel")}
                        </dt>
                        <dd className="mt-1">{cookie.purpose}</dd>
                      </div>
                      <div>
                        <dt className="text-sm font-extrabold text-[var(--foreground)]">
                          {t("durationLabel")}
                        </dt>
                        <dd className="mt-1">{cookie.duration}</dd>
                      </div>
                    </dl>
                  </article>
                ))}
              </div>
            </CookieSection>

            <CookieSection title={t("storageTitle")}>
              <p>{t("storageText")}</p>
              <dl className="mt-5 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5">
                <dt className="break-all font-mono text-sm font-bold text-[var(--foreground)] sm:text-base">
                  findelio_cookie_notice_v2
                </dt>
                <dd className="mt-3">{t("storagePurpose")}</dd>
                <dd className="mt-2 text-sm font-bold text-[var(--foreground)]">
                  {t("storageDuration")}
                </dd>
                <dt className="mt-6 break-all font-mono text-sm font-bold text-[var(--foreground)] sm:text-base">
                  findelio_analytics_consent_v1
                </dt>
                <dd className="mt-3">{t("storagePurpose")}</dd>
              </dl>
            </CookieSection>

            <CookieSection title={t("controlTitle")}>
              <p>{t("controlText")}</p>
            </CookieSection>

            <CookieSection title={t("privacyTitle")}>
              <p>{t("privacyText")}</p>
              <Link
                href="/datenschutz"
                className="mt-4 inline-flex min-h-11 items-center font-extrabold text-[var(--accent)] underline decoration-2 underline-offset-4 hover:text-[var(--foreground)]"
              >
                {t("privacyLink")}
              </Link>
            </CookieSection>
          </div>
        </article>
      </main>
    </>
  );
}

function CookieSection({
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
