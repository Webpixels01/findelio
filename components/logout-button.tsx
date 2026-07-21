"use client";

import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useState } from "react";

export default function LogoutButton() {
  const t = useTranslations("Dashboard");
  const locale = useLocale();
  const router = useRouter();
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

      router.replace(`/${locale}/login`);
      router.refresh();
    } catch (error) {
      console.error(error);
      setIsLoading(false);
    }
  }

  return (
    <button
      type="button"
      className="primary-button h-11 px-5"
      onClick={handleLogout}
      disabled={isLoading}
    >
      {isLoading ? t("logoutLoading") : t("logout")}
    </button>
  );
}
