import Image from "next/image";
import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { getAccessToken, getRefreshToken } from "@/lib/auth";
import LanguageSwitcher from "./language-switcher";

export default async function SiteHeader() {
  const [t, accessToken, refreshToken] = await Promise.all([
    getTranslations("Header"),
    getAccessToken(),
    getRefreshToken(),
  ]);
  const hasSession = Boolean(accessToken || refreshToken);
  const accountHref = hasSession ? "/dashboard" : "/login";
  const accountLabel = hasSession ? t("dashboard") : t("login");

  return (
    <header className="sticky top-0 z-50 border-b border-[var(--border)] bg-white/95 backdrop-blur-xl">
      <div className="site-container flex min-h-20 items-center justify-between gap-6">
        <Link href="/" aria-label={t("home")} className="shrink-0">
          <span className="relative block h-10 w-[168px] sm:h-11 sm:w-[185px]">
            <Image
              src="/findelio-logo-horizontal.svg"
              alt="Findelio"
              fill
              priority
              unoptimized
              sizes="185px"
              className="object-contain object-left"
            />
          </span>
        </Link>

        <nav className="hidden items-center gap-7 lg:flex" aria-label={t("navigation")}>
          <Link href="/unternehmen" className="nav-link">
            {t("findCompanies")}
          </Link>
          <Link href="/firma-eintragen" className="nav-link">
            {t("registerCompany")}
          </Link>
          <Link href={accountHref} className="nav-link">
            {accountLabel}
          </Link>
          <LanguageSwitcher ariaLabel={t("selectLanguage")} />
        </nav>

        <details className="group relative lg:hidden">
          <summary className="flex h-11 w-11 cursor-pointer list-none items-center justify-center rounded-xl border border-[var(--border)] [&::-webkit-details-marker]:hidden">
            <span className="sr-only">{t("menu")}</span>
            <span className="flex w-5 flex-col gap-1.5" aria-hidden="true">
              <span className="h-0.5 rounded bg-[var(--foreground)]" />
              <span className="h-0.5 rounded bg-[var(--foreground)]" />
              <span className="h-0.5 rounded bg-[var(--foreground)]" />
            </span>
          </summary>

          <div className="absolute right-0 mt-3 w-72 rounded-2xl border border-[var(--border)] bg-white p-4 shadow-2xl shadow-[#001734]/10">
            <nav className="flex flex-col gap-1" aria-label={t("navigation")}>
              <Link href="/unternehmen" className="mobile-nav-link">
                {t("findCompanies")}
              </Link>
              <Link href="/firma-eintragen" className="mobile-nav-link">
                {t("registerCompany")}
              </Link>
              <Link href={accountHref} className="mobile-nav-link">
                {accountLabel}
              </Link>
              <div className="mt-3 border-t border-[var(--border)] pt-3">
                <LanguageSwitcher ariaLabel={t("selectLanguage")} />
              </div>
            </nav>
          </div>
        </details>
      </div>
    </header>
  );
}
