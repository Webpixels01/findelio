import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import type { AppLocale } from "@/i18n/routing";
import { Link } from "@/i18n/navigation";
import SiteHeader from "@/components/site-header";
import BlogPostCard from "@/components/blog-post-card";
import StructuredData from "@/components/structured-data";
import {
  getBlogReadingMinutes,
  getPublishedBlogPosts,
} from "@/lib/directus-blog";
import { buildPageMetadata, localizedUrl } from "@/lib/seo";

export const dynamic = "force-dynamic";

type BlogPageProps = {
  params: Promise<{ locale: AppLocale }>;
  searchParams: Promise<{ category?: string | string[] }>;
};

export async function generateMetadata({
  params,
}: BlogPageProps): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "Blog" });

  return buildPageMetadata({
    locale,
    path: "/blog",
    title: t("metaTitle"),
    description: t("metaDescription"),
  });
}

export default async function BlogPage({ params, searchParams }: BlogPageProps) {
  const [{ locale }, query] = await Promise.all([params, searchParams]);
  setRequestLocale(locale);

  const [t, posts] = await Promise.all([
    getTranslations("Blog"),
    getPublishedBlogPosts(locale),
  ]);
  const categories = Array.from(
    new Set(
      posts
        .map((post) => post.category?.trim())
        .filter((category): category is string => Boolean(category)),
    ),
  ).sort((first, second) => first.localeCompare(second, locale));
  const requestedCategory =
    typeof query.category === "string" ? query.category.trim() : "";
  const selectedCategory =
    categories.find(
      (category) =>
        category.localeCompare(requestedCategory, locale, {
          sensitivity: "base",
        }) === 0,
    ) ?? null;
  const visiblePosts = selectedCategory
    ? posts.filter((post) => post.category?.trim() === selectedCategory)
    : posts;
  const featuredPost =
    visiblePosts.find((post) => post.featured) ?? visiblePosts[0] ?? null;
  const remainingPosts = featuredPost
    ? visiblePosts.filter((post) => post.id !== featuredPost.id)
    : [];
  const collectionData = visiblePosts.length
    ? {
        "@context": "https://schema.org",
        "@type": "CollectionPage",
        name: t("title"),
        description: t("intro"),
        url: localizedUrl(locale, "/blog"),
        mainEntity: {
          "@type": "ItemList",
          itemListElement: visiblePosts.map((post, index) => ({
            "@type": "ListItem",
            position: index + 1,
            name: post.title,
            url: localizedUrl(locale, `/blog/${post.slug}`),
          })),
        },
      }
    : null;

  return (
    <>
      <SiteHeader />
      {collectionData ? <StructuredData data={collectionData} /> : null}
      <main className="page-shell bg-[var(--surface)] py-14 sm:py-20">
        <div className="site-container">
          <header className="mx-auto max-w-4xl text-center">
            <p className="eyebrow">{t("eyebrow")}</p>
            <h1 className="mt-3 text-4xl font-extrabold tracking-tight sm:text-6xl">
              {t("title")}
            </h1>
            <p className="mx-auto mt-5 max-w-3xl text-lg leading-8 text-[var(--muted)]">
              {t("intro")}
            </p>
          </header>

          {categories.length > 1 ? (
            <nav
              aria-label={t("categoryFilterLabel")}
              className="mx-auto mt-10 max-w-4xl text-center"
            >
              <p className="text-sm font-extrabold text-[var(--muted)]">
                {t("categoryFilterLabel")}
              </p>
              <div className="mt-4 flex flex-wrap justify-center gap-2">
                <Link
                  href="/blog"
                  aria-current={selectedCategory ? undefined : "page"}
                  className={`inline-flex min-h-11 items-center rounded-full border px-4 font-extrabold transition-colors ${
                    selectedCategory
                      ? "border-[var(--border)] bg-white text-[var(--accent)] hover:border-[#b9d9f8] hover:bg-[#eaf5ff] hover:text-[var(--foreground)]"
                      : "border-[var(--foreground)] bg-[var(--foreground)] text-white"
                  }`}
                >
                  {t("allCategories")}
                </Link>
                {categories.map((category) => {
                  const active = category === selectedCategory;

                  return (
                    <Link
                      key={category}
                      href={`/blog?category=${encodeURIComponent(category)}`}
                      aria-current={active ? "page" : undefined}
                      className={`inline-flex min-h-11 items-center rounded-full border px-4 font-extrabold transition-colors ${
                        active
                          ? "border-[var(--foreground)] bg-[var(--foreground)] text-white"
                          : "border-[var(--border)] bg-white text-[var(--accent)] hover:border-[#b9d9f8] hover:bg-[#eaf5ff] hover:text-[var(--foreground)]"
                      }`}
                    >
                      {category}
                    </Link>
                  );
                })}
              </div>
            </nav>
          ) : null}

          {featuredPost ? (
            <div className="mt-12 space-y-8">
              <BlogPostCard
                post={featuredPost}
                locale={locale}
                featured
                readingTimeLabel={t("readingTime", {
                  minutes: getBlogReadingMinutes(featuredPost.body),
                })}
                readArticleLabel={t("readArticle")}
              />

              {remainingPosts.length ? (
                <section aria-labelledby="more-articles-title" className="pt-5">
                  <h2 id="more-articles-title" className="text-3xl font-extrabold">
                    {t("moreArticles")}
                  </h2>
                  <div className="mt-7 grid gap-6 lg:grid-cols-3">
                    {remainingPosts.map((post) => (
                      <BlogPostCard
                        key={post.id}
                        post={post}
                        locale={locale}
                        readingTimeLabel={t("readingTime", {
                          minutes: getBlogReadingMinutes(post.body),
                        })}
                        readArticleLabel={t("readArticle")}
                      />
                    ))}
                  </div>
                </section>
              ) : null}
            </div>
          ) : (
            <section className="mx-auto mt-12 max-w-3xl rounded-3xl border border-[var(--border)] bg-white p-8 text-center sm:p-12">
              <h2 className="text-3xl font-extrabold">{t("emptyTitle")}</h2>
              <p className="mx-auto mt-4 max-w-xl text-lg leading-8 text-[var(--muted)]">
                {t("emptyText")}
              </p>
            </section>
          )}

          <section className="mx-auto mt-14 max-w-4xl rounded-3xl bg-[var(--foreground)] p-8 text-center text-white sm:p-12">
            <h2 className="text-3xl font-extrabold">{t("ctaTitle")}</h2>
            <p className="mx-auto mt-4 max-w-2xl text-lg leading-8 text-white/75">
              {t("ctaText")}
            </p>
            <Link href="/unternehmen" className="primary-button mt-7 h-12 px-7">
              {t("ctaButton")}
            </Link>
          </section>
        </div>
      </main>
    </>
  );
}
