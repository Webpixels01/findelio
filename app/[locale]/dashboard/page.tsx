import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import type { AppLocale } from "@/i18n/routing";
import { getAccessToken, requireCurrentUser } from "@/lib/auth";
import { getAccountOrganizationOverview } from "@/lib/directus-account";

function getTranslatedValue(
  value: string | null | undefined,
  translations: Record<string, string>,
  fallback: string,
): string {
  if (!value) {
    return fallback;
  }

  return translations[value] ?? value;
}

export default async function DashboardPage({
  params,
}: {
  params: Promise<{ locale: AppLocale }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  const [t, user] = await Promise.all([
    getTranslations("Dashboard"),
    requireCurrentUser({
      locale,
      nextPath: `/${locale}/dashboard`,
    }),
  ]);

  const accessToken = await getAccessToken();
  const organizations = accessToken
    ? await getAccountOrganizationOverview(accessToken)
    : [];
  const listings = organizations.flatMap((membership) => membership.listings);
  const publishedListings = listings.filter(
    (listing) => listing.status === "published",
  );

  const displayName =
    [user.first_name, user.last_name].filter(Boolean).join(" ") || user.email;
  const roleName = user.role?.name ?? t("unknown");
  const userStatus = getTranslatedValue(
    user.status,
    {
      active: t("statusValues.active"),
      inactive: t("statusValues.inactive"),
      suspended: t("statusValues.suspended"),
      archived: t("statusValues.archived"),
    },
    t("unknown"),
  );

  const roleTranslations: Record<string, string> = {
    owner: t("roleValues.owner"),
    admin: t("roleValues.admin"),
    editor: t("roleValues.editor"),
  };

  return (
    <>
      <header>
        <p className="eyebrow">{t("eyebrow")}</p>
        <h1 className="mt-3 text-4xl font-extrabold tracking-tight">
          {t("title")}
        </h1>
        <p className="mt-4 text-lg text-[var(--muted)]">
          {t("welcome", { name: displayName })}
        </p>
        <p className="mt-2 text-[var(--muted)]">{t("description")}</p>
      </header>

      <section className="mt-8 grid gap-4 sm:grid-cols-3">
        <Link
          href="/dashboard/organisationen"
          className="rounded-3xl border border-[var(--border)] bg-white p-6 shadow-lg shadow-[#001734]/5 transition-transform hover:-translate-y-0.5"
        >
          <p className="text-sm font-bold text-[var(--muted)]">
            {t("summary.organizations")}
          </p>
          <p className="mt-3 text-4xl font-extrabold">{organizations.length}</p>
        </Link>

        <Link
          href="/dashboard/firmenprofile"
          className="rounded-3xl border border-[var(--border)] bg-white p-6 shadow-lg shadow-[#001734]/5 transition-transform hover:-translate-y-0.5"
        >
          <p className="text-sm font-bold text-[var(--muted)]">
            {t("summary.listings")}
          </p>
          <p className="mt-3 text-4xl font-extrabold">{listings.length}</p>
        </Link>

        <Link
          href="/dashboard/firmenprofile"
          className="rounded-3xl border border-[var(--border)] bg-white p-6 shadow-lg shadow-[#001734]/5 transition-transform hover:-translate-y-0.5"
        >
          <p className="text-sm font-bold text-[var(--muted)]">
            {t("summary.published")}
          </p>
          <p className="mt-3 text-4xl font-extrabold">
            {publishedListings.length}
          </p>
        </Link>
      </section>

      <section className="mt-8 rounded-3xl border border-[var(--border)] bg-white p-7 shadow-xl shadow-[#001734]/6">
        <h2 className="text-2xl font-bold">{t("accountTitle")}</h2>

        <dl className="mt-6 grid gap-5 sm:grid-cols-3">
          <div>
            <dt className="text-sm font-semibold text-[var(--muted)]">
              {t("email")}
            </dt>
            <dd className="mt-1 break-all font-medium">{user.email}</dd>
          </div>

          <div>
            <dt className="text-sm font-semibold text-[var(--muted)]">
              {t("role")}
            </dt>
            <dd className="mt-1 font-medium">{roleName}</dd>
          </div>

          <div>
            <dt className="text-sm font-semibold text-[var(--muted)]">
              {t("status")}
            </dt>
            <dd className="mt-1 font-medium">{userStatus}</dd>
          </div>
        </dl>
      </section>

      <section className="mt-8">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="eyebrow">{t("organizationsEyebrow")}</p>
            <h2 className="mt-3 text-3xl font-extrabold tracking-tight">
              {t("overviewOrganizationsTitle")}
            </h2>
          </div>
          <Link
            href="/dashboard/organisationen"
            className="font-extrabold text-[var(--accent)] hover:underline"
          >
            {t("overviewOrganizationsLink")} →
          </Link>
        </div>

        {organizations.length === 0 ? (
          <div className="mt-6 rounded-3xl border border-[#f0cf70] bg-[#fff8e6] p-7">
            <h3 className="text-xl font-bold text-[#6f5000]">
              {t("noOrganizationsTitle")}
            </h3>
            <p className="mt-2 text-[#7b5700]">
              {t("noOrganizationsDescription")}
            </p>
          </div>
        ) : (
          <div className="mt-6 grid gap-5 md:grid-cols-2">
            {organizations.slice(0, 4).map((membership) => (
              <article
                key={membership.organization.id}
                className="rounded-3xl border border-[var(--border)] bg-white p-6 shadow-lg shadow-[#001734]/5"
              >
                <p className="text-sm font-bold uppercase tracking-[0.14em] text-[var(--accent)]">
                  {getTranslatedValue(
                    membership.role,
                    roleTranslations,
                    t("unknown"),
                  )}
                </p>
                <h3 className="mt-2 text-2xl font-extrabold">
                  {membership.organization.name}
                </h3>
                <p className="mt-3 text-[var(--muted)]">
                  {t("listingsCount", { count: membership.listings.length })}
                </p>
              </article>
            ))}
          </div>
        )}
      </section>
    </>
  );
}
