import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import ListingBillingActions from "@/components/listing-billing-actions";
import { Link } from "@/i18n/navigation";
import type { AppLocale } from "@/i18n/routing";
import { getAccessToken, requireCurrentUser } from "@/lib/auth";
import { getAccountListingBillingData } from "@/lib/directus-account";

function normalizeInterval(
  value: string | undefined,
): "monthly" | "yearly" {
  return value === "yearly" ? "yearly" : "monthly";
}

export default async function ListingBillingPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: AppLocale; id: string }>;
  searchParams: Promise<{
    interval?: string;
    checkout?: string;
    new?: string;
  }>;
}) {
  const [{ locale, id }, query] = await Promise.all([params, searchParams]);
  setRequestLocale(locale);

  const [t] = await Promise.all([
    getTranslations("Billing"),
    requireCurrentUser({
      locale,
      nextPath: `/${locale}/dashboard/firmenprofile/${id}/abo`,
    }),
  ]);
  const accessToken = await getAccessToken();

  if (!accessToken) {
    return notFound();
  }

  const billingData = await getAccountListingBillingData(accessToken, id);

  if (!billingData) {
    return notFound();
  }

  const { listing, subscription, premiumEnabled } = billingData;
  const initialInterval = normalizeInterval(
    query.interval ?? subscription?.billing_interval,
  );
  const dateFormatter = new Intl.DateTimeFormat(locale, {
    dateStyle: "long",
  });
  const periodEnd = subscription?.current_period_end
    ? new Date(subscription.current_period_end)
    : null;
  const formattedPeriodEnd =
    periodEnd && !Number.isNaN(periodEnd.getTime())
      ? dateFormatter.format(periodEnd)
      : null;

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

      {query.new === "1" && (
        <div className="mt-8 rounded-2xl border border-[#bfe4ca] bg-[#eefaf2] p-4 font-bold text-[#135f30]">
          {t("listingCreated")}
        </div>
      )}

      {query.checkout === "success" && (
        <div
          className="mt-8 rounded-2xl border border-[#bfe4ca] bg-[#eefaf2] p-4 font-bold text-[#135f30]"
          role="status"
        >
          {t("checkoutSuccess")}
        </div>
      )}

      {query.checkout === "cancelled" && (
        <div
          className="mt-8 rounded-2xl border border-[#f3d6a5] bg-[#fff8eb] p-4 font-bold text-[#7a4b00]"
          role="status"
        >
          {t("checkoutCancelled")}
        </div>
      )}

      <div className="mt-8 grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
        <section className="rounded-3xl border border-[#bfdcff] bg-[#f5faff] p-6 shadow-lg shadow-[#001734]/5 sm:p-8">
          <span className="rounded-full bg-[var(--accent)] px-3 py-1 text-xs font-extrabold uppercase tracking-wider text-white">
            {t("premium.badge")}
          </span>
          <h2 className="mt-4 text-3xl font-extrabold">
            {t("premium.title")}
          </h2>
          <p className="mt-3 text-[var(--muted)]">
            {t("premium.description")}
          </p>

          <ul className="mt-6 grid gap-3 sm:grid-cols-2">
            {(["logo", "gallery", "openingHours", "socialLinks"] as const).map(
              (feature) => (
                <li
                  key={feature}
                  className="rounded-2xl border border-[#d5e8ff] bg-white p-4 font-extrabold"
                >
                  <span className="mr-2 text-[var(--accent)]" aria-hidden>
                    ◆
                  </span>
                  {t(`premium.features.${feature}`)}
                </li>
              ),
            )}
          </ul>

          {!premiumEnabled && (
            <ListingBillingActions
              listingId={listing.id}
              locale={locale}
              premiumEnabled={false}
              initialInterval={initialInterval}
            />
          )}
        </section>

        <section className="rounded-3xl border border-[var(--border)] bg-white p-6 shadow-lg shadow-[#001734]/5 sm:p-8">
          <p className="eyebrow">{t("status.eyebrow")}</p>
          <h2 className="mt-3 text-2xl font-extrabold">
            {premiumEnabled ? t("status.premium") : t("status.free")}
          </h2>

          {subscription ? (
            <dl className="mt-6 space-y-4">
              <div>
                <dt className="text-sm font-bold text-[var(--muted)]">
                  {t("status.subscriptionStatus")}
                </dt>
                <dd className="mt-1 font-extrabold">
                  {t(`status.values.${subscription.status}`)}
                </dd>
              </div>
              <div>
                <dt className="text-sm font-bold text-[var(--muted)]">
                  {t("status.price")}
                </dt>
                <dd className="mt-1 font-extrabold">
                  {subscription.billing_interval === "yearly"
                    ? t("intervals.yearly.description")
                    : t("intervals.monthly.description")}
                </dd>
              </div>
              {formattedPeriodEnd && (
                <div>
                  <dt className="text-sm font-bold text-[var(--muted)]">
                    {subscription.cancel_at_period_end
                      ? t("status.accessUntil")
                      : t("status.nextRenewal")}
                  </dt>
                  <dd className="mt-1 font-extrabold">
                    {formattedPeriodEnd}
                  </dd>
                </div>
              )}
            </dl>
          ) : (
            <p className="mt-5 text-[var(--muted)]">{t("status.freeHint")}</p>
          )}

          {premiumEnabled && (
            <ListingBillingActions
              listingId={listing.id}
              locale={locale}
              premiumEnabled
              initialInterval={initialInterval}
            />
          )}
        </section>
      </div>
    </>
  );
}
