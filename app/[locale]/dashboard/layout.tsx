import { hasLocale } from "next-intl";
import { setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import DashboardNav from "@/components/dashboard-nav";
import LogoutButton from "@/components/logout-button";
import SiteHeader from "@/components/site-header";
import { routing } from "@/i18n/routing";
import { getAccessToken, requireCurrentUser } from "@/lib/auth";
import {
  getDirectusCurrentUserPermissions,
  hasListingReviewAccess,
} from "@/lib/directus-auth";

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

  await requireCurrentUser({
    locale,
    nextPath: `/${locale}/dashboard`,
  });

  const accessToken = await getAccessToken();
  let canReviewListings = false;

  if (accessToken) {
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
          <div className="mb-8 flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
            <div className="min-w-0 flex-1">
              <DashboardNav canReviewListings={canReviewListings} />
            </div>
            <LogoutButton />
          </div>

          {children}
        </div>
      </main>
    </>
  );
}
