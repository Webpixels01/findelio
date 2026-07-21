"use client";

import { useLocale } from "next-intl";
import { usePathname, useRouter } from "@/i18n/navigation";
import { routing, type AppLocale } from "@/i18n/routing";

const labels: Record<AppLocale, string> = {
  "de-ch": "DE",
  en: "EN",
  sk: "SK",
  cs: "CS",
  hu: "HU",
  pl: "PL",
  ru: "RU",
  "pt-pt": "PT",
  ro: "RO",
};

export default function LanguageSwitcher({ ariaLabel }: { ariaLabel: string }) {
  const locale = useLocale() as AppLocale;
  const pathname = usePathname();
  const router = useRouter();

  return (
    <label className="relative">
      <span className="sr-only">{ariaLabel}</span>
      <select
        value={locale}
        onChange={(event) => {
          router.replace(pathname, {
            locale: event.target.value as AppLocale,
          });
        }}
        className="h-11 cursor-pointer rounded-xl border border-[var(--border)] bg-white px-3 pr-8 text-sm font-bold text-[var(--foreground)] outline-none transition hover:border-[var(--accent)] focus:border-[var(--accent)]"
        aria-label={ariaLabel}
      >
        {routing.locales.map((item) => (
          <option key={item} value={item}>
            {labels[item]}
          </option>
        ))}
      </select>
    </label>
  );
}
