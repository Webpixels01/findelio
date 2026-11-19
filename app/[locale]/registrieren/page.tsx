import { getTranslations, setRequestLocale } from "next-intl/server";
import RegisterForm from "@/components/register-form";
import SiteHeader from "@/components/site-header";
import { privatePageMetadata } from "@/lib/seo";
export const metadata = privatePageMetadata;
export default async function VisitorRegistration({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("Visitor");
  return <><SiteHeader /><main className="page-shell bg-[var(--surface)] py-12"><div className="site-container max-w-2xl"><h1 className="mb-4 text-3xl font-extrabold">{t("register")}</h1><p className="mb-8 text-[var(--muted)]">{t("verification")}</p><RegisterForm visitor /></div></main></>;
}
