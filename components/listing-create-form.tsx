"use client";

import { FormEvent, useState } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";

type OrganizationOption = {
  id: string;
  name: string;
};

type CantonOption = {
  code: string;
  name: string;
};

type CreateResult = {
  success?: boolean;
  error?: string;
  listing?: {
    id?: string;
  };
};

export default function ListingCreateForm({
  organizations,
  cantons,
}: {
  organizations: OrganizationOption[];
  cantons: CantonOption[];
}) {
  const t = useTranslations("ListingCreator");
  const router = useRouter();
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
    setIsSaving(true);
    setError(null);

    const formData = new FormData(event.currentTarget);
    const payload = {
      organization_id: formData.get("organization_id"),
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
    };

    try {
      const response = await fetch("/api/account/listings", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });
      const result = (await response.json()) as CreateResult;

      if (!response.ok || !result.success || !result.listing?.id) {
        setError(getErrorMessage(result.error));
        return;
      }

      router.push(
        `/dashboard/firmenprofile/${result.listing.id}/bearbeiten?created=1`,
      );
    } catch {
      setError(t("errors.network"));
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
      <section className="rounded-3xl border border-[var(--border)] bg-white p-6 shadow-lg shadow-[#001734]/5 sm:p-8">
        <h2 className="text-2xl font-extrabold">{t("sections.organization")}</h2>

        <label className="field-group mt-6">
          <span className="field-label">{t("fields.organization")}</span>
          <select
            className="field-control"
            name="organization_id"
            defaultValue={organizations[0]?.id ?? ""}
            required
            disabled={isSaving}
          >
            {organizations.map((organization) => (
              <option key={organization.id} value={organization.id}>
                {organization.name}
              </option>
            ))}
          </select>
          <span className="text-sm text-[var(--muted)]">
            {t("organizationHint")}
          </span>
        </label>
      </section>

      <section className="rounded-3xl border border-[var(--border)] bg-white p-6 shadow-lg shadow-[#001734]/5 sm:p-8">
        <h2 className="text-2xl font-extrabold">{t("sections.general")}</h2>

        <div className="mt-6 grid gap-5">
          <label className="field-group">
            <span className="field-label">{t("fields.name")}</span>
            <input
              className="field-control"
              name="name"
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
              maxLength={500}
              disabled={isSaving}
            />
          </label>

          <label className="field-group">
            <span className="field-label">{t("fields.description")}</span>
            <textarea
              className="field-control field-textarea min-h-56"
              name="description"
              maxLength={20000}
              disabled={isSaving}
            />
          </label>
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
              defaultValue=""
              required
              disabled={isSaving}
            >
              <option value="" disabled>
                {t("chooseCanton")}
              </option>
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
              defaultValue="city"
              disabled={isSaving}
            >
              <option value="full">{t("addressVisibility.full")}</option>
              <option value="city">{t("addressVisibility.city")}</option>
              <option value="hidden">{t("addressVisibility.hidden")}</option>
            </select>
          </label>
        </div>
      </section>

      <div className="flex flex-col-reverse gap-4 rounded-3xl border border-[var(--border)] bg-white p-5 shadow-lg shadow-[#001734]/5 sm:flex-row sm:items-center sm:justify-between">
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
          disabled={isSaving}
        >
          {isSaving ? t("creating") : t("create")}
        </button>
      </div>
    </form>
  );
}
