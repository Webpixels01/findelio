import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import type { AppLocale } from "@/i18n/routing";
import SiteHeader from "@/components/site-header";
import RegisterForm from "@/components/register-form";
import { buildPageMetadata } from "@/lib/seo";

type RegisterPageProps = {
  params: Promise<{ locale: AppLocale }>;
};

export async function generateMetadata({
  params,
}: RegisterPageProps): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "Register" });

  return buildPageMetadata({
    locale,
    path: "/firma-eintragen",
    title: `${t("title")} | Findelio`,
    description: t("description"),
  });
}

export default async function RegisterPage({
  params,
}: RegisterPageProps) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("Register");

  return (
    <>
      <SiteHeader />
      <main className="page-shell bg-[var(--surface)] py-12 lg:py-16">
        <div className="site-container max-w-3xl">
          <div className="text-center">
            <p className="eyebrow">{t("eyebrow")}</p>
            <h1 className="mt-3 text-4xl font-extrabold tracking-tight sm:text-5xl">
              {t("title")}
            </h1>
            <p className="mx-auto mt-4 max-w-2xl text-lg leading-8 text-[var(--muted)]">
              {t("description")}
            </p>
          </div>
          <div className="mt-9">
            <RegisterForm />
          </div>
        </div>
      </main>
    </>
  );
}
