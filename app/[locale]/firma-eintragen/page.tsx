import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { redirect } from "next/navigation";
import type { AppLocale } from "@/i18n/routing";
import SiteHeader from "@/components/site-header";
import RegisterForm from "@/components/register-form";
import { getCurrentUser } from "@/lib/auth";
import {
  DirectusTeamError,
  getPublicTeamInvitation,
  type PublicTeamInvitation,
} from "@/lib/directus-team";
import { isReferralRegistrationEnabled } from "@/lib/referral-registration";
import { buildPageMetadata } from "@/lib/seo";

type RegisterPageProps = {
  params: Promise<{ locale: AppLocale }>;
  searchParams?: Promise<{
    email?: string;
    invitation?: string;
    ref?: string;
  }>;
};

const invitationTokenPattern = /^[A-Za-z0-9_-]{40,100}$/;

export async function generateMetadata({
  params,
}: RegisterPageProps): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "Register" });

  return buildPageMetadata({
    locale,
    path: "/firma-eintragen",
    title: `${t("title")} | Findelio`,
    description: t("description"),
  });
}

export default async function RegisterPage({
  params,
  searchParams,
}: RegisterPageProps) {
  const resolvedSearchParams: Promise<{
    email?: string;
    invitation?: string;
    ref?: string;
  }> = searchParams ?? Promise.resolve({});
  const [{ locale }, query] = await Promise.all([
    params,
    resolvedSearchParams,
  ]);
  setRequestLocale(locale);
  const invitationToken =
    typeof query.invitation === "string" ? query.invitation.trim() : "";
  const referralRegistrationEnabled = isReferralRegistrationEnabled();
  const initialReferralCode =
    referralRegistrationEnabled && typeof query.ref === "string"
      ? query.ref.trim().slice(0, 64)
      : "";
  let invitation: PublicTeamInvitation | null = null;

  if (invitationTokenPattern.test(invitationToken)) {
    try {
      invitation = await getPublicTeamInvitation(invitationToken);
    } catch (error) {
      if (!(error instanceof DirectusTeamError)) throw error;
      redirect(
        `/${locale}/team/einladung?token=${encodeURIComponent(invitationToken)}`,
      );
    }
  } else if (invitationToken) {
    redirect(`/${locale}/team/einladung`);
  }

  if (invitation && (await getCurrentUser())) {
    redirect(
      `/${locale}/team/einladung?token=${encodeURIComponent(invitationToken)}`,
    );
  }

  const [t, invitationT] = await Promise.all([
    getTranslations("Register"),
    getTranslations("TeamInvitation"),
  ]);
  const title = invitation
    ? invitationT("title", { organization: invitation.organization_name })
    : t("title");
  const description = invitation
    ? invitationT("registrationDescription", {
        organization: invitation.organization_name,
      })
    : t("description");

  return (
    <>
      <SiteHeader />
      <main className="page-shell bg-[var(--surface)] py-12 lg:py-16">
        <div className="site-container max-w-3xl">
          <div className="text-center">
            <p className="eyebrow">
              {invitation ? invitationT("eyebrow") : t("eyebrow")}
            </p>
            <h1 className="mt-3 text-4xl font-extrabold tracking-tight sm:text-5xl">
              {title}
            </h1>
            <p className="mx-auto mt-4 max-w-2xl text-lg leading-8 text-[var(--muted)]">
              {description}
            </p>
          </div>
          <div className="mt-9">
            <RegisterForm
              initialEmail={
                invitation?.email ??
                (typeof query.email === "string"
                  ? query.email.slice(0, 254)
                  : "")
              }
              invitationToken={invitation ? invitationToken : ""}
              referralRegistrationEnabled={referralRegistrationEnabled}
              initialReferralCode={invitation ? "" : initialReferralCode}
            />
          </div>
        </div>
      </main>
    </>
  );
}
