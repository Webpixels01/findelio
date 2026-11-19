import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import ContactForm from "@/components/contact-form";
import SiteHeader from "@/components/site-header";
import type { AppLocale } from "@/i18n/routing";
import { buildPageMetadata } from "@/lib/seo";

type ContactPageProps = {
  params: Promise<{ locale: AppLocale }>;
};

export async function generateMetadata({
  params,
}: ContactPageProps): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "Contact" });

  return buildPageMetadata({
    locale,
    path: "/kontakt",
    title: t("metaTitle"),
    description: t("metaDescription"),
  });
}

export default async function ContactPage({ params }: ContactPageProps) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("Contact");

  return (
    <>
      <SiteHeader />
      <main className="page-shell bg-[var(--surface)] py-14 sm:py-20">
        <div className="site-container">
          <div className="max-w-3xl">
            <p className="eyebrow">{t("eyebrow")}</p>
            <h1 className="mt-3 text-4xl font-extrabold tracking-tight sm:text-5xl">
              {t("title")}
            </h1>
            <p className="mt-5 text-lg leading-8 text-[var(--muted)]">
              {t("description")}
            </p>
          </div>

          <div className="mt-10 grid gap-8 lg:grid-cols-[minmax(0,1fr)_340px]">
            <ContactForm locale={locale} />

            <aside className="space-y-6">
              <section className="rounded-3xl border border-[var(--border)] bg-white p-7">
                <h2 className="text-2xl font-extrabold">
                  {t("directTitle")}
                </h2>
                <p className="mt-3 leading-7 text-[var(--muted)]">
                  {t("directText")}
                </p>

                <dl className="mt-6 space-y-5">
                  <div>
                    <dt className="text-sm font-bold text-[var(--muted)]">
                      {t("fields.email")}
                    </dt>
                    <dd className="mt-1">
                      <a
                        className="font-bold text-[var(--accent)] hover:underline"
                        href="mailto:info@findelio.ch"
                      >
                        info@findelio.ch
                      </a>
                    </dd>
                  </div>
                  <div>
                    <dt className="text-sm font-bold text-[var(--muted)]">
                      {t("fields.phoneLabel")}
                    </dt>
                    <dd className="mt-1">
                      <a
                        className="font-bold text-[var(--accent)] hover:underline"
                        href="tel:+41766137772"
                      >
                        +41 76 613 77 72
                      </a>
                    </dd>
                  </div>
                </dl>
              </section>

              <section className="rounded-3xl border border-[#b7dafc] bg-[#eef7ff] p-7">
                <h2 className="text-xl font-extrabold">{t("onlineTitle")}</h2>
                <p className="mt-3 leading-7 text-[var(--muted)]">
                  {t("onlineText")}
                </p>
              </section>
            </aside>
          </div>
        </div>
      </main>
    </>
  );
}
