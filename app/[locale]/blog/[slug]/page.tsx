import type { Metadata } from "next";
import Image from "next/image";
import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { AppLocale } from "@/i18n/routing";
import { Link } from "@/i18n/navigation";
import SiteHeader from "@/components/site-header";
import ShareButton from "@/components/share-button";
import StructuredData from "@/components/structured-data";
import BlogPostCard from "@/components/blog-post-card";
import {
  getBlogCoverImageId,
  getBlogReadingMinutes,
  getPublishedBlogPostBySlug,
  getRelatedBlogPosts,
} from "@/lib/directus-blog";
import { getDirectusAssetUrl } from "@/lib/directus-assets";
import {
  absoluteUrl,
  buildPageMetadata,
  htmlLanguageTags,
  localizedUrl,
} from "@/lib/seo";

export const dynamic = "force-dynamic";

type BlogArticlePageProps = {
  params: Promise<{
    locale: AppLocale;
    slug: string;
  }>;
};

export async function generateMetadata({
  params,
}: BlogArticlePageProps): Promise<Metadata> {
  const { locale, slug } = await params;
  const post = await getPublishedBlogPostBySlug(locale, slug);

  if (!post) return {};

  const coverImageId = getBlogCoverImageId(post);

  return buildPageMetadata({
    locale,
    path: `/blog/${post.slug}`,
    title: post.seo_title?.trim() || `${post.title} | Findelio`,
    description: post.seo_description?.trim() || post.excerpt,
    image: coverImageId ? getDirectusAssetUrl(coverImageId) : null,
    imageAlt: post.cover_alt?.trim() || post.title,
    includeLanguageAlternates: false,
    openGraphType: "article",
  });
}

