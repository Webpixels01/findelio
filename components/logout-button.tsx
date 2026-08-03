"use client";

import { useLocale, useTranslations } from "next-intl";
import { useState } from "react";

type LogoutButtonProps = {
  variant?: "primary" | "nav" | "mobile-nav";
};

const variantClasses: Record<NonNullable<LogoutButtonProps["variant"]>, string> = {
  primary: "primary-button h-11 px-5",
  nav: "nav-link cursor-pointer border-0 bg-transparent p-0 disabled:cursor-wait disabled:opacity-60",
  "mobile-nav": "mobile-nav-link w-full cursor-pointer border-0 bg-transparent text-left disabled:cursor-wait disabled:opacity-60",
};

export default function LogoutButton({
  variant = "primary",
}: LogoutButtonProps) {
  const t = useTranslations("Dashboard");
  const locale = useLocale();
  const [isLoading, setIsLoading] = useState(false);

  async function handleLogout() {
    setIsLoading(true);

    try {
      const response = await fetch("/api/auth/logout", {
        method: "POST",
      });

      if (!response.ok) {
        throw new Error("Logout fehlgeschlagen.");
      }

      window.location.assign(`/${locale}/login`);
    } catch (error) {
      console.error(error);
      setIsLoading(false);
    }
  }

  return (
    <button
      type="button"
      className={variantClasses[variant]}
      onClick={handleLogout}
      disabled={isLoading}
      aria-busy={isLoading}
    >
      {isLoading ? t("logoutLoading") : t("logout")}
    </button>
  );
}
