import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import ListingEditForm from "@/components/listing-edit-form";
import { Link } from "@/i18n/navigation";
import type { AppLocale } from "@/i18n/routing";
import { getAccessToken, requireCurrentUser } from "@/lib/auth";
import { getEditableAccountListingEditorData } from "@/lib/directus-account";
import { getCantons, getIndustries, getSpokenLanguages } from "@/lib/directus";
import { getDirectusAssetUrl } from "@/lib/directus-assets";
import { htmlToPlainText } from "@/lib/text";

export default async function EditListingPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: AppLocale; id: string }>;
  searchParams: Promise<{ created?: string }>;
}) {
  const [{ locale, id }, query] = await Promise.all([params, searchParams]);
  setRequestLocale(locale);

  const [t] = await Promise.all([
    getTranslations("ListingEditor"),
    requireCurrentUser({
      locale,
      nextPath: `/${locale}/dashboard/firmenprofile/${id}/bearbeiten`,
    }),
  ]);

  const accessToken = await getAccessToken();

  if (!accessToken) {
    return notFound();
  }

  const [editorData, cantons, industries, spokenLanguages] =
    await Promise.all([
      getEditableAccountListingEditorData(accessToken, id),
      getCantons(),
      getIndustries(locale),
      getSpokenLanguages(locale),
    ]);

  if (!editorData) {
    return notFound();
  }

  const {
    listing,
    industryIds,
    spokenLanguageIds,
    openingHours,
    premiumEnabled,
  } = editorData;
  const supportedSocialPlatforms = new Set([
    "instagram",
    "facebook",
    "linkedin",
    "tiktok",
    "youtube",
    "x",
  ]);

  return (
    <>
      <Link
        href="/dashboard/firmenprofile"
        className="inline-flex font-extrabold text-[var(--accent)] hover:underline"
      >
        ← {t("back")}
      </Link>

      <header className="mt-6">
        <p className="eyebrow">{t("eyebrow")}</p>
        <h1 className="mt-3 text-4xl font-extrabold tracking-tight">
          {t("title", { name: listing.name })}
        </h1>
        <p className="mt-4 max-w-3xl text-lg text-[var(--muted)]">
          {t("description")}
        </p>
      </header>

      {query.created === "1" && (
        <div
          className="mt-8 rounded-2xl border border-[#bfe4ca] bg-[#eefaf2] p-4 font-bold text-[#135f30]"
          role="status"
        >
          {listing.requested_billing_interval
            ? t("createdPremiumNotice")
            : t("createdNotice")}
        </div>
      )}

      <ListingEditForm
        listing={{
          id: listing.id,
          name: listing.name,
          status: listing.status,
          description: htmlToPlainText(listing.description),
          descriptionTranslations: Object.fromEntries(
            Object.entries(listing.description_translations ?? {}).map(
              ([translationLocale, value]) => [
                translationLocale,
                htmlToPlainText(value),
              ],
            ),
          ),
          street: listing.street ?? "",
          postalCode: listing.postal_code ?? "",
          city: listing.city ?? "",
          canton: listing.canton?.code ?? "",
          publicEmail: listing.public_email ?? "",
          phone: listing.phone ?? "",
          websiteUrl: listing.website_url ?? "",
          addressVisibility: listing.address_visibility ?? "city",
          industryIds,
          spokenLanguageIds,
        }}
        cantons={cantons}
        industries={industries}
        spokenLanguages={spokenLanguages}
        premium={{
          enabled: premiumEnabled,
          logo: listing.logo
            ? {
                id: listing.logo,
                assetUrl: getDirectusAssetUrl(listing.logo),
              }
            : null,
          gallery: (listing.gallery ?? []).map((item) => ({
            id: item.directus_files_id,
            assetUrl: getDirectusAssetUrl(item.directus_files_id),
          })),
          socialLinks: (listing.social_links ?? []).filter(
            (
              item,
            ): item is typeof item & {
              platform:
                | "instagram"
                | "facebook"
                | "linkedin"
                | "tiktok"
                | "youtube"
                | "x";
            } => supportedSocialPlatforms.has(item.platform),
          ),
          openingHours,
          customCtaLabel: listing.custom_cta_label ?? "",
          customCtaValue: listing.custom_cta_value ?? "",
        }}
      />
    </>
  );
}
