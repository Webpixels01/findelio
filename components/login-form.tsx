"use client";

import type { FormEvent } from "react";
import { useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { useRouter, useSearchParams } from "next/navigation";

function getSafeDestination(value: string | null, locale: string): string {
  if (
    value &&
    value.startsWith(`/${locale}/`) &&
    !value.startsWith("//") &&
    !value.includes("\\")
  ) {
    return value;
  }

  return `/${locale}/dashboard`;
}

export default function LoginForm() {
  const t = useTranslations("Login");
  const locale = useLocale();
  const router = useRouter();
  const searchParams = useSearchParams();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    setError("");
    setIsLoading(true);

    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email, password }),
      });

      const result = (await response.json()) as {
        success?: boolean;
      };

      if (!response.ok || !result.success) {
        setError(
          response.status >= 500 ? t("serverError") : t("errorFallback"),
        );
        return;
      }

      const destination = getSafeDestination(searchParams.get("next"), locale);
      router.replace(destination);
      router.refresh();
    } catch {
      setError(t("connectionError"));
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <form
      className="rounded-3xl border border-[var(--border)] bg-white p-7 shadow-xl shadow-[#001734]/6"
      onSubmit={handleSubmit}
    >
      <label className="field-group">
        <span className="field-label">{t("email")}</span>
        <input
          type="email"
          name="email"
          autoComplete="email"
          required
          className="field-control"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          disabled={isLoading}
        />
      </label>

      <label className="field-group mt-5">
        <span className="field-label">{t("password")}</span>
        <input
          type="password"
          name="password"
          autoComplete="current-password"
          required
          className="field-control"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          disabled={isLoading}
        />
      </label>

      <button
        type="submit"
        className="primary-button mt-6 h-12 w-full px-6"
        disabled={isLoading}
      >
        {isLoading ? t("loading") : t("submit")}
      </button>

      {error && (
        <p
          className="mt-4 rounded-xl bg-red-50 p-3 text-sm text-red-700"
          role="alert"
        >
          {error}
        </p>
      )}

      <p className="mt-5 text-center text-sm text-[var(--muted)]">
        {t("note")}
      </p>
    </form>
  );
}
