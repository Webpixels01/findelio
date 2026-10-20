import { hasLocale } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import SiteHeader from "@/components/site-header";
import TwoFactorSettings from "@/components/two-factor-settings";
import { Link } from "@/i18n/navigation";
import { routing } from "@/i18n/routing";
import { getAccessToken, requireCurrentUser } from "@/lib/auth";
import { directusTwoFactor, type TwoFactorStatus } from "@/lib/two-factor";
import { privatePageMetadata } from "@/lib/seo";

export const metadata = privatePageMetadata;

export default async function SecurityPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);
  await requireCurrentUser({ locale, nextPath: `/${locale}/konto/sicherheit` });
  const [t, status] = await Promise.all([
    getTranslations("TwoFactor"),
    directusTwoFactor<TwoFactorStatus>((await getAccessToken())!),
  ]);
  return <>
    <SiteHeader />
    <main className="page-shell bg-[var(--surface)] py-10 sm:py-12">
      <div className="site-container max-w-2xl">
        <Link href="/dashboard" className="text-sm font-bold text-[var(--muted)]">{t("back")}</Link>
        <h1 className="mt-5 text-3xl font-extrabold tracking-tight">{t("title")}</h1>
        <p className="mt-3 text-[var(--muted)]">{t("description")}</p>
        <TwoFactorSettings status={status} />
      </div>
    </main>
  </>;
}
