"use client";

import { useSyncExternalStore } from "react";
import { useTranslations } from "next-intl";
import { getDarkThemeSnapshot, getServerThemeSnapshot, subscribeTheme, toggleTheme } from "@/lib/theme";

export default function ThemeToggle() {
  const t = useTranslations("Header");
  const dark = useSyncExternalStore(subscribeTheme, getDarkThemeSnapshot, getServerThemeSnapshot);

  return (
    <button type="button" className="theme-toggle" onClick={toggleTheme}
      aria-label={t("darkMode")} aria-pressed={dark} title={t("darkMode")}>
      <svg className="theme-icon-moon" width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M20.9 13.1A9 9 0 0 1 10.9 3.1a9 9 0 1 0 10 10Z" />
      </svg>
      <svg className="theme-icon-sun" width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true">
        <circle cx="12" cy="12" r="4" />
        <path d="M12 2v2m0 16v2M2 12h2m16 0h2M4.93 4.93l1.41 1.41m11.32 11.32 1.41 1.41M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" />
      </svg>
    </button>
  );
}
