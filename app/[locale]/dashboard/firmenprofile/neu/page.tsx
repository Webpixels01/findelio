import { getTranslations, setRequestLocale } from "next-intl/server";
import ListingCreateForm from "@/components/listing-create-form";
import { Link } from "@/i18n/navigation";
import type { AppLocale } from "@/i18n/routing";
import { getAccessToken, requireCurrentUser } from "@/lib/auth";
import { getActiveAccountOrganizations } from "@/lib/directus-account";
import { getCantons } from "@/lib/directus";

export default async function CreateListingPage({
  params,
}: {
  params: Promise<{ locale: AppLocale }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  const [t] = await Promise.all([
    getTranslations("ListingCreator"),
    requireCurrentUser({
      locale,
      nextPath: `/${locale}/dashboard/firmenprofile/neu`,
    }),
  ]);

  const accessToken = await getAccessToken();
  const [organizations, cantons] = accessToken
    ? await Promise.all([
        getActiveAccountOrganizations(accessToken),
        getCantons(),
      ])
    : [[], []];

  return (
    <>
      <Link
        href="/dashboard/firmenprofile"
        className="inline-flex font-extrabold text-[var(--accent)] hover:underline"
      >
        ← {t("back")}
      </Link>

      <header className="mt-6">
        <p className="eyebrow">{t("eyebrow")}</p>
        <h1 className="mt-3 text-4xl font-extrabold tracking-tight">
          {t("title")}
        </h1>
        <p className="mt-4 max-w-3xl text-lg text-[var(--muted)]">
          {t("description")}
        </p>
      </header>

      {organizations.length === 0 ? (
        <div className="mt-8 rounded-3xl border border-[var(--border)] bg-white p-7 shadow-xl shadow-[#001734]/6">
          <h2 className="text-xl font-bold">{t("noOrganizationsTitle")}</h2>
          <p className="mt-2 text-[var(--muted)]">
            {t("noOrganizationsDescription")}
          </p>
        </div>
      ) : (
        <ListingCreateForm organizations={organizations} cantons={cantons} />
      )}
    </>
  );
}
