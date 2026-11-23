import { Link } from "@/i18n/navigation";
import { Suspense } from "react";
import { getTranslations, setRequestLocale } from "next-intl/server";
import type { AppLocale } from "@/i18n/routing";
import SiteHeader from "@/components/site-header";
import LoginForm from "@/components/login-form";
import { privatePageMetadata } from "@/lib/seo";

export const metadata = privatePageMetadata;

export default async function LoginPage({ params }: { params: Promise<{ locale: AppLocale }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("Login");
  const tv = await getTranslations("Visitor");
  const tn = await getTranslations("Header");

  return (
    <>
      <SiteHeader />
      <main className="page-shell bg-[var(--surface)] py-16">
        <div className="site-container max-w-lg">
          <div className="text-center">
            <p className="eyebrow">{tv("account")}</p>
            <h1 className="mt-3 text-4xl font-extrabold tracking-tight">{t("title")}</h1>
            <p className="mt-4 text-lg text-[var(--muted)]">{tv("loginDescription")}</p>
          </div>
          <div className="mt-9">
            <Suspense
              fallback={
                <div className="h-80 animate-pulse rounded-3xl border border-[var(--border)] bg-white" />
              }
            >
              <LoginForm />
            </Suspense>
            <div className="mt-5 flex flex-wrap gap-3">
              <Link href="/firma-eintragen" className="secondary-button px-6 py-3">{tn("registerCompany")}</Link>
              <Link href="/registrieren" className="secondary-button px-6 py-3">{tv("register")}</Link>
            </div>
          </div>
        </div>
      </main>
    </>
  );
}
