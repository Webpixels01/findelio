"use client";

import { useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { cantons, categories, languages } from "@/data/directory-options";
import type { AppLocale } from "@/i18n/routing";

export default function RegisterForm() {
  const t = useTranslations("Register");
  const locale = useLocale() as AppLocale;
  const [submitted, setSubmitted] = useState(false);

  if (submitted) {
    return (
      <div className="rounded-3xl border border-[#bfe4ca] bg-[#eefaf2] p-8 text-[#135f30]">
        <h2 className="text-2xl font-extrabold">{t("successTitle")}</h2>
        <p className="mt-2">{t("successText")}</p>
        <button type="button" className="mt-6 font-bold underline" onClick={() => setSubmitted(false)}>
          {t("newEntry")}
        </button>
      </div>
    );
  }

  return (
    <form
      className="grid gap-5 rounded-3xl border border-[var(--border)] bg-white p-6 shadow-xl shadow-[#001734]/6 md:grid-cols-2 md:p-8"
      onSubmit={(event) => {
        event.preventDefault();
        setSubmitted(true);
      }}
    >
      <label className="field-group md:col-span-2">
        <span className="field-label">{t("companyName")}</span>
        <input required className="field-control" />
      </label>
      <label className="field-group">
        <span className="field-label">{t("email")}</span>
        <input required type="email" className="field-control" />
      </label>
      <label className="field-group">
        <span className="field-label">{t("phone")}</span>
        <input type="tel" className="field-control" />
      </label>
      <label className="field-group">
        <span className="field-label">{t("website")}</span>
        <input type="url" placeholder="https://" className="field-control" />
      </label>
      <label className="field-group">
        <span className="field-label">{t("industry")}</span>
        <select required className="field-control" defaultValue="">
          <option value="" disabled>{t("choose")}</option>
          {categories.map((category) => (
            <option key={category.code} value={category.code}>{category.labels[locale]}</option>
          ))}
        </select>
      </label>
      <label className="field-group">
        <span className="field-label">{t("canton")}</span>
        <select required className="field-control" defaultValue="">
          <option value="" disabled>{t("choose")}</option>
          {cantons.map(([code, label]) => <option key={code} value={code}>{label}</option>)}
        </select>
      </label>
      <label className="field-group">
        <span className="field-label">{t("city")}</span>
        <input required className="field-control" />
      </label>
      <fieldset className="md:col-span-2">
        <legend className="field-label">{t("languages")}</legend>
        <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {languages.map((language) => (
            <label key={language.code} className="flex items-center gap-3 rounded-xl border border-[var(--border)] px-4 py-3">
              <input type="checkbox" name="languages" value={language.code} className="h-4 w-4 accent-[#0277ee]" />
              <span>{language.label}</span>
            </label>
          ))}
        </div>
      </fieldset>
      <label className="field-group md:col-span-2">
        <span className="field-label">{t("descriptionLabel")}</span>
        <textarea required rows={6} className="field-control h-auto py-3" />
      </label>
      <p className="text-sm text-[var(--muted)] md:col-span-2">{t("note")}</p>
      <button type="submit" className="primary-button h-12 px-6 md:col-span-2 md:justify-self-start">
        {t("submit")}
      </button>
    </form>
  );
}
