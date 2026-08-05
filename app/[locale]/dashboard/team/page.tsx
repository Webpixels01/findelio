import { getTranslations, setRequestLocale } from "next-intl/server";
import type { AppLocale } from "@/i18n/routing";
import TeamManager from "@/components/team-manager";
import { getAccessToken, requireCurrentUser } from "@/lib/auth";
import { getAccountTeamOverview } from "@/lib/directus-team";

export default async function TeamPage({
  params,
}: {
  params: Promise<{ locale: AppLocale }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  const t = await getTranslations("Dashboard");
  await requireCurrentUser({
    locale,
    nextPath: `/${locale}/dashboard/team`,
  });

  const accessToken = await getAccessToken();
  const organizations = accessToken
    ? await getAccountTeamOverview(accessToken)
    : [];

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

      <TeamManager organizations={organizations} />
    </>
  );
}
