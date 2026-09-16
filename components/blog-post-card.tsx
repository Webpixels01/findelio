import Image from "next/image";
import { Link } from "@/i18n/navigation";
import type { AppLocale } from "@/i18n/routing";
import {
  getBlogCoverImageId,
  type BlogPost,
} from "@/lib/directus-blog";
import { getDirectusAssetUrl } from "@/lib/directus-assets";
import { htmlLanguageTags } from "@/lib/seo";

type BlogPostCardProps = {
  post: BlogPost;
  locale: AppLocale;
  readingTimeLabel: string;
  readArticleLabel: string;
  featured?: boolean;
};

export default function BlogPostCard({
  post,
  locale,
  readingTimeLabel,
  readArticleLabel,
  featured = false,
}: BlogPostCardProps) {
  const coverImageId = getBlogCoverImageId(post);
  const publishedDate = new Intl.DateTimeFormat(htmlLanguageTags[locale], {
    dateStyle: "long",
  }).format(new Date(post.published_at));

  return (
    <article
      className={`group overflow-hidden rounded-3xl border border-[var(--border)] bg-white shadow-lg shadow-[#001734]/5 transition duration-200 hover:-translate-y-1 hover:border-[#b9d9f8] hover:shadow-xl hover:shadow-[#001734]/8 motion-reduce:transition-none motion-reduce:hover:transform-none ${
        featured ? "lg:grid lg:grid-cols-[1.12fr_0.88fr]" : "flex flex-col"
      }`}
    >
      <Link
        href={`/blog/${post.slug}`}
        className={`relative block overflow-hidden bg-[#eaf5ff] ${
          featured ? "min-h-64 lg:min-h-full" : "aspect-[16/9]"
        }`}
        tabIndex={-1}
        aria-hidden="true"
      >
        {coverImageId ? (
          <Image
            src={`${getDirectusAssetUrl(coverImageId)}?width=1200&height=675&fit=cover&quality=84`}
            alt=""
            fill
            sizes={featured ? "(min-width: 1024px) 55vw, 100vw" : "(min-width: 1024px) 33vw, 100vw"}
            className="object-cover transition duration-300 group-hover:scale-[1.02] motion-reduce:transition-none"
          />
        ) : (
          <span className="absolute inset-0 flex items-center justify-center p-8 text-center text-3xl font-extrabold tracking-tight text-[var(--accent)]">
            {post.category || "Findelio"}
          </span>
        )}
      </Link>

      <div className={`flex flex-1 flex-col ${featured ? "p-8 sm:p-10" : "p-7"}`}>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2 text-sm font-bold text-[var(--muted)]">
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
          <span>{readingTimeLabel}</span>
        </div>

        <h2 className={`${featured ? "mt-5 text-3xl sm:text-4xl" : "mt-5 text-2xl"} font-extrabold leading-tight tracking-tight`}>
          <Link
            href={`/blog/${post.slug}`}
            className="transition-colors hover:text-[var(--accent)]"
          >
            {post.title}
          </Link>
        </h2>
        <p className="mt-4 line-clamp-4 leading-7 text-[var(--muted)]">
          {post.excerpt}
        </p>
        <Link
          href={`/blog/${post.slug}`}
          className="mt-6 inline-flex min-h-11 items-center self-start font-extrabold text-[var(--accent)] transition-colors hover:text-[var(--foreground)]"
        >
          <span className="underline decoration-2 underline-offset-4">
            {readArticleLabel}
          </span>
          <span className="ml-2" aria-hidden="true">→</span>
        </Link>
      </div>
    </article>
  );
}
