"use client";

import { useTranslations } from "next-intl";
import { Link, usePathname } from "@/i18n/navigation";

const navigationItems = [
  { href: "/dashboard", label: "overview" },
  { href: "/dashboard/organisationen", label: "organizations" },
  { href: "/dashboard/firmenprofile", label: "listings" },
  { href: "/dashboard/team", label: "team" },
] as const;

export default function DashboardNav() {
  const t = useTranslations("Dashboard.navigation");
  const pathname = usePathname();

  return (
    <nav
      className="overflow-x-auto rounded-2xl border border-[var(--border)] bg-white p-2 shadow-lg shadow-[#001734]/5"
      aria-label={t("label")}
    >
      <div className="flex min-w-max gap-1">
        {navigationItems.map((item) => {
          const isActive =
            item.href === "/dashboard"
              ? pathname === item.href
              : pathname.startsWith(item.href);

          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={isActive ? "page" : undefined}
              className={`rounded-xl px-4 py-3 text-sm font-extrabold transition-colors ${
                isActive
                  ? "bg-[var(--foreground)] text-white"
                  : "text-[var(--muted)] hover:bg-[var(--surface)] hover:text-[var(--foreground)]"
              }`}
            >
              {t(item.label)}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
