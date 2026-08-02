"use client";

import { FormEvent, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import ListingPremiumFields, {
  type PremiumListingFieldsHandle,
  type PremiumListingPayload,
} from "@/components/listing-premium-fields";

type DirectoryOption = {
  id: string | number;
  code: string;
  name: string;
};

type ListingEditData = {
  id: string;
  name: string;
  status: string;
  shortDescription: string;
  description: string;
  street: string;
  postalCode: string;
  city: string;
  canton: string;
  publicEmail: string;
  phone: string;
  websiteUrl: string;
  addressVisibility: "full" | "city" | "hidden";
  industryIds: string[];
  spokenLanguageIds: string[];
};

type SaveResult = {
  success?: boolean;
  error?: string;
};

type ListingPremiumData = {
  enabled: boolean;
  logo: {
    id: string;
    assetUrl: string;
  } | null;
  gallery: Array<{
    id: string;
    assetUrl: string;
  }>;
  socialLinks: Array<{
    platform:
      | "instagram"
      | "facebook"
      | "linkedin"
      | "tiktok"
      | "youtube"
      | "x";
    url: string;
  }>;
  openingHours: Array<{
    day_of_week: number;
    opens_at: string;
    closes_at: string;
  }>;
  customCtaLabel: string;
  customCtaValue: string;
};

function normalizeSearchValue(value: string): string {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase()
    .trim();
}

export default function ListingEditForm({
  listing,
  cantons,
  industries,
  spokenLanguages,
  premium,
}: {
  listing: ListingEditData;
  cantons: DirectoryOption[];
  industries: DirectoryOption[];
  spokenLanguages: DirectoryOption[];
  premium: ListingPremiumData;
}) {
  const t = useTranslations("ListingEditor");
  const router = useRouter();
  const premiumFieldsRef = useRef<PremiumListingFieldsHandle>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [industrySearch, setIndustrySearch] = useState("");
  const [languageSearch, setLanguageSearch] = useState("");
  const [notice, setNotice] = useState<
    | { type: "success"; text: string }
    | { type: "error"; text: string }
    | null
  >(null);

  const editableStatus = ["draft", "pending"].includes(listing.status)
    ? listing.status
    : "pending";
  const normalizedIndustrySearch = normalizeSearchValue(industrySearch);
  const normalizedLanguageSearch = normalizeSearchValue(languageSearch);
  const matchingIndustryCount = industries.filter((industry) =>
    normalizeSearchValue(industry.name).includes(normalizedIndustrySearch),
  ).length;
  const matchingLanguageCount = spokenLanguages.filter((language) =>
    normalizeSearchValue(language.name).includes(normalizedLanguageSearch),
  ).length;

  function getErrorMessage(code?: string): string {
    const knownCodes = new Set([
      "invalid_data",
      "unauthorized",
      "forbidden",
      "not_found",
      "invalid_selection",
      "invalid_image",
      "file_too_large",
      "too_many_files",
      "upload_failed",
      "premium_required",
      "save_failed",
    ]);

    return knownCodes.has(code ?? "")
      ? t(`errors.${code}`)
      : t("errors.save_failed");
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSaving(true);
    setNotice(null);

    const formData = new FormData(event.currentTarget);
    let premiumPayload: PremiumListingPayload | undefined;

    try {
      premiumPayload = premium.enabled
        ? await premiumFieldsRef.current?.preparePayload()
        : undefined;
    } catch (error) {
      setNotice({
        type: "error",
        text: getErrorMessage(
          error instanceof Error ? error.message : "upload_failed",
        ),
      });
      setIsSaving(false);
      return;
    }

    const payload = {
      name: formData.get("name"),
      short_description: formData.get("short_description"),
      description: formData.get("description"),
      public_email: formData.get("public_email"),
      phone: formData.get("phone"),
      website_url: formData.get("website_url"),
      street: formData.get("street"),
      postal_code: formData.get("postal_code"),
      city: formData.get("city"),
      canton: formData.get("canton"),
      address_visibility: formData.get("address_visibility"),
      status: formData.get("status"),
      industry_ids: formData.getAll("industry_ids").map(String),
      spoken_language_ids: formData
        .getAll("spoken_language_ids")
        .map(String),
      ...(premiumPayload ? { premium: premiumPayload } : {}),
    };

    try {
      const response = await fetch(`/api/account/listings/${listing.id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });
      const result = (await response.json()) as SaveResult;

      if (!response.ok || !result.success) {
        setNotice({ type: "error", text: getErrorMessage(result.error) });
        return;
      }

      setNotice({ type: "success", text: t("saved") });
      router.refresh();
    } catch {
      setNotice({ type: "error", text: t("errors.network") });
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
      <section className="rounded-3xl border border-[var(--border)] bg-white p-6 shadow-lg shadow-[#001734]/5 sm:p-8">
        <h2 className="text-2xl font-extrabold">{t("sections.general")}</h2>

        <div className="mt-6 grid gap-5">
          <label className="field-group">
            <span className="field-label">{t("fields.name")}</span>
            <input
              className="field-control"
              name="name"
              defaultValue={listing.name}
              maxLength={180}
              required
              disabled={isSaving}
            />
          </label>

          <label className="field-group">
            <span className="field-label">{t("fields.shortDescription")}</span>
            <textarea
              className="field-control field-textarea min-h-28"
              name="short_description"
              defaultValue={listing.shortDescription}
              maxLength={500}
              disabled={isSaving}
            />
          </label>

          <label className="field-group">
            <span className="field-label">{t("fields.description")}</span>
            <textarea
              className="field-control field-textarea min-h-56"
              name="description"
              defaultValue={listing.description}
              maxLength={20000}
              disabled={isSaving}
            />
          </label>
        </div>
      </section>

      <ListingPremiumFields
        ref={premiumFieldsRef}
        listingId={listing.id}
        premiumEnabled={premium.enabled}
        disabled={isSaving}
        logo={premium.logo}
        gallery={premium.gallery}
        socialLinks={premium.socialLinks}
        openingHours={premium.openingHours}
        customCtaLabel={premium.customCtaLabel}
        customCtaValue={premium.customCtaValue}
      />

      <section className="rounded-3xl border border-[var(--border)] bg-white p-6 shadow-lg shadow-[#001734]/5 sm:p-8">
        <h2 className="text-2xl font-extrabold">
          {t("sections.classification")}
        </h2>

        <div className="mt-6 grid gap-8 lg:grid-cols-2">
          <fieldset disabled={isSaving}>
            <legend className="field-label">{t("fields.industries")}</legend>
            <p className="mt-1 text-sm text-[var(--muted)]">
              {t("industryHint")}
            </p>

            <label className="mt-4 block">
              <span className="field-label">{t("industrySearch")}</span>
              <input
                className="field-control mt-2"
                type="search"
                value={industrySearch}
                onChange={(event) => setIndustrySearch(event.target.value)}
                placeholder={t("industrySearchPlaceholder")}
                autoComplete="off"
              />
            </label>

            <div className="mt-4 max-h-80 space-y-2 overflow-y-auto rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-3">
              {industries.map((industry) => (
                <label
                  key={String(industry.id)}
                  className="flex cursor-pointer items-start gap-3 rounded-xl bg-white px-3 py-2.5"
                  hidden={
                    !normalizeSearchValue(industry.name).includes(
                      normalizedIndustrySearch,
                    )
                  }
                >
                  <input
                    type="checkbox"
                    name="industry_ids"
                    value={String(industry.id)}
                    defaultChecked={listing.industryIds.includes(
                      String(industry.id),
                    )}
                    className="mt-1 size-4 shrink-0 accent-[var(--accent)]"
                  />
                  <span className="block font-bold">{industry.name}</span>
                </label>
              ))}
              {matchingIndustryCount === 0 && (
                <p className="px-3 py-2.5 text-sm text-[var(--muted)]">
                  {t("noSearchResults")}
                </p>
              )}
            </div>
          </fieldset>

          <fieldset disabled={isSaving}>
            <legend className="field-label">
              {t("fields.spokenLanguages")}
            </legend>
            <p className="mt-1 text-sm text-[var(--muted)]">
              {t("spokenLanguagesHint")}
            </p>

            <label className="mt-4 block">
              <span className="field-label">{t("spokenLanguagesSearch")}</span>
              <input
                className="field-control mt-2"
                type="search"
                value={languageSearch}
                onChange={(event) => setLanguageSearch(event.target.value)}
                placeholder={t("spokenLanguagesSearchPlaceholder")}
                autoComplete="off"
              />
            </label>

            <div className="mt-4 max-h-80 space-y-2 overflow-y-auto rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-3">
              {spokenLanguages.map((language) => (
                <label
                  key={String(language.id)}
                  className="flex cursor-pointer items-start gap-3 rounded-xl bg-white px-3 py-2.5"
                  hidden={
                    !normalizeSearchValue(language.name).includes(
                      normalizedLanguageSearch,
                    )
                  }
                >
                  <input
                    type="checkbox"
                    name="spoken_language_ids"
                    value={String(language.id)}
                    defaultChecked={listing.spokenLanguageIds.includes(
                      String(language.id),
                    )}
                    className="mt-1 size-4 shrink-0 accent-[var(--accent)]"
                  />
                  <span className="block font-bold">{language.name}</span>
                </label>
              ))}
              {matchingLanguageCount === 0 && (
                <p className="px-3 py-2.5 text-sm text-[var(--muted)]">
                  {t("noSearchResults")}
                </p>
              )}
            </div>
          </fieldset>
        </div>
      </section>

      <section className="rounded-3xl border border-[var(--border)] bg-white p-6 shadow-lg shadow-[#001734]/5 sm:p-8">
        <h2 className="text-2xl font-extrabold">{t("sections.contact")}</h2>

        <div className="mt-6 grid gap-5 md:grid-cols-2">
          <label className="field-group">
            <span className="field-label">{t("fields.publicEmail")}</span>
            <input
              className="field-control"
              type="email"
              name="public_email"
              defaultValue={listing.publicEmail}
              maxLength={254}
              autoComplete="email"
              disabled={isSaving}
            />
          </label>

          <label className="field-group">
            <span className="field-label">{t("fields.phone")}</span>
            <input
              className="field-control"
              type="tel"
              name="phone"
              defaultValue={listing.phone}
              maxLength={60}
              autoComplete="tel"
              disabled={isSaving}
            />
          </label>

          <label className="field-group md:col-span-2">
            <span className="field-label">{t("fields.website")}</span>
            <input
              className="field-control"
              type="text"
              inputMode="url"
              name="website_url"
              defaultValue={listing.websiteUrl}
              maxLength={500}
              placeholder="https://"
              autoComplete="url"
              disabled={isSaving}
            />
          </label>
        </div>
      </section>

      <section className="rounded-3xl border border-[var(--border)] bg-white p-6 shadow-lg shadow-[#001734]/5 sm:p-8">
        <h2 className="text-2xl font-extrabold">{t("sections.address")}</h2>

        <div className="mt-6 grid gap-5 md:grid-cols-2">
          <label className="field-group md:col-span-2">
            <span className="field-label">{t("fields.street")}</span>
            <input
              className="field-control"
              name="street"
              defaultValue={listing.street}
              maxLength={200}
              autoComplete="street-address"
              disabled={isSaving}
            />
          </label>

          <label className="field-group">
            <span className="field-label">{t("fields.postalCode")}</span>
            <input
              className="field-control"
              name="postal_code"
              defaultValue={listing.postalCode}
              maxLength={20}
              autoComplete="postal-code"
              required
              disabled={isSaving}
            />
          </label>

          <label className="field-group">
            <span className="field-label">{t("fields.city")}</span>
            <input
              className="field-control"
              name="city"
              defaultValue={listing.city}
              maxLength={120}
              autoComplete="address-level2"
              required
              disabled={isSaving}
            />
          </label>

          <label className="field-group">
            <span className="field-label">{t("fields.canton")}</span>
            <select
              className="field-control"
              name="canton"
              defaultValue={listing.canton}
              required
              disabled={isSaving}
            >
              {cantons.map((canton) => (
                <option key={canton.code} value={canton.code}>
                  {canton.code} – {canton.name}
                </option>
              ))}
            </select>
          </label>

          <label className="field-group">
            <span className="field-label">{t("fields.addressVisibility")}</span>
            <select
              className="field-control"
              name="address_visibility"
              defaultValue={listing.addressVisibility}
              disabled={isSaving}
            >
              <option value="full">{t("addressVisibility.full")}</option>
              <option value="city">{t("addressVisibility.city")}</option>
              <option value="hidden">{t("addressVisibility.hidden")}</option>
            </select>
          </label>
        </div>
      </section>

      <section className="rounded-3xl border border-[var(--border)] bg-white p-6 shadow-lg shadow-[#001734]/5 sm:p-8">
        <h2 className="text-2xl font-extrabold">{t("sections.workflow")}</h2>

        <div className="mt-6 grid gap-5 md:grid-cols-2">
          <div className="rounded-2xl bg-[var(--surface)] p-5">
            <p className="text-sm font-bold text-[var(--muted)]">
              {t("currentStatus")}
            </p>
            <p className="mt-2 text-lg font-extrabold">
              {t.has(`statusValues.${listing.status}`)
                ? t(`statusValues.${listing.status}`)
                : listing.status}
            </p>
          </div>

          <label className="field-group">
            <span className="field-label">{t("fields.status")}</span>
            <select
              className="field-control"
              name="status"
              defaultValue={editableStatus}
              disabled={isSaving}
            >
              <option value="draft">{t("statusValues.draft")}</option>
              <option value="pending">{t("statusValues.review")}</option>
            </select>
            <span className="text-sm text-[var(--muted)]">
              {t("statusHint")}
            </span>
          </label>
        </div>
      </section>

      <div className="flex flex-col-reverse gap-4 rounded-3xl border border-[var(--border)] bg-white p-5 shadow-lg shadow-[#001734]/5 sm:flex-row sm:items-center sm:justify-between">
        <div aria-live="polite">
          {notice && (
            <p
              className={
                notice.type === "success"
                  ? "font-bold text-[#137a3d]"
                  : "font-bold text-[#b42318]"
              }
              role={notice.type === "error" ? "alert" : "status"}
            >
              {notice.text}
            </p>
          )}
        </div>

        <button
          type="submit"
          className="primary-button h-12 px-7"
          disabled={isSaving}
        >
          {isSaving ? t("saving") : t("save")}
        </button>
      </div>
    </form>
  );
}
