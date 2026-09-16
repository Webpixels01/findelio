import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import type { AppLocale } from "@/i18n/routing";
import { getAccessToken, requireCurrentUser } from "@/lib/auth";
import { getAccountListingBillingData } from "@/lib/directus-account";
import { getAccountListingPosts } from "@/lib/directus-growth";
import ListingPostManager from "@/components/listing-post-manager";

export default async function PostsPage({ params }: { params: Promise<{ locale: AppLocale; id: string }> }) {
  const { locale, id } = await params;
  setRequestLocale(locale);
  const [t] = await Promise.all([getTranslations("Growth.posts"), requireCurrentUser({ locale, nextPath: `/${locale}/dashboard/firmenprofile/${id}/beitraege` })]);
  const token = await getAccessToken();
  if (!token) notFound();
  const billing = await getAccountListingBillingData(token, id);
  if (!billing?.premiumEnabled) notFound();
  const posts = await getAccountListingPosts(token, id);
  return <><Link href="/dashboard/firmenprofile" className="font-extrabold text-[var(--accent)]">← {t("back")}</Link><header className="mt-6"><p className="eyebrow">{t("eyebrow")}</p><h1 className="mt-3 text-4xl font-extrabold">{t("pageTitle", { name: billing.listing.name })}</h1><p className="mt-4 max-w-3xl text-lg text-[var(--muted)]">{t("description")}</p></header><ListingPostManager listingId={id} posts={posts} /></>;
}
