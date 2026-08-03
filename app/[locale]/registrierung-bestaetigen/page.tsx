import { setRequestLocale } from "next-intl/server";
import type { AppLocale } from "@/i18n/routing";
import SiteHeader from "@/components/site-header";
import RegistrationVerification from "@/components/registration-verification";
import { privatePageMetadata } from "@/lib/seo";

export const metadata = privatePageMetadata;

type VerificationPageProps = {
  params: Promise<{ locale: AppLocale }>;
  searchParams: Promise<{ token?: string | string[] }>;
};

export default async function VerificationPage({
  params,
  searchParams,
}: VerificationPageProps) {
  const { locale } = await params;
  const { token } = await searchParams;
  setRequestLocale(locale);

  return (
    <>
      <SiteHeader />
      <main className="page-shell bg-[var(--surface)] py-16">
        <div className="site-container max-w-xl">
          <RegistrationVerification
            token={typeof token === "string" ? token : ""}
          />
        </div>
      </main>
    </>
  );
}
