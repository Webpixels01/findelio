import Image from "next/image";
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
import { getDirectusAssetUrl } from "@/lib/directus-assets";
import ListingPostReviewActions from "@/components/listing-post-review-actions";
import DeletionRequestReviewCard from "@/components/deletion-request-review-card";
import { getPendingDeletionRequests } from "@/lib/directus-deletion";

function removeHtml(value: string): string {
  return value
    .replace(/<br\s*\/?\s*>/gi, "\n")
    .replace(/<\/p>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .trim();
}

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

  const [t, tg, td] = await Promise.all([
    getTranslations("ListingReview"),
    getTranslations("Growth"),
    getTranslations("DeletionRequests.admin"),
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

  const [revisions, posts, deletionRequests] = await Promise.all([
    getPendingListingRevisions(accessToken),
    getPendingListingPosts(accessToken),
    getPendingDeletionRequests(accessToken),
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

      {revisions.length === 0 &&
      posts.length === 0 &&
      deletionRequests.length === 0 ? (
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
          <div className="mt-6 grid gap-5">
            {posts.map((post) => {
              const startsAt = post.starts_at
                ? dateFormatter.format(new Date(post.starts_at))
                : "—";
              const endsAt = post.ends_at
                ? dateFormatter.format(new Date(post.ends_at))
                : "—";

              return (
                <article key={post.id} className="rounded-3xl border border-[var(--border)] bg-white p-6 shadow-lg shadow-[#001734]/5 sm:p-8">
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <p className="text-sm font-bold text-[var(--accent)]">
                        {typeof post.listing === "object" ? post.listing.name : ""}
                      </p>
                      <h3 className="mt-2 text-2xl font-extrabold">{post.title}</h3>
                    </div>
                    <span className="w-fit rounded-full bg-[#eaf4ff] px-3 py-1.5 text-sm font-extrabold text-[var(--accent)]">
                      {tg(`posts.types.${post.type}`)}
                    </span>
                  </div>

                  <div className="mt-6 grid gap-6 border-t border-[var(--border)] pt-6 lg:grid-cols-[minmax(260px,0.8fr)_minmax(0,1.2fr)]">
                    <div>
                      <p className="text-sm font-extrabold">{tg("posts.image")}</p>
                      {post.image ? (
                        <a
                          href={getDirectusAssetUrl(post.image)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="relative mt-3 block aspect-video overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--surface)]"
                        >
                          <Image
                            src={getDirectusAssetUrl(post.image)}
                            alt={post.title}
                            fill
                            sizes="(max-width: 1024px) 100vw, 40vw"
                            className="object-cover"
                          />
                        </a>
                      ) : (
                        <div className="mt-3 flex aspect-video items-center justify-center rounded-2xl border border-dashed border-[var(--border)] bg-[var(--surface)] text-[var(--muted)]">
                          —
                        </div>
                      )}
                    </div>

                    <div className="grid content-start gap-5">
                      <section>
                        <p className="text-sm font-extrabold">{tg("posts.body")}</p>
                        <p className="mt-2 whitespace-pre-line text-[var(--muted)]">
                          {post.body ? removeHtml(post.body) : "—"}
                        </p>
                      </section>

                      <dl className="grid gap-4 sm:grid-cols-2">
                        <div className="rounded-2xl bg-[var(--surface)] p-4">
                          <dt className="text-sm font-extrabold">{tg("posts.startsAt")}</dt>
                          <dd className="mt-1 text-[var(--muted)]">{startsAt}</dd>
                        </div>
                        <div className="rounded-2xl bg-[var(--surface)] p-4">
                          <dt className="text-sm font-extrabold">{tg("posts.endsAt")}</dt>
                          <dd className="mt-1 text-[var(--muted)]">{endsAt}</dd>
                        </div>
                      </dl>

                      <dl className="grid gap-4 sm:grid-cols-2">
                        <div>
                          <dt className="text-sm font-extrabold">{tg("posts.buttonLabel")}</dt>
                          <dd className="mt-1 text-[var(--muted)]">{post.cta_label || "—"}</dd>
                        </div>
                        <div>
                          <dt className="text-sm font-extrabold">{tg("posts.buttonUrl")}</dt>
                          <dd className="mt-1 break-all">
                            {post.cta_url ? (
                              <a href={post.cta_url} target="_blank" rel="noopener noreferrer" className="font-bold text-[var(--accent)] underline decoration-1 underline-offset-4">
                                {post.cta_url}
                              </a>
                            ) : "—"}
                          </dd>
                        </div>
                      </dl>
                    </div>
                  </div>

                  <ListingPostReviewActions postId={post.id} />
                </article>
              );
            })}
          </div>
        </section>
      )}

      {deletionRequests.length > 0 && (
        <section className="mt-10">
          <p className="eyebrow">{td("eyebrow")}</p>
          <h2 className="mt-3 text-3xl font-extrabold">
            {td("title")}
          </h2>
          <p className="mt-3 max-w-3xl text-[var(--muted)]">
            {td("description")}
          </p>
          <div className="mt-6 grid gap-5">
            {deletionRequests.map((request) => (
              <DeletionRequestReviewCard key={request.id} request={request} />
            ))}
          </div>
        </section>
      )}
    </>
  );
}
