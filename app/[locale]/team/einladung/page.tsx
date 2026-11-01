import { setRequestLocale } from "next-intl/server";
import type { AppLocale } from "@/i18n/routing";
import SiteHeader from "@/components/site-header";
import TeamInvitationAcceptance from "@/components/team-invitation-acceptance";
import { getCurrentUser } from "@/lib/auth";
import {
  DirectusTeamError,
  getPublicTeamInvitation,
  type PublicTeamInvitation,
} from "@/lib/directus-team";
import { privatePageMetadata } from "@/lib/seo";

export const metadata = privatePageMetadata;

const tokenPattern = /^[A-Za-z0-9_-]{40,100}$/;

export default async function TeamInvitationPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: AppLocale }>;
  searchParams: Promise<{ token?: string }>;
}) {
  const [{ locale }, query] = await Promise.all([params, searchParams]);
  setRequestLocale(locale);

  const token = typeof query.token === "string" ? query.token.trim() : "";
  let invitation: PublicTeamInvitation | null = null;
  let errorState: "invalid" | "expired" | undefined;

  if (!tokenPattern.test(token)) {
    errorState = "invalid";
  } else {
    try {
      invitation = await getPublicTeamInvitation(token);
    } catch (error) {
      errorState =
        error instanceof DirectusTeamError && error.status === 410
          ? "expired"
          : "invalid";
    }
  }

  const user = await getCurrentUser();

  return (
    <>
      <SiteHeader />
      <main className="page-shell bg-[var(--surface)] py-12 lg:py-16">
        <div className="site-container max-w-3xl">
          <TeamInvitationAcceptance
            token={token}
            invitation={invitation}
            currentUserEmail={user?.email ?? null}
            errorState={errorState}
          />
        </div>
      </main>
    </>
  );
}
