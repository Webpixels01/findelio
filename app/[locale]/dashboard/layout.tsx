import { hasLocale } from "next-intl";
import { setRequestLocale } from "next-intl/server";
import { notFound, redirect } from "next/navigation";
import DashboardNav from "@/components/dashboard-nav";
import SiteHeader from "@/components/site-header";
import { routing } from "@/i18n/routing";
import { getAccessToken, requireCurrentUser } from "@/lib/auth";
import { hasActiveAccountMembership } from "@/lib/directus-account";
import {
  getDirectusCurrentUserPermissions,
  hasListingReviewAccess,
} from "@/lib/directus-auth";
import { privatePageMetadata } from "@/lib/seo";
import { canManageReferrals } from "@/lib/referral-admin-server";

export const metadata = privatePageMetadata;

export default async function DashboardLayout({
  children,
  params,
}: Readonly<{
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}>) {
  const { locale } = await params;

  if (!hasLocale(routing.locales, locale)) {
    notFound();
  }

  setRequestLocale(locale);

  const user = await requireCurrentUser({
    locale,
    nextPath: `/${locale}/dashboard`,
  });

  const accessToken = await getAccessToken();
  let canReviewListings = false;
  let referralAdmin = false;

  if (accessToken) {
    referralAdmin = await canManageReferrals(accessToken);
    if (
      user.role?.name === "Firmenkonto" &&
      !(await hasActiveAccountMembership(accessToken))
    ) {
      redirect(`/${locale}/firmenkonto-einrichten`);
    }

    try {
      const permissions = await getDirectusCurrentUserPermissions(accessToken);
      canReviewListings = hasListingReviewAccess(permissions);
    } catch (error) {
      console.error("Moderationsrechte konnten nicht geprüft werden:", error);
    }
  }

  return (
    <>
      <SiteHeader />
      <main className="page-shell bg-[var(--surface)] py-10 sm:py-12">
        <div className="site-container">
          <div className="mb-8">
            <DashboardNav canReviewListings={canReviewListings} canManageReferrals={referralAdmin} />
          </div>

          {children}
        </div>
      </main>
    </>
  );
}
