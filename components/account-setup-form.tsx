"use client";

import type { FormEvent } from "react";
import { useState } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";

type SetupResult = {
  success?: boolean;
  error?: string;
  organization?: {
    id?: string;
  };
};

export default function AccountSetupForm() {
  const t = useTranslations("AccountSetup");
  const router = useRouter();
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  function getErrorMessage(code?: string): string {
    const knownCodes = new Set([
      "invalid_data",
      "unauthorized",
      "forbidden",
      "create_failed",
    ]);

    return knownCodes.has(code ?? "")
      ? t(`errors.${code}`)
      : t("errors.create_failed");
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setIsSubmitting(true);

    try {
      const response = await fetch("/api/account/organizations", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ name }),
      });
      const result = (await response.json()) as SetupResult;

      if (response.status === 409 && result.error === "already_configured") {
        router.replace("/dashboard/firmenprofile/neu?onboarding=1");
        router.refresh();
        return;
      }

      if (!response.ok || !result.success || !result.organization?.id) {
        setError(getErrorMessage(result.error));
        return;
      }

      router.replace("/dashboard/firmenprofile/neu?onboarding=1");
      router.refresh();
    } catch {
      setError(t("errors.network"));
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form
      className="mt-8 rounded-3xl border border-[var(--border)] bg-white p-6 shadow-xl shadow-[#001734]/6 sm:p-8"
      onSubmit={handleSubmit}
    >
      <h2 className="text-2xl font-extrabold">{t("sectionTitle")}</h2>
      <p className="mt-3 text-[var(--muted)]">{t("sectionDescription")}</p>

      <label className="field-group mt-6">
        <span className="field-label">{t("companyName")}</span>
        <input
          className="field-control"
          name="name"
          autoComplete="organization"
          maxLength={255}
          required
          value={name}
          onChange={(event) => setName(event.target.value)}
          disabled={isSubmitting}
        />
        <span className="text-sm text-[var(--muted)]">
          {t("companyNameHint")}
        </span>
      </label>

      <div className="mt-7 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div aria-live="polite">
          {error && (
            <p className="font-bold text-[#b42318]" role="alert">
              {error}
            </p>
          )}
        </div>

        <button
          type="submit"
          className="primary-button h-12 px-7"
          disabled={isSubmitting}
        >
          {isSubmitting ? t("submitting") : t("submit")}
        </button>
      </div>
    </form>
  );
}
