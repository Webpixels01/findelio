import { getTranslations, setRequestLocale } from "next-intl/server";
import { redirect } from "next/navigation";
import AccountSetupForm from "@/components/account-setup-form";
import SiteHeader from "@/components/site-header";
import type { AppLocale } from "@/i18n/routing";
import { getAccessToken, requireCurrentUser } from "@/lib/auth";
import { hasActiveAccountMembership } from "@/lib/directus-account";

export default async function AccountSetupPage({
  params,
}: {
  params: Promise<{ locale: AppLocale }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  const [t, user] = await Promise.all([
    getTranslations("AccountSetup"),
    requireCurrentUser({
      locale,
      nextPath: `/${locale}/firmenkonto-einrichten`,
    }),
  ]);

  if (user.role?.name !== "Firmenkonto") {
    redirect(`/${locale}/dashboard`);
  }

  const accessToken = await getAccessToken();

  if (accessToken && (await hasActiveAccountMembership(accessToken))) {
    redirect(`/${locale}/dashboard/firmenprofile/neu?onboarding=1`);
  }

  return (
    <>
      <SiteHeader />
      <main className="page-shell bg-[var(--surface)] py-12 sm:py-16">
        <div className="site-container max-w-2xl">
          <header className="text-center">
            <p className="eyebrow">{t("eyebrow")}</p>
            <h1 className="mt-3 text-4xl font-extrabold tracking-tight sm:text-5xl">
              {t("title")}
            </h1>
            <p className="mx-auto mt-4 max-w-xl text-lg leading-8 text-[var(--muted)]">
              {t("description")}
            </p>
          </header>

          <AccountSetupForm />
        </div>
      </main>
    </>
  );
}
