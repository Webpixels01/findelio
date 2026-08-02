import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import type { AppLocale } from "@/i18n/routing";
import { getAccessToken, requireCurrentUser } from "@/lib/auth";
import { getAccountOrganizationOverview } from "@/lib/directus-account";

function translateValue(
  value: string | null | undefined,
  translations: Record<string, string>,
  fallback: string,
): string {
  if (!value) return fallback;
  return translations[value] ?? value;
}

export default async function ListingsPage({
  params,
}: {
  params: Promise<{ locale: AppLocale }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  const [t, tg] = await Promise.all([
    getTranslations("Dashboard"),
    getTranslations("Growth"),
    requireCurrentUser({
      locale,
      nextPath: `/${locale}/dashboard/firmenprofile`,
    }),
  ]);

  const accessToken = await getAccessToken();
  const organizations = accessToken
    ? await getAccountOrganizationOverview(accessToken)
    : [];
  const listings = organizations.flatMap((membership) =>
    membership.listings.map((listing) => ({
      ...listing,
      organizationName: membership.organization.name,
    })),
  );

  const statusTranslations: Record<string, string> = {
    active: t("statusValues.active"),
    inactive: t("statusValues.inactive"),
    draft: t("statusValues.draft"),
    pending: t("statusValues.review"),
    review: t("statusValues.review"),
    pending_review: t("statusValues.review"),
    published: t("statusValues.published"),
    rejected: t("statusValues.rejected"),
    suspended: t("statusValues.suspended"),
    archived: t("statusValues.archived"),
  };

  return (
    <>
      <header className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="eyebrow">{t("listingsPage.eyebrow")}</p>
          <h1 className="mt-3 text-4xl font-extrabold tracking-tight">
            {t("listingsPage.title")}
          </h1>
          <p className="mt-4 max-w-3xl text-lg text-[var(--muted)]">
            {t("listingsPage.description")}
          </p>
        </div>

        <Link
          href="/dashboard/firmenprofile/neu"
          locale={locale}
          className="primary-button h-12 shrink-0 px-6"
        >
          {t("listingsPage.createListing")}
        </Link>
      </header>

      {listings.length === 0 ? (
        <div className="mt-8 rounded-3xl border border-[var(--border)] bg-white p-7 shadow-xl shadow-[#001734]/6">
          <h2 className="text-xl font-bold">{t("listingsPage.emptyTitle")}</h2>
          <p className="mt-2 text-[var(--muted)]">
            {t("listingsPage.emptyDescription")}
          </p>
          <Link
            href="/dashboard/firmenprofile/neu"
            locale={locale}
            className="primary-button mt-6 h-11 px-5"
          >
            {t("listingsPage.createListing")}
          </Link>
        </div>
      ) : (
        <div className="mt-8 grid gap-5 md:grid-cols-2">
          {listings.map((listing) => {
            const listingStatus = translateValue(
              listing.status,
              statusTranslations,
              t("unknown"),
            );
            const location = [listing.postal_code, listing.city]
              .filter(Boolean)
              .join(" ");

            return (
              <article
                key={listing.id}
                className="rounded-3xl border border-[var(--border)] bg-white p-6 shadow-lg shadow-[#001734]/5"
              >
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-sm font-bold text-[var(--accent)]">
                      {listing.organizationName}
                    </p>
                    <h2 className="mt-2 text-xl font-extrabold">
                      {listing.name}
                    </h2>
                  </div>
                  <span className="shrink-0 rounded-full bg-[var(--surface)] px-3 py-1.5 text-xs font-bold text-[#40536b]">
                    {listingStatus}
                  </span>
                </div>

                <p className="mt-4 text-[var(--muted)]">
                  {location || t("locationUnknown")}
                </p>

                <div className="mt-5 flex flex-wrap items-center gap-4">
                  <Link
                    href={`/dashboard/firmenprofile/${listing.id}/bearbeiten`}
                    locale={locale}
                    className="primary-button h-10 px-4"
                  >
                    {t("listingsPage.editListing")}
                  </Link>

                  {listing.subscription && ["active", "past_due"].includes(listing.subscription.status) && (
                    <>
                      <Link href={`/dashboard/firmenprofile/${listing.id}/beitraege`} locale={locale} className="font-extrabold text-[var(--accent)] hover:underline">{tg("posts.manage")}</Link>
                      <Link href={`/dashboard/firmenprofile/${listing.id}/statistik`} locale={locale} className="font-extrabold text-[var(--accent)] hover:underline">{tg("statistics.link")}</Link>
                    </>
                  )}

                  {listing.status === "published" ? (
                    <Link
                      href={`/dashboard/firmenprofile/${listing.id}/abo`}
                      locale={locale}
                      className="font-extrabold text-[var(--accent)] hover:underline"
                    >
                      {listing.subscription
                        ? t("listingsPage.manageSubscription")
                        : t("listingsPage.choosePlan")}
                    </Link>
                  ) : (
                    <p className="text-sm font-semibold text-[var(--muted)]">
                      {listing.status === "pending"
                        ? t("listingsPage.billingAfterApproval")
                        : t("listingsPage.completeBeforeBilling")}
                    </p>
                  )}

                  {listing.status === "published" ? (
                    <Link
                      href={`/unternehmen/${listing.slug}`}
                      locale={locale}
                      className="font-extrabold text-[var(--accent)] hover:underline"
                    >
                      {t("viewListing")} →
                    </Link>
                  ) : (
                    <p className="text-sm font-semibold text-[var(--muted)]">
                      {t("listingsPage.notPublic")}
                    </p>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      )}
    </>
  );
}
