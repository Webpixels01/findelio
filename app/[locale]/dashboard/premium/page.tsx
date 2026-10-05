import { getTranslations, setRequestLocale } from "next-intl/server";
import { redirect } from "next/navigation";
import type { AppLocale } from "@/i18n/routing";
import { getAccessToken, requireCurrentUser } from "@/lib/auth";
import {
  getDirectusCurrentUserPermissions,
  hasListingReviewAccess,
} from "@/lib/directus-auth";
import { getAdminPremiumListings } from "@/lib/directus-premium";
import PremiumGrantManager from "@/components/premium-grant-manager";

export default async function PremiumAdminPage({
  params,
}: {
  params: Promise<{ locale: AppLocale }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const [t] = await Promise.all([
    getTranslations("PremiumGrants"),
    requireCurrentUser({ locale, nextPath: `/${locale}/dashboard/premium` }),
  ]);
  const accessToken = await getAccessToken();
  if (!accessToken) redirect(`/${locale}/login`);

  const permissions = await getDirectusCurrentUserPermissions(accessToken);
  if (!hasListingReviewAccess(permissions)) {
    redirect(`/${locale}/dashboard`);
  }

  const listings = await getAdminPremiumListings(accessToken);

  return (
    <>
      <header>
        <p className="eyebrow">{t("eyebrow")}</p>
        <h1 className="mt-3 text-4xl font-extrabold tracking-tight">{t("title")}</h1>
        <p className="mt-4 max-w-3xl text-lg text-[var(--muted)]">{t("description")}</p>
      </header>
      <PremiumGrantManager listings={listings} locale={locale} />
    </>
  );
}
