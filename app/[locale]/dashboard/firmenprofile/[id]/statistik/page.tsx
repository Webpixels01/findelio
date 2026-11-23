import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import type { AppLocale } from "@/i18n/routing";
import { getAccessToken, requireCurrentUser } from "@/lib/auth";
import { getAccountListingBillingData } from "@/lib/directus-account";
import { getListingMetricSummary } from "@/lib/directus-growth";

export default async function StatisticsPage({ params, searchParams }: { params: Promise<{ locale: AppLocale; id: string }>; searchParams: Promise<{ days?: string }> }) {
  const [{ locale, id }, query] = await Promise.all([params, searchParams]);
  setRequestLocale(locale);
  const days = [30, 90, 365].includes(Number(query.days)) ? Number(query.days) : 30;
  const [t] = await Promise.all([getTranslations("Growth.statistics"), requireCurrentUser({ locale, nextPath: `/${locale}/dashboard/firmenprofile/${id}/statistik` })]);
  const token = await getAccessToken(); if (!token) notFound();
  const billing = await getAccountListingBillingData(token, id); if (!billing?.premiumEnabled) notFound();
  const summary = await getListingMetricSummary(token, id, days);
  const metrics = Object.entries(summary) as Array<[keyof typeof summary, number]>;
  return <><Link href="/dashboard/firmenprofile" className="font-extrabold text-[var(--accent)]">← {t("back")}</Link><header className="mt-6"><p className="eyebrow">{t("eyebrow")}</p><h1 className="mt-3 text-4xl font-extrabold">{t("pageTitle", { name: billing.listing.name })}</h1><p className="mt-4 text-lg text-[var(--muted)]">{t("description")}</p><div className="mt-5 flex gap-2">{[30,90,365].map((value) => <Link key={value} href={`/dashboard/firmenprofile/${id}/statistik?days=${value}`} className={days === value ? "primary-button h-10 px-4" : "secondary-button h-10 px-4"}>{t("days", { count: value })}</Link>)}</div></header><section className="mt-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">{metrics.map(([key, value]) => <article key={key} className="rounded-3xl border border-[var(--border)] bg-white p-6 shadow-lg shadow-[#001734]/5"><p className="text-sm font-bold text-[var(--muted)]">{t(`metrics.${key}`)}</p><p className="mt-3 text-4xl font-extrabold">{value.toLocaleString(locale)}</p></article>)}</section><p className="mt-6 text-sm text-[var(--muted)]">{t("privacyHint")}</p></>;
}
