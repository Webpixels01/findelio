import { getTranslations, setRequestLocale } from "next-intl/server";
import { notFound, redirect } from "next/navigation";
import { Link } from "@/i18n/navigation";
import type { AppLocale } from "@/i18n/routing";
import { getAccessToken, requireCurrentUser } from "@/lib/auth";
import {
  getDirectusCurrentUserPermissions,
  hasListingReviewAccess,
} from "@/lib/directus-auth";
import { getPendingListingRevisions } from "@/lib/directus-review";
import { getPendingListingPosts } from "@/lib/directus-growth";
import ListingPostReviewActions from "@/components/listing-post-review-actions";

function submitterName(
  submitter: {
    first_name: string | null;
    last_name: string | null;
    email: string;
  } | null,
  fallback: string,
): string {
  if (!submitter) return fallback;
  return (
    [submitter.first_name, submitter.last_name].filter(Boolean).join(" ") ||
    submitter.email
  );
}

export default async function ListingReviewPage({
  params,
}: {
  params: Promise<{ locale: AppLocale }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  const [t, tg] = await Promise.all([
    getTranslations("ListingReview"),
    getTranslations("Growth"),
    requireCurrentUser({
      locale,
      nextPath: `/${locale}/dashboard/pruefung`,
    }),
  ]);

  const accessToken = await getAccessToken();

  if (!accessToken) notFound();

  const permissions = await getDirectusCurrentUserPermissions(accessToken);

  if (!hasListingReviewAccess(permissions)) {
    redirect(`/${locale}/dashboard`);
  }

  const [revisions, posts] = await Promise.all([
    getPendingListingRevisions(accessToken),
    getPendingListingPosts(accessToken),
  ]);
  const dateFormatter = new Intl.DateTimeFormat(locale, {
    dateStyle: "medium",
    timeStyle: "short",
  });

  return (
    <>
      <header>
        <p className="eyebrow">{t("eyebrow")}</p>
        <h1 className="mt-3 text-4xl font-extrabold tracking-tight">
          {t("title")}
        </h1>
        <p className="mt-4 max-w-3xl text-lg text-[var(--muted)]">
          {t("description")}
        </p>
      </header>

      {revisions.length === 0 && posts.length === 0 ? (
        <div className="mt-8 rounded-3xl border border-[var(--border)] bg-white p-7 shadow-xl shadow-[#001734]/6">
          <h2 className="text-xl font-bold">{t("emptyTitle")}</h2>
          <p className="mt-2 text-[var(--muted)]">{t("emptyDescription")}</p>
        </div>
      ) : (
        <section className="mt-8 grid gap-5">
          {revisions.map((revision) => {
            const changedCount = Object.keys(
              revision.changed_fields ?? {},
            ).length;
            const submittedAt = revision.submitted_at
              ? dateFormatter.format(new Date(revision.submitted_at))
              : t("unknownDate");

            return (
              <Link
                key={revision.id}
                href={`/dashboard/pruefung/${revision.id}`}
                className="block rounded-3xl border border-[var(--border)] bg-white p-6 shadow-lg shadow-[#001734]/5 transition hover:-translate-y-0.5 hover:border-[var(--accent)] hover:shadow-xl"
              >
                <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
                  <div>
                    <p className="text-sm font-bold text-[var(--accent)]">
                      {revision.listing.organization?.name ?? t("unknownOrganization")}
                    </p>
                    <h2 className="mt-2 text-2xl font-extrabold">
                      {revision.listing.name}
                    </h2>
                    <p className="mt-3 text-[var(--muted)]">
                      {t("submittedBy", {
                        name: submitterName(
                          revision.submitted_by,
                          t("unknownSubmitter"),
                        ),
                        date: submittedAt,
                      })}
                    </p>
                  </div>

                  <div className="flex flex-wrap items-center gap-3">
                    <span className="rounded-full bg-[#fff4d6] px-3 py-1.5 text-sm font-extrabold text-[#765600]">
                      {t("pending")}
                    </span>
                    <span className="rounded-full bg-[var(--surface)] px-3 py-1.5 text-sm font-bold text-[#40536b]">
                      {t("changedFields", { count: changedCount })}
                    </span>
                  </div>
                </div>
              </Link>
            );
          })}
        </section>
      )}

      {posts.length > 0 && (
        <section className="mt-10">
          <p className="eyebrow">{tg("review.eyebrow")}</p>
          <h2 className="mt-3 text-3xl font-extrabold">{tg("review.title")}</h2>
          <div className="mt-6 grid gap-5 lg:grid-cols-2">
            {posts.map((post) => (
              <article key={post.id} className="rounded-3xl border border-[var(--border)] bg-white p-6 shadow-lg shadow-[#001734]/5">
                <p className="text-sm font-bold text-[var(--accent)]">
                  {typeof post.listing === "object" ? post.listing.name : ""}
                </p>
                <h3 className="mt-2 text-2xl font-extrabold">{post.title}</h3>
                {post.excerpt && <p className="mt-3 whitespace-pre-line text-[var(--muted)]">{post.excerpt}</p>}
                <ListingPostReviewActions postId={post.id} />
              </article>
            ))}
          </div>
        </section>
      )}
    </>
  );
}
