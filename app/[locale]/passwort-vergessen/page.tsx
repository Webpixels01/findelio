import { Suspense } from "react";
import { getTranslations, setRequestLocale } from "next-intl/server";
import type { AppLocale } from "@/i18n/routing";
import SiteHeader from "@/components/site-header";
import PasswordResetForm from "@/components/password-reset-form";
import { privatePageMetadata } from "@/lib/seo";
export const metadata = { ...privatePageMetadata, referrer: "no-referrer" as const };
export default async function PasswordPage({ params }: { params: Promise<{ locale: AppLocale }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("PasswordReset");
  return <><SiteHeader /><main className="page-shell bg-[var(--surface)] py-16"><div className="site-container max-w-lg">
    <h1 className="text-3xl font-extrabold">{t("title")}</h1><p className="my-5 text-[var(--muted)]">{t("description")}</p>
    <Suspense fallback={<p>{t("busy")}</p>}><PasswordResetForm  /></Suspense>
  </div></main></>;
}
