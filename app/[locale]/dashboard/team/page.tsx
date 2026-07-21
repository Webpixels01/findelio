import { getTranslations, setRequestLocale } from "next-intl/server";
import type { AppLocale } from "@/i18n/routing";
import { getAccessToken, requireCurrentUser } from "@/lib/auth";
import { getAccountOrganizationOverview } from "@/lib/directus-account";

function translateRole(
  role: string | null | undefined,
  translations: Record<string, string>,
  fallback: string,
): string {
  if (!role) return fallback;
  return translations[role] ?? role;
}

export default async function TeamPage({
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
      nextPath: `/${locale}/dashboard/team`,
    }),
  ]);

  const accessToken = await getAccessToken();
  const organizations = accessToken
    ? await getAccountOrganizationOverview(accessToken)
    : [];
  const displayName =
    [user.first_name, user.last_name].filter(Boolean).join(" ") || user.email;

  const roleTranslations: Record<string, string> = {
    owner: t("roleValues.owner"),
    admin: t("roleValues.admin"),
    editor: t("roleValues.editor"),
  };

  return (
    <>
      <header>
        <p className="eyebrow">{t("teamPage.eyebrow")}</p>
        <h1 className="mt-3 text-4xl font-extrabold tracking-tight">
          {t("teamPage.title")}
        </h1>
        <p className="mt-4 max-w-3xl text-lg text-[var(--muted)]">
          {t("teamPage.description")}
        </p>
      </header>

      <div className="mt-8 rounded-3xl border border-[#a9cfee] bg-[#eef7ff] p-6">
        <h2 className="text-lg font-extrabold text-[#003e70]">
          {t("teamPage.nextStepTitle")}
        </h2>
        <p className="mt-2 text-[#174f78]">
          {t("teamPage.nextStepDescription")}
        </p>
      </div>

      <section className="mt-8 rounded-3xl border border-[var(--border)] bg-white p-7 shadow-xl shadow-[#001734]/6">
        <h2 className="text-2xl font-bold">{t("teamPage.yourMemberships")}</h2>
        <div className="mt-6 grid gap-4">
          {organizations.length === 0 ? (
            <p className="rounded-2xl bg-[var(--surface)] p-4 text-[var(--muted)]">
              {t("noOrganizationsDescription")}
            </p>
          ) : (
            organizations.map((membership) => (
              <article
                key={membership.id}
                className="rounded-2xl border border-[var(--border)] p-5"
              >
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <h3 className="font-extrabold">{displayName}</h3>
                    <p className="mt-1 break-all text-sm text-[var(--muted)]">
                      {user.email}
                    </p>
                  </div>
                  <div className="sm:text-right">
                    <p className="font-extrabold">
                      {membership.organization.name}
                    </p>
                    <p className="mt-1 text-sm text-[var(--muted)]">
                      {translateRole(
                        membership.role,
                        roleTranslations,
                        t("unknown"),
                      )}
                    </p>
                  </div>
                </div>
              </article>
            ))
          )}
        </div>
      </section>
    </>
  );
}
