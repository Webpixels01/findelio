import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import type { AppLocale } from "@/i18n/routing";
import { getAccessToken, requireCurrentUser } from "@/lib/auth";
import { getAccountOrganizationOverview } from "@/lib/directus-account";
import { getAccountDeletionRequests } from "@/lib/directus-deletion";
import DeletionRequestAction from "@/components/deletion-request-action";

function translateValue(
  value: string | null | undefined,
  translations: Record<string, string>,
  fallback: string,
): string {
  if (!value) return fallback;
  return translations[value] ?? value;
}

export default async function OrganizationsPage({
  params,
}: {
  params: Promise<{ locale: AppLocale }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  const [t] = await Promise.all([
    getTranslations("Dashboard"),
    requireCurrentUser({
      locale,
      nextPath: `/${locale}/dashboard/organisationen`,
    }),
  ]);

  const accessToken = await getAccessToken();
  const [organizations, deletionRequests] = accessToken
    ? await Promise.all([
        getAccountOrganizationOverview(accessToken),
        getAccountDeletionRequests(accessToken),
      ])
    : [[], []];

  const roleTranslations: Record<string, string> = {
    owner: t("roleValues.owner"),
    admin: t("roleValues.admin"),
    editor: t("roleValues.editor"),
  };
  const statusTranslations: Record<string, string> = {
    active: t("statusValues.active"),
    inactive: t("statusValues.inactive"),
    suspended: t("statusValues.suspended"),
    archived: t("statusValues.archived"),
  };

  return (
    <>
      <header>
        <p className="eyebrow">{t("organizationsEyebrow")}</p>
        <h1 className="mt-3 text-4xl font-extrabold tracking-tight">
          {t("organizationsTitle")}
        </h1>
        <p className="mt-4 max-w-3xl text-lg text-[var(--muted)]">
          {t("organizationsDescription")}
        </p>
      </header>

      {organizations.length === 0 ? (
        <div className="mt-8 rounded-3xl border border-[#f0cf70] bg-[#fff8e6] p-7">
          <h2 className="text-xl font-bold text-[#6f5000]">
            {t("noOrganizationsTitle")}
          </h2>
          <p className="mt-2 text-[#7b5700]">
            {t("noOrganizationsDescription")}
          </p>
        </div>
      ) : (
        <div className="mt-8 grid gap-6">
          {organizations.map((membership) => {
            const organizationStatus = translateValue(
              membership.organization.status,
              statusTranslations,
              t("unknown"),
            );
            const membershipRole = translateValue(
              membership.role,
              roleTranslations,
              t("unknown"),
            );

            return (
              <article
                key={membership.organization.id}
                className="rounded-3xl border border-[var(--border)] bg-white p-7 shadow-xl shadow-[#001734]/6"
              >
                <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <p className="text-sm font-bold uppercase tracking-[0.14em] text-[var(--accent)]">
                      {membershipRole}
                    </p>
                    <h2 className="mt-2 text-2xl font-extrabold">
                      {membership.organization.name}
                    </h2>
                  </div>
                  <span className="w-fit rounded-full bg-[#e9f8ef] px-3 py-1.5 text-sm font-bold text-[#137a3d]">
                    {organizationStatus}
                  </span>
                </div>

                <dl className="mt-6 grid gap-5 border-y border-[var(--border)] py-5 sm:grid-cols-3">
                  <div>
                    <dt className="text-sm font-semibold text-[var(--muted)]">
                      {t("membershipRole")}
                    </dt>
                    <dd className="mt-1 font-medium">{membershipRole}</dd>
                  </div>
                  <div>
                    <dt className="text-sm font-semibold text-[var(--muted)]">
                      {t("organizationStatus")}
                    </dt>
                    <dd className="mt-1 font-medium">{organizationStatus}</dd>
                  </div>
                  <div>
                    <dt className="text-sm font-semibold text-[var(--muted)]">
                      {t("listings")}
                    </dt>
                    <dd className="mt-1 font-medium">
                      {t("listingsCount", { count: membership.listings.length })}
                    </dd>
                  </div>
                </dl>

                <Link
                  href="/dashboard/firmenprofile"
                  className="mt-6 inline-flex font-extrabold text-[var(--accent)] hover:underline"
                >
                  {t("organizationListingsLink")} →
                </Link>

                <DeletionRequestAction
                  entityType="organization"
                  targetId={membership.organization.id}
                  targetName={membership.organization.name}
                  request={
                    deletionRequests.find(
                      (request) =>
                        request.entity_type === "organization" &&
                        request.organization_id === membership.organization.id,
                    ) ?? null
                  }
                  canRequest={membership.role === "owner"}
                  premiumMustBeCancelled={membership.listings.some(
                    (listing) =>
                      Boolean(
                        listing.subscription &&
                          ["active", "past_due"].includes(
                            listing.subscription.status,
                          ) &&
                          !listing.subscription.cancel_at_period_end,
                      ),
                  )}
                  subscriptionHref="/dashboard/firmenprofile"
                />
              </article>
            );
          })}
        </div>
      )}
    </>
  );
}
