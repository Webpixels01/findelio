"use client";

import { FormEvent, useState } from "react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import type { AppLocale } from "@/i18n/routing";

type ContactFormProps = {
  locale: AppLocale;
};

export default function ContactForm({ locale }: ContactFormProps) {
  const t = useTranslations("Contact");
  const [status, setStatus] = useState<
    "idle" | "submitting" | "success" | "error"
  >("idle");

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus("submitting");

    const form = event.currentTarget;
    const formData = new FormData(form);

    try {
      const response = await fetch("/api/contact", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: formData.get("name"),
          email: formData.get("email"),
          phone: formData.get("phone"),
          subject: formData.get("subject"),
          message: formData.get("message"),
          privacyAccepted: formData.get("privacy") === "on",
          website: formData.get("website"),
          locale,
        }),
      });

      if (!response.ok) {
        setStatus("error");
        return;
      }

      form.reset();
      setStatus("success");
    } catch {
      setStatus("error");
    }
  }

  return (
    <form
      className="rounded-3xl border border-[var(--border)] bg-white p-6 shadow-sm sm:p-8"
      onSubmit={handleSubmit}
    >
      <div className="grid gap-5 sm:grid-cols-2">
        <label className="field-group">
          <span className="field-label">{t("fields.name")}</span>
          <input
            className="field-control"
            type="text"
            name="name"
            autoComplete="name"
            maxLength={120}
            required
          />
        </label>

        <label className="field-group">
          <span className="field-label">{t("fields.email")}</span>
          <input
            className="field-control"
            type="email"
            name="email"
            autoComplete="email"
            maxLength={254}
            required
          />
        </label>

        <label className="field-group">
          <span className="field-label">{t("fields.phone")}</span>
          <input
            className="field-control"
            type="tel"
            name="phone"
            autoComplete="tel"
            maxLength={50}
          />
        </label>

        <label className="field-group">
          <span className="field-label">{t("fields.subject")}</span>
          <select className="field-control" name="subject" required>
            <option value="general">{t("subjects.general")}</option>
            <option value="listing">{t("subjects.listing")}</option>
            <option value="account">{t("subjects.account")}</option>
            <option value="partnership">{t("subjects.partnership")}</option>
            <option value="other">{t("subjects.other")}</option>
          </select>
        </label>
      </div>

      <label className="field-group mt-5">
        <span className="field-label">{t("fields.message")}</span>
        <textarea
          className="field-control field-textarea min-h-44"
          name="message"
          minLength={20}
          maxLength={5000}
          required
        />
        <span className="text-sm text-[var(--muted)]">{t("messageHint")}</span>
      </label>

      <div
        className="absolute -left-[10000px] top-auto h-px w-px overflow-hidden"
        aria-hidden="true"
      >
        <label>
          Website
          <input
            type="text"
            name="website"
            tabIndex={-1}
            autoComplete="off"
          />
        </label>
      </div>

      <label className="mt-5 flex items-start gap-3 text-sm leading-6 text-[var(--muted)]">
        <input
          className="mt-1 h-4 w-4 shrink-0 accent-[var(--accent)]"
          type="checkbox"
          name="privacy"
          required
        />
        <span>
          {t.rich("privacyConsent", {
            privacyLink: (chunks) => (
              <Link
                href="/datenschutz"
                locale={locale}
                className="font-bold text-[var(--accent)] hover:underline"
              >
                {chunks}
              </Link>
            ),
          })}
        </span>
      </label>

      <div className="mt-7 flex flex-col items-start gap-4 sm:flex-row sm:items-center">
        <button
          type="submit"
          className="primary-button min-h-12 px-7 disabled:cursor-wait disabled:opacity-70"
          disabled={status === "submitting"}
        >
          {status === "submitting" ? t("sending") : t("send")}
        </button>

        <div className="text-sm font-semibold" aria-live="polite">
          {status === "success" && (
            <p className="text-emerald-700">{t("success")}</p>
          )}
          {status === "error" && (
            <p className="text-red-700">{t("error")}</p>
          )}
        </div>
      </div>
    </form>
  );
}
