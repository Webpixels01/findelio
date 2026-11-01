import { getTranslations, setRequestLocale } from "next-intl/server";
import { requireCurrentUser } from "@/lib/auth";
import type { AppLocale } from "@/i18n/routing";
import { Link } from "@/i18n/navigation";
import SiteHeader from "@/components/site-header";
import { privatePageMetadata } from "@/lib/seo";
export const metadata = privatePageMetadata;
export default async function VisitorAccount({ params }: { params: Promise<{ locale: AppLocale }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  await requireCurrentUser({ locale, nextPath: `/${locale}/konto` });
  const t = await getTranslations("Visitor");
  return <><SiteHeader /><main className="page-shell bg-[var(--surface)] py-12"><div className="site-container max-w-2xl"><h1 className="text-3xl font-extrabold">{t("account")}</h1><p className="my-6">{t("ready")}</p><div className="flex flex-wrap gap-3"><Link href="/unternehmen" className="primary-button px-8 py-4">{t("browse")}</Link><Link href="/konto/sicherheit" className="secondary-button px-6 py-3">{t("security")}</Link></div></div></main></>;
}
