import { getTranslations, setRequestLocale } from "next-intl/server";
import { notFound, redirect } from "next/navigation";
import type { AppLocale } from "@/i18n/routing";
import { getAccessToken, requireCurrentUser } from "@/lib/auth";
import { isReferralRegistrationEnabled } from "@/lib/referral-registration";
import { canManageReferrals, referralAdminRequest } from "@/lib/referral-admin-server";
import type { ReferralOverview } from "@/lib/referral-admin-types";
import { getSiteUrl } from "@/lib/seo";
import ReferralAdminManager from "@/components/referral-admin-manager";

export default async function ReferralAdminPage({ params }: { params: Promise<{ locale: AppLocale }> }) {
  if (!isReferralRegistrationEnabled()) notFound();
  const { locale } = await params;
  setRequestLocale(locale);
  await requireCurrentUser({ locale, nextPath: `/${locale}/dashboard/empfehlungen` });
  const token = await getAccessToken();
  if (!token) redirect(`/${locale}/login`);
  if (!await canManageReferrals(token)) redirect(`/${locale}/dashboard`);
  const t = await getTranslations("Referrals");
  let data: ReferralOverview | null = null;
  try {
    const response = await referralAdminRequest(token, "overview");
    if (response.ok) data = (await response.json()).data;
  } catch { /* Render a recoverable load error, never pretend the collection is empty. */ }
  return <>
    <header><p className="eyebrow">{t("eyebrow")}</p><h1 className="mt-3 text-4xl font-extrabold tracking-tight">{t("title")}</h1><p className="mt-4 max-w-3xl text-lg text-[var(--muted)]">{t("description")}</p></header>
    <ReferralAdminManager initialData={data} locale={locale} siteUrl={getSiteUrl()} />
  </>;
}
