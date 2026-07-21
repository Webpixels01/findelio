import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";

export default async function SiteFooter() {
  const t = await getTranslations("Footer");

  return (
    <footer className="mt-auto border-t border-[var(--border)] bg-[#001734] text-white">
      <div className="site-container grid gap-10 py-12 md:grid-cols-[1.5fr_1fr_1fr]">
        <div>
          <p className="text-2xl font-extrabold tracking-tight">Findelio</p>
          <p className="mt-3 max-w-md text-white/70">{t("tagline")}</p>
        </div>
        <div>
          <p className="font-bold">{t("directory")}</p>
          <div className="mt-3 flex flex-col gap-2 text-white/70">
            <Link href="/unternehmen" className="hover:text-white">{t("findCompanies")}</Link>
            <Link href="/firma-eintragen" className="hover:text-white">{t("registerCompany")}</Link>
          </div>
        </div>
        <div>
          <p className="font-bold">{t("legal")}</p>
          <div className="mt-3 flex flex-col gap-2 text-white/70">
            <Link href="/impressum" className="hover:text-white">{t("imprint")}</Link>
            <Link href="/datenschutz" className="hover:text-white">{t("privacy")}</Link>
          </div>
        </div>
      </div>
      <div className="border-t border-white/10">
        <div className="site-container py-5 text-sm text-white/60">
          © {new Date().getFullYear()} Findelio. {t("copyright")}
        </div>
      </div>
    </footer>
  );
}