export default async function BlogArticlePage({
  params,
}: BlogArticlePageProps) {
  const { locale, slug } = await params;
  setRequestLocale(locale);

  const post = await getPublishedBlogPostBySlug(locale, slug);
  if (!post) notFound();

  const [t, relatedPosts] = await Promise.all([
    getTranslations("Blog"),
    getRelatedBlogPosts(post),
  ]);
  const coverImageId = getBlogCoverImageId(post);
  const coverImageUrl = coverImageId
    ? getDirectusAssetUrl(coverImageId)
    : null;
  const publishedDate = new Intl.DateTimeFormat(htmlLanguageTags[locale], {
    dateStyle: "long",
  }).format(new Date(post.published_at));
  const readingMinutes = getBlogReadingMinutes(post.body);
  const articleUrl = localizedUrl(locale, `/blog/${post.slug}`);
  const structuredData = [
    {
      "@context": "https://schema.org",
      "@type": "BlogPosting",
      headline: post.title,
      description: post.seo_description?.trim() || post.excerpt,
      ...(coverImageUrl
        ? {
            image: `${coverImageUrl}?width=1200&height=675&fit=cover&quality=88`,
          }
        : {}),
      datePublished: post.published_at,
      dateModified: post.date_updated ?? post.published_at,
      inLanguage: htmlLanguageTags[locale],
      mainEntityOfPage: articleUrl,
      author: {
        "@type": "Organization",
        name: post.author_name,
      },
      publisher: {
        "@type": "Organization",
        name: "Findelio",
        logo: {
          "@type": "ImageObject",
          url: absoluteUrl("/findelio-logo-horizontal.svg"),
        },
      },
    },
    {
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      itemListElement: [
        {
          "@type": "ListItem",
          position: 1,
          name: t("breadcrumbHome"),
          item: localizedUrl(locale),
        },
        {
          "@type": "ListItem",
          position: 2,
          name: t("breadcrumbBlog"),
          item: localizedUrl(locale, "/blog"),
        },
        {
          "@type": "ListItem",
          position: 3,
          name: post.title,
          item: articleUrl,
        },
      ],
    },
  ];

  return (
    <>
      <SiteHeader />
      <StructuredData data={structuredData} />
      <main className="page-shell bg-white">
        <article>
          <header className="border-b border-[var(--border)] bg-[var(--surface)] py-12 sm:py-16">
            <div className="site-container max-w-4xl">
              <nav aria-label={t("breadcrumbs")} className="text-sm font-bold text-[var(--muted)]">
                <Link href="/" className="hover:text-[var(--accent)]">
                  {t("breadcrumbHome")}
                </Link>
                <span className="mx-2" aria-hidden="true">/</span>
                <Link href="/blog" className="hover:text-[var(--accent)]">
                  {t("breadcrumbBlog")}
                </Link>
              </nav>

              <div className="mt-8 flex flex-wrap items-center gap-x-3 gap-y-2 text-sm font-bold text-[var(--muted)]">
                {post.category ? (
                  <Link
                    href={`/blog?category=${encodeURIComponent(post.category.trim())}`}
                    className="inline-flex min-h-11 items-center rounded-full bg-[#eaf5ff] px-3 text-[var(--accent)] transition-colors hover:bg-[#d7ebff] hover:text-[var(--foreground)]"
                  >
                    {post.category}
                  </Link>
                ) : null}
                <time dateTime={post.published_at}>{publishedDate}</time>
                <span aria-hidden="true">·</span>
                <span>{t("readingTime", { minutes: readingMinutes })}</span>
              </div>

              <h1 className="mt-5 text-4xl font-extrabold leading-[1.08] tracking-tight sm:text-6xl">
                {post.title}
              </h1>
              <p className="mt-6 text-xl leading-8 text-[var(--muted)] sm:text-2xl sm:leading-9">
                {post.excerpt}
              </p>
              <div className="mt-7 flex flex-wrap items-center gap-4">
                <p className="font-bold text-[var(--muted)]">
                  {t("byAuthor", { author: post.author_name })}
                </p>
                <ShareButton variant="inline" />
              </div>
            </div>
          </header>

          {coverImageUrl ? (
            <div className="site-container max-w-5xl pt-10 sm:pt-14">
              <div className="relative aspect-[16/9] overflow-hidden rounded-3xl bg-[var(--surface)]">
                <Image
                  src={`${coverImageUrl}?width=1600&height=900&fit=cover&quality=88`}
                  alt={post.cover_alt?.trim() || post.title}
                  fill
                  preload
                  sizes="(min-width: 1200px) 960px, calc(100vw - 32px)"
                  className="object-cover"
                />
              </div>
            </div>
          ) : null}

          <div className="site-container max-w-3xl py-12 sm:py-16">
            <div className="blog-content">
              <ReactMarkdown
                remarkPlugins={[remarkGfm]}
                components={{
                  h2: ({ children }) => <h2>{children}</h2>,
                  h3: ({ children }) => <h3>{children}</h3>,
                  p: ({ children }) => <p>{children}</p>,
                  ul: ({ children }) => <ul>{children}</ul>,
                  ol: ({ children }) => <ol>{children}</ol>,
                  li: ({ children }) => <li>{children}</li>,
                  blockquote: ({ children }) => <blockquote>{children}</blockquote>,
                  a: ({ href, children }) => (
                    <a
                      href={href}
                      {...(href?.startsWith("http")
                        ? { target: "_blank", rel: "noreferrer" }
                        : {})}
                    >
                      {children}
                    </a>
                  ),
                  table: ({ children }) => <table>{children}</table>,
                  thead: ({ children }) => <thead>{children}</thead>,
                  tbody: ({ children }) => <tbody>{children}</tbody>,
                  tr: ({ children }) => <tr>{children}</tr>,
                  th: ({ children }) => <th>{children}</th>,
                  td: ({ children }) => <td>{children}</td>,
                }}
              >
                {post.body}
              </ReactMarkdown>
            </div>

            <div className="mt-12 border-t border-[var(--border)] pt-8">
              <Link
                href="/blog"
                className="inline-flex min-h-11 items-center gap-2 font-extrabold text-[var(--accent)] transition-colors hover:text-[var(--foreground)]"
              >
                <span aria-hidden="true">←</span>
                <span className="underline decoration-2 underline-offset-4">
                  {t("backToBlog")}
                </span>
              </Link>
            </div>
          </div>
        </article>

        {relatedPosts.length ? (
          <section className="border-t border-[var(--border)] bg-[var(--surface)] py-14 sm:py-18" aria-labelledby="related-articles-title">
            <div className="site-container">
              <h2 id="related-articles-title" className="text-3xl font-extrabold">
                {t("relatedArticles")}
              </h2>
              <div className="mt-7 grid gap-6 lg:grid-cols-3">
                {relatedPosts.map((relatedPost) => (
                  <BlogPostCard
                    key={relatedPost.id}
                    post={relatedPost}
                    locale={locale}
                    readingTimeLabel={t("readingTime", {
                      minutes: getBlogReadingMinutes(relatedPost.body),
                    })}
                    readArticleLabel={t("readArticle")}
                  />
                ))}
              </div>
            </div>
          </section>
        ) : null}
      </main>
    </>
  );
}
