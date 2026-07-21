import { getTranslations, setRequestLocale } from "next-intl/server";
import type { AppLocale } from "@/i18n/routing";
import SiteHeader from "@/components/site-header";

export default async function ImprintPage({ params }: { params: Promise<{ locale: AppLocale }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("Legal");
  return <><SiteHeader /><main className="page-shell py-16"><article className="site-container max-w-3xl"><h1 className="text-4xl font-extrabold">{t("imprintTitle")}</h1><p className="mt-6 text-lg leading-8 text-[var(--muted)]">{t("imprintText")}</p></article></main></>;
}
