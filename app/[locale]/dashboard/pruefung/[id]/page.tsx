import { getTranslations, setRequestLocale } from "next-intl/server";
import Image from "next/image";
import { notFound, redirect } from "next/navigation";
import ListingReviewActions from "@/components/listing-review-actions";
import { Link } from "@/i18n/navigation";
import type { AppLocale } from "@/i18n/routing";
import { getAccessToken, requireCurrentUser } from "@/lib/auth";
import {
  getDirectusCurrentUserPermissions,
  hasListingReviewAccess,
} from "@/lib/directus-auth";
import {
  getPendingListingRevision,
  getReviewOptionMaps,
  type ListingRevisionChangedValue,
  type ReviewOptionMaps,
} from "@/lib/directus-review";
import { getDirectusAssetUrl } from "@/lib/directus-assets";

function submitterName(
  submitter: {
    first_name: string | null;
    last_name: string | null;
    email: string;
  } | null,
  fallback: string,
): string {
  if (!submitter) return fallback;
  return [submitter.first_name, submitter.last_name].filter(Boolean).join(" ") || submitter.email;
}

function valueLabel(
  field: string,
  value: unknown,
  options: ReviewOptionMaps,
  addressVisibilityLabels: Record<string, string>,
  weekdayLabels: Record<number, string>,
  emptyLabel: string,
): string {
  if (value === null || value === undefined || value === "") return emptyLabel;

  if (field === "canton" && typeof value === "string") {
    return options.cantons[value] ?? value;
  }

  if (field === "industry_ids" && Array.isArray(value)) {
    return value.map((id) => typeof id === "string" ? options.industries[id] ?? id : String(id)).join(", ");
  }

  if (field === "spoken_language_ids" && Array.isArray(value)) {
    return value.map((id) => typeof id === "string" ? options.spokenLanguages[id] ?? id : String(id)).join(", ");
  }

  if (field === "address_visibility" && typeof value === "string") {
    return addressVisibilityLabels[value] ?? value;
  }

  if (field === "gallery_file_ids" && Array.isArray(value)) {
    return value.map(String).join("\n");
  }

  if (field === "social_links" && Array.isArray(value)) {
    return value
      .map((item) => {
        if (!item || typeof item !== "object") return String(item);
        const link = item as { platform?: unknown; url?: unknown };
        return `${String(link.platform ?? "")}: ${String(link.url ?? "")}`;
      })
      .join("\n");
  }

  if (field === "opening_hours" && Array.isArray(value)) {
    return value
      .map((item) => {
        if (!item || typeof item !== "object") return String(item);
        const interval = item as {
          day_of_week?: unknown;
          opens_at?: unknown;
          closes_at?: unknown;
        };
        const day =
          typeof interval.day_of_week === "number"
            ? weekdayLabels[interval.day_of_week] ??
              String(interval.day_of_week)
            : String(interval.day_of_week ?? "");
        return `${day}: ${String(interval.opens_at ?? "").slice(0, 5)}–${String(interval.closes_at ?? "").slice(0, 5)}`;
      })
      .join("\n");
  }

  if (typeof value === "boolean") return value ? "Ja" : "Nein";
  if (Array.isArray(value)) return value.map(String).join(", ");
  if (typeof value === "object") return JSON.stringify(value, null, 2);
  return String(value);
}

function mediaFileIds(field: string, value: unknown): string[] | null {
  if (field === "logo_id") {
    return typeof value === "string" && value ? [value] : [];
  }

  if (field === "gallery_file_ids" && Array.isArray(value)) {
    return value.filter((item): item is string => typeof item === "string");
  }

  return null;
}

function ReviewValue({
  field,
  value,
  fallback,
  emptyLabel,
  emphasized = false,
}: {
  field: string;
  value: unknown;
  fallback: string;
  emptyLabel: string;
  emphasized?: boolean;
}) {
  const fileIds = mediaFileIds(field, value);

  if (fileIds === null) {
    return (
      <p
        className={`mt-2 whitespace-pre-wrap break-words ${
          emphasized ? "font-bold" : ""
        }`}
      >
        {fallback}
      </p>
    );
  }

  if (fileIds.length === 0) {
    return <p className="mt-2">{emptyLabel}</p>;
  }

  return (
    <div className="mt-3 grid gap-3 sm:grid-cols-2">
      {fileIds.map((fileId) => (
        <a
          key={fileId}
          href={getDirectusAssetUrl(fileId)}
          target="_blank"
          rel="noreferrer"
          className="relative block aspect-[4/3] overflow-hidden rounded-xl border border-[var(--border)] bg-white"
        >
          <Image
            src={getDirectusAssetUrl(fileId)}
            alt=""
            fill
            sizes="240px"
            className={
              field === "logo_id" ? "object-contain p-2" : "object-cover"
            }
          />
        </a>
      ))}
    </div>
  );
}

