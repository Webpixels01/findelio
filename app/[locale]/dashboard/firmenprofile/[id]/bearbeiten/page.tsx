import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import ListingEditForm from "@/components/listing-edit-form";
import { Link } from "@/i18n/navigation";
import type { AppLocale } from "@/i18n/routing";
import { getAccessToken, requireCurrentUser } from "@/lib/auth";
import { getEditableAccountListing } from "@/lib/directus-account";
import { getCantons } from "@/lib/directus";
import { htmlToPlainText } from "@/lib/text";

export default async function EditListingPage({
  params,
}: {
  params: Promise<{ locale: AppLocale; id: string }>;
}) {
  const { locale, id } = await params;
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
    notFound();
  }

  const [listing, cantons] = await Promise.all([
    getEditableAccountListing(accessToken, id),
    getCantons(),
  ]);

  if (!listing) {
    notFound();
  }

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

      <ListingEditForm
        listing={{
          id: listing.id,
          name: listing.name,
          status: listing.status,
          shortDescription: listing.short_description ?? "",
          description: htmlToPlainText(listing.description),
          street: listing.street ?? "",
          postalCode: listing.postal_code ?? "",
          city: listing.city ?? "",
          canton: listing.canton?.code ?? "",
          publicEmail: listing.public_email ?? "",
          phone: listing.phone ?? "",
          websiteUrl: listing.website_url ?? "",
          addressVisibility: listing.address_visibility ?? "city",
        }}
        cantons={cantons}
      />
    </>
  );
}
