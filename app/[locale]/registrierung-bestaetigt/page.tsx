import { getTranslations, setRequestLocale } from "next-intl/server";
import SiteHeader from "@/components/site-header";
import { Link } from "@/i18n/navigation";
import type { AppLocale } from "@/i18n/routing";
import { privatePageMetadata } from "@/lib/seo";

export const metadata = privatePageMetadata;

export default async function RegistrationConfirmedPage({
  params,
}: {
  params: Promise<{ locale: AppLocale }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("VerifyRegistration");

  return (
    <>
      <SiteHeader />
      <main className="page-shell bg-[var(--surface)] py-16">
        <div className="site-container max-w-xl">
          <div className="rounded-3xl border border-[#bfe4ca] bg-[#eefaf2] p-8 text-center text-[#135f30]">
            <h1 className="text-3xl font-extrabold">{t("successTitle")}</h1>
            <p className="mt-3 leading-7">{t("successText")}</p>
            <Link href="/login" className="primary-button mt-7 h-12 px-6">
              {t("loginButton")}
            </Link>
          </div>
        </div>
      </main>
    </>
  );
}
