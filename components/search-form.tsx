import type { AppLocale } from "@/i18n/routing";
import {
  getCantons,
  getIndustries,
  getSpokenLanguages,
} from "@/lib/directus";
import { getTranslations } from "next-intl/server";

export type SearchValues = {
  sprache?: string;
  branche?: string;
  kanton?: string;
  ort?: string;
};

export default async function SearchForm({
  locale,
  values = {},
  compact = false,
}: {
  locale: AppLocale;
  values?: SearchValues;
  compact?: boolean;
}) {
  const t = await getTranslations("Search");

  const [languages, industries, cantons] = await Promise.all([
    getSpokenLanguages(locale),
    getIndustries(locale),
    getCantons(),
  ]);

  return (
    <form
      action={`/${locale}/unternehmen`}
      method="get"
      className={compact ? "directory-search directory-search-compact" : "directory-search"}
    >
      <label className="field-group">
        <span className="field-label">{t("language")}</span>

        <select
          key={`sprache-${values.sprache ?? ""}`}
          name="sprache"
          defaultValue={values.sprache ?? ""}
          className="field-control"
        >
          <option value="">{t("allLanguages")}</option>

          {languages.map((language) => (
            <option key={language.code} value={language.code}>
              {language.name}
            </option>
          ))}
        </select>
      </label>

      <label className="field-group">
        <span className="field-label">{t("industry")}</span>

        <select
          key={`branche-${values.branche ?? ""}`}
          name="branche"
          defaultValue={values.branche ?? ""}
          className="field-control"
        >
          <option value="">{t("allIndustries")}</option>

          {industries.map((industry) => (
            <option key={industry.code} value={industry.code}>
              {industry.name}
            </option>
          ))}
        </select>
      </label>

      <label className="field-group">
        <span className="field-label">{t("canton")}</span>

        <select
          key={`kanton-${values.kanton ?? ""}`}
          name="kanton"
          defaultValue={values.kanton ?? ""}
          className="field-control"
        >
          <option value="">{t("allCantons")}</option>

          {cantons.map((canton) => (
            <option key={canton.code} value={canton.code}>
              {canton.name}
            </option>
          ))}
        </select>
      </label>

      <label className="field-group">
        <span className="field-label">{t("location")}</span>

        <input
          key={`ort-${values.ort ?? ""}`}
          type="search"
          name="ort"
          defaultValue={values.ort ?? ""}
          placeholder={t("locationPlaceholder")}
          className="field-control"
        />
      </label>

      <button type="submit" className="primary-button search-submit mt-auto px-5">
        {t("submit")}
      </button>
    </form>
  );
}