export default async function ListingReviewDetailPage({
  params,
}: {
  params: Promise<{ locale: AppLocale; id: string }>;
}) {
  const { locale, id } = await params;
  setRequestLocale(locale);

  const [t, tEditor, tCompany] = await Promise.all([
    getTranslations("ListingReview"),
    getTranslations("ListingEditor"),
    getTranslations("Company"),
    requireCurrentUser({
      locale,
      nextPath: `/${locale}/dashboard/pruefung/${id}`,
    }),
  ]);

  const accessToken = await getAccessToken();
  if (!accessToken) notFound();

  const permissions = await getDirectusCurrentUserPermissions(accessToken);
  if (!hasListingReviewAccess(permissions)) {
    redirect(`/${locale}/dashboard`);
  }

  const [revision, optionMaps] = await Promise.all([
    getPendingListingRevision(accessToken, id),
    getReviewOptionMaps(accessToken, locale),
  ]);

  if (!revision) notFound();

  const changes = Object.entries(revision.changed_fields ?? {}) as Array<
    [string, ListingRevisionChangedValue]
  >;
  const addressVisibilityLabels = {
    full: tEditor("addressVisibility.full"),
    city: tEditor("addressVisibility.city"),
    hidden: tEditor("addressVisibility.hidden"),
  };
  const weekdayLabels = Object.fromEntries(
    Array.from({ length: 7 }, (_, index) => [
      index + 1,
      tCompany(`weekdays.${index + 1}`),
    ]),
  );
  const dateFormatter = new Intl.DateTimeFormat(locale, {
    dateStyle: "medium",
    timeStyle: "short",
  });
  const submittedAt = revision.submitted_at
    ? dateFormatter.format(new Date(revision.submitted_at))
    : t("unknownDate");

  return (
    <>
      <Link
        href="/dashboard/pruefung"
        className="inline-flex items-center gap-2 text-sm font-extrabold text-[var(--accent)] hover:underline"
      >
        ← {t("detail.back")}
      </Link>

      <header className="mt-6">
        <p className="eyebrow">{t("detail.eyebrow")}</p>
        <h1 className="mt-3 text-4xl font-extrabold tracking-tight">
          {revision.listing.name}
        </h1>
        <p className="mt-4 text-[var(--muted)]">
          {t("submittedBy", {
            name: submitterName(revision.submitted_by, t("unknownSubmitter")),
            date: submittedAt,
          })}
        </p>
      </header>

      <div className="mt-8 grid gap-6 xl:grid-cols-[minmax(0,1fr)_420px]">
        <section className="rounded-3xl border border-[var(--border)] bg-white p-6 shadow-lg shadow-[#001734]/5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-sm font-bold text-[var(--accent)]">
                {revision.listing.organization?.name ?? t("unknownOrganization")}
              </p>
              <h2 className="mt-1 text-2xl font-extrabold">{t("detail.changesTitle")}</h2>
            </div>
            <span className="rounded-full bg-[var(--surface)] px-3 py-1.5 text-sm font-bold text-[#40536b]">
              {t("changedFields", { count: changes.length })}
            </span>
          </div>

          {changes.length === 0 ? (
            <p className="mt-6 rounded-2xl bg-[var(--surface)] p-5 text-[var(--muted)]">
              {t("detail.noChanges")}
            </p>
          ) : (
            <div className="mt-6 grid gap-5">
              {changes.map(([field, change]) => (
                <article key={field} className="overflow-hidden rounded-2xl border border-[var(--border)]">
                  <h3 className="bg-[var(--surface)] px-5 py-3 font-extrabold">
                    {t.has(`detail.fields.${field}`) ? t(`detail.fields.${field}`) : field}
                  </h3>
                  <div className="grid md:grid-cols-2">
                    <div className="border-b border-[var(--border)] p-5 md:border-b-0 md:border-r">
                      <p className="text-xs font-extrabold uppercase tracking-wider text-[var(--muted)]">
                        {t("detail.oldValue")}
                      </p>
                      <ReviewValue
                        field={field}
                        value={change.old}
                        fallback={valueLabel(
                          field,
                          change.old,
                          optionMaps,
                          addressVisibilityLabels,
                          weekdayLabels,
                          t("detail.emptyValue"),
                        )}
                        emptyLabel={t("detail.emptyValue")}
                      />
                    </div>
                    <div className="bg-[#f2f9ff] p-5">
                      <p className="text-xs font-extrabold uppercase tracking-wider text-[var(--accent)]">
                        {t("detail.newValue")}
                      </p>
                      <ReviewValue
                        field={field}
                        value={change.new}
                        fallback={valueLabel(
                          field,
                          change.new,
                          optionMaps,
                          addressVisibilityLabels,
                          weekdayLabels,
                          t("detail.emptyValue"),
                        )}
                        emptyLabel={t("detail.emptyValue")}
                        emphasized
                      />
                    </div>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>

        <ListingReviewActions revisionId={revision.id} />
      </div>
    </>
  );
}
