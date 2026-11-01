import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import SiteHeader from "@/components/site-header";
import type { AppLocale } from "@/i18n/routing";
import { buildPageMetadata } from "@/lib/seo";

type TermsPageProps = {
  params: Promise<{ locale: AppLocale }>;
};

const sectionKeys = [
  "scope",
  "services",
  "accounts",
  "content",
  "review",
  "verification",
  "packages",
  "contract",
  "cancellation",
  "availability",
  "liability",
  "termination",
  "privacy",
  "changes",
  "law",
] as const;

export async function generateMetadata({
  params,
}: TermsPageProps): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "Terms" });

  return buildPageMetadata({
    locale,
    path: "/agb",
    title: t("metaTitle"),
    description: t("metaDescription"),
  });
}

export default async function TermsPage({ params }: TermsPageProps) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("Terms");

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

          <div className="mt-10 space-y-5">
            {sectionKeys.map((key, index) => {
              const translationKey =
                key === "verification" ? key : `sections.${key}`;

              return (
                <section
                  key={key}
                  className="rounded-3xl border border-[var(--border)] bg-white p-7 sm:p-9"
                >
                  <h2 className="text-2xl font-extrabold">
                    {index + 1}. {t(`${translationKey}.title`)}
                  </h2>
                  <p className="mt-4 whitespace-pre-line leading-7 text-[var(--muted)]">
                    {t(`${translationKey}.body`)}
                  </p>
                </section>
              );
            })}
          </div>

          <p className="mt-8 leading-7 text-[var(--muted)]">
            {t("contact")}{" "}
            <a
              href="mailto:info@findelio.ch"
              className="font-bold text-[var(--accent)] hover:underline"
            >
              info@findelio.ch
            </a>
          </p>
        </article>
      </main>
    </>
  );
}
