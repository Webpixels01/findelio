import Image from "next/image";
import { unstable_rethrow } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { getCurrentUser } from "@/lib/auth";
import LanguageSwitcher from "./language-switcher";
import LogoutButton from "./logout-button";
import ShareButton from "./share-button";

function HomeIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      width="22"
      height="22"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="m3 10 9-7 9 7" />
      <path d="M5 9v11h14V9" />
      <path d="M9 20v-7h6v7" />
    </svg>
  );
}

async function getHeaderCurrentUser() {
  try {
    return await getCurrentUser();
  } catch (error) {
    unstable_rethrow(error);
    console.error("Anmeldestatus im Header konnte nicht geprüft werden:", error);
    return null;
  }
}

export default async function SiteHeader() {
  const [t, currentUser] = await Promise.all([
    getTranslations("Header"),
    getHeaderCurrentUser(),
  ]);
  const isAuthenticated = Boolean(currentUser);

  return (
    <header className="sticky top-0 z-50 border-b border-[var(--border)] bg-white/95 backdrop-blur-xl">
      <div className="site-container flex min-h-20 items-center justify-between gap-6">
        <Link href="/" aria-label={t("home")} className="shrink-0">
          <span className="relative block h-12 w-[161px] sm:h-[45px] sm:w-[150px]">
            <Image
              src="/findelio-logo-horizontal.svg"
              alt="Findelio"
              fill
              priority
              unoptimized
              sizes="(min-width: 640px) 150px, 130px"
              className="object-contain object-left"
            />
          </span>
        </Link>

        <nav className="hidden items-center gap-7 lg:flex" aria-label={t("navigation")}>
          <Link
            href="/"
            aria-label={t("home")}
            title={t("home")}
            className="inline-flex h-10 w-10 items-center justify-center rounded-xl transition-colors hover:bg-[var(--surface)] hover:text-[var(--accent)]"
          >
            <HomeIcon />
          </Link>
          <Link href="/unternehmen" className="nav-link">
            {t("findCompanies")}
          </Link>
          <Link href="/firma-eintragen" className="nav-link">
            {t("registerCompany")}
          </Link>
          {isAuthenticated ? (
            <>
              <Link href="/dashboard" className="nav-link">
                {t("dashboard")}
              </Link>
              <LogoutButton variant="nav" />
            </>
          ) : (
            <Link href="/login" className="nav-link">
              {t("login")}
            </Link>
          )}
          <ShareButton hideOnCompanyProfile />
          <LanguageSwitcher ariaLabel={t("selectLanguage")} />
        </nav>

        <details className="group relative lg:hidden">
          <summary className="flex h-11 w-11 cursor-pointer list-none items-center justify-center rounded-xl border border-[var(--border)] [&::-webkit-details-marker]:hidden">
            <span className="sr-only">{t("menu")}</span>
            <span className="relative h-5 w-5" aria-hidden="true">
              <span className="absolute left-0 top-1 block h-0.5 w-5 rounded bg-[var(--foreground)] transition duration-200 group-open:translate-y-[5px] group-open:rotate-45" />
              <span className="absolute left-0 top-[9px] block h-0.5 w-5 rounded bg-[var(--foreground)] transition duration-200 group-open:opacity-0" />
              <span className="absolute left-0 top-[14px] block h-0.5 w-5 rounded bg-[var(--foreground)] transition duration-200 group-open:-translate-y-[5px] group-open:-rotate-45" />
            </span>
          </summary>

          <div className="absolute right-0 mt-3 w-72 rounded-2xl border border-[var(--border)] bg-white p-4 shadow-2xl shadow-[#001734]/10">
            <nav className="flex flex-col gap-1" aria-label={t("navigation")}>
              <Link
                href="/"
                aria-label={t("home")}
                title={t("home")}
                className="inline-flex h-11 w-11 items-center justify-center rounded-xl transition-colors hover:bg-[var(--surface)] hover:text-[var(--accent)]"
              >
                <HomeIcon />
              </Link>
              <Link href="/unternehmen" className="mobile-nav-link">
                {t("findCompanies")}
              </Link>
              <Link href="/firma-eintragen" className="mobile-nav-link">
                {t("registerCompany")}
              </Link>
              {isAuthenticated ? (
                <>
                  <Link href="/dashboard" className="mobile-nav-link">
                    {t("dashboard")}
                  </Link>
                  <LogoutButton variant="mobile-nav" />
                </>
              ) : (
                <Link href="/login" className="mobile-nav-link">
                  {t("login")}
                </Link>
              )}
              <ShareButton variant="mobile" hideOnCompanyProfile />
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
