import { Suspense } from "react";
import { getTranslations, setRequestLocale } from "next-intl/server";
import type { AppLocale } from "@/i18n/routing";
import SiteHeader from "@/components/site-header";
import LoginForm from "@/components/login-form";

export default async function LoginPage({ params }: { params: Promise<{ locale: AppLocale }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("Login");

  return (
    <>
      <SiteHeader />
      <main className="page-shell bg-[var(--surface)] py-16">
        <div className="site-container max-w-lg">
          <div className="text-center">
            <p className="eyebrow">{t("eyebrow")}</p>
            <h1 className="mt-3 text-4xl font-extrabold tracking-tight">{t("title")}</h1>
            <p className="mt-4 text-lg text-[var(--muted)]">{t("description")}</p>
          </div>
          <div className="mt-9">
            <Suspense
              fallback={
                <div className="h-80 animate-pulse rounded-3xl border border-[var(--border)] bg-white" />
              }
            >
              <LoginForm />
            </Suspense>
          </div>
        </div>
      </main>
    </>
  );
}
