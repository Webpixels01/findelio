import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import SiteHeader from "@/components/site-header";
import type { AppLocale } from "@/i18n/routing";

type ImprintPageProps = {
  params: Promise<{ locale: AppLocale }>;
};

export async function generateMetadata({
  params,
}: ImprintPageProps): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "Legal" });

  return {
    title: t("imprintMetaTitle"),
    description: t("imprintMetaDescription"),
  };
}

export default async function ImprintPage({ params }: ImprintPageProps) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("Legal");

  return (
    <>
      <SiteHeader />
      <main className="page-shell bg-[var(--surface)] py-14 sm:py-20">
        <article className="site-container max-w-4xl">
          <p className="eyebrow">{t("legalEyebrow")}</p>
          <h1 className="mt-3 text-4xl font-extrabold tracking-tight sm:text-5xl">
            {t("imprintTitle")}
          </h1>
          <p className="mt-5 max-w-3xl text-lg leading-8 text-[var(--muted)]">
            {t("imprintIntro")}
          </p>

          <div className="mt-10 space-y-6">
            <section className="rounded-3xl border border-[var(--border)] bg-white p-7 sm:p-9">
              <h2 className="text-2xl font-extrabold">
                {t("operatorTitle")}
              </h2>
              <div className="mt-5 grid gap-7 sm:grid-cols-2">
                <address className="not-italic leading-7 text-[var(--muted)]">
                  <strong className="text-[var(--foreground)]">Webpixels</strong>
                  <br />
                  {t("owner")}: Jan Cabanik
                  <br />
                  Kirchgasse 13
                  <br />
                  8532 Warth
                  <br />
                  {t("switzerland")}
                </address>

                <dl className="space-y-3">
                  <div>
                    <dt className="text-sm font-bold text-[var(--muted)]">
                      {t("email")}
                    </dt>
                    <dd>
                      <a
                        href="mailto:info@findelio.ch"
                        className="font-bold text-[var(--accent)] hover:underline"
                      >
                        info@findelio.ch
                      </a>
                    </dd>
                  </div>
                  <div>
                    <dt className="text-sm font-bold text-[var(--muted)]">
                      {t("phone")}
                    </dt>
                    <dd>
                      <a
                        href="tel:+41766137772"
                        className="font-bold text-[var(--accent)] hover:underline"
                      >
                        +41 76 613 77 72
                      </a>
                    </dd>
                  </div>
                  <div>
                    <dt className="text-sm font-bold text-[var(--muted)]">
                      {t("website")}
                    </dt>
                    <dd>
                      <a
                        href="https://webpixels.ch/"
                        rel="noopener noreferrer"
                        target="_blank"
                        className="font-bold text-[var(--accent)] hover:underline"
                      >
                        webpixels.ch
                      </a>
                    </dd>
                  </div>
                </dl>
              </div>
            </section>

            <div className="grid gap-6 md:grid-cols-2">
              <LegalSection
                title={t("contentResponsibilityTitle")}
                text={t("contentResponsibilityText")}
              />
              <LegalSection
                title={t("liabilityTitle")}
                text={t("liabilityText")}
              />
              <LegalSection
                title={t("externalLinksTitle")}
                text={t("externalLinksText")}
              />
              <LegalSection
                title={t("copyrightTitle")}
                text={t("copyrightText")}
              />
            </div>
          </div>
        </article>
      </main>
    </>
  );
}

function LegalSection({ title, text }: { title: string; text: string }) {
  return (
    <section className="rounded-3xl border border-[var(--border)] bg-white p-7">
      <h2 className="text-xl font-extrabold">{title}</h2>
      <p className="mt-3 leading-7 text-[var(--muted)]">{text}</p>
    </section>
  );
}
