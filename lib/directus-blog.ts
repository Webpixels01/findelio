import "server-only";
import { cache } from "react";
import { routing, type AppLocale } from "@/i18n/routing";

type DirectusResponse<T> = {
  data: T;
};

export type BlogImage = {
  id: string;
  width: number | null;
  height: number | null;
};

export type BlogPost = {
  id: string;
  status: "published";
  locale: AppLocale;
  slug: string;
  title: string;
  excerpt: string;
  body: string;
  category: string | null;
  author_name: string;
  cover_image: string | BlogImage | null;
  cover_alt: string | null;
  featured: boolean;
  seo_title: string | null;
  seo_description: string | null;
  published_at: string;
  date_updated: string | null;
};

export type BlogSitemapEntry = {
  locale: AppLocale;
  slug: string;
  lastModified: string;
};

const blogFields = [
  "id",
  "status",
  "locale",
  "slug",
  "title",
  "excerpt",
  "body",
  "category",
  "author_name",
  "cover_image.id",
  "cover_image.width",
  "cover_image.height",
  "cover_alt",
  "featured",
  "seo_title",
  "seo_description",
  "published_at",
  "date_updated",
].join(",");

function getDirectusUrl(): string {
  const value = process.env.DIRECTUS_URL?.trim();

  if (!value) {
    throw new Error("DIRECTUS_URL fehlt in der Laufzeitumgebung");
  }

  return value;
}

function getDirectusHeaders(): HeadersInit {
  const token = process.env.DIRECTUS_TOKEN?.trim();

  if (!token) {
    throw new Error("DIRECTUS_TOKEN fehlt in der Laufzeitumgebung");
  }

  return { Authorization: `Bearer ${token}` };
}

function publicationFilter(locale?: AppLocale): Record<string, unknown> {
  const conditions: Record<string, unknown>[] = [
    { status: { _eq: "published" } },
    { published_at: { _nnull: true } },
    { published_at: { _lte: "$NOW" } },
  ];

  if (locale) {
    conditions.push({ locale: { _eq: locale } });
  }

  return { _and: conditions };
}

async function readBlogResponse<T>(
  response: Response,
  context: string,
): Promise<T | null> {
  if (!response.ok) {
    console.warn(
      `${context}: ${response.status} ${response.statusText}. ` +
        "Ist die Blog-Migration bereits angewendet?",
    );
    return null;
  }

  const result = (await response.json()) as DirectusResponse<T>;
  return result.data;
}

export async function getPublishedBlogPosts(
  locale: AppLocale,
  limit = 50,
): Promise<BlogPost[]> {
  const url = new URL("/items/blog_posts", getDirectusUrl());
  url.searchParams.set("fields", blogFields);
  url.searchParams.set("sort", "-featured,-published_at");
  url.searchParams.set("limit", String(limit));
  url.searchParams.set("filter", JSON.stringify(publicationFilter(locale)));

  const response = await fetch(url, {
    headers: getDirectusHeaders(),
    cache: "no-store",
  });

  return (
    (await readBlogResponse<BlogPost[]>(
      response,
      "Blogbeiträge konnten nicht geladen werden",
    )) ?? []
  );
}

export const getPublishedBlogPostBySlug = cache(
  async (locale: AppLocale, slug: string): Promise<BlogPost | null> => {
    const url = new URL("/items/blog_posts", getDirectusUrl());
    url.searchParams.set("fields", blogFields);
    url.searchParams.set("limit", "1");
    url.searchParams.set(
      "filter",
      JSON.stringify({
        _and: [
          ...(publicationFilter(locale)._and as Record<string, unknown>[]),
          { slug: { _eq: slug } },
        ],
      }),
    );

    const response = await fetch(url, {
      headers: getDirectusHeaders(),
      cache: "no-store",
    });
    const posts = await readBlogResponse<BlogPost[]>(
      response,
      "Blogbeitrag konnte nicht geladen werden",
    );

    return posts?.[0] ?? null;
  },
);

export async function getRelatedBlogPosts(
  post: BlogPost,
  limit = 3,
): Promise<BlogPost[]> {
  const posts = await getPublishedBlogPosts(post.locale, limit + 1);

  return posts.filter((candidate) => candidate.id !== post.id).slice(0, limit);
}

export async function getPublishedBlogSitemapEntries(): Promise<
  BlogSitemapEntry[]
> {
  const url = new URL("/items/blog_posts", getDirectusUrl());
  url.searchParams.set(
    "fields",
    "locale,slug,published_at,date_updated",
  );
  url.searchParams.set("sort", "locale,slug");
  url.searchParams.set("limit", "-1");
  url.searchParams.set("filter", JSON.stringify(publicationFilter()));

  const response = await fetch(url, {
    headers: getDirectusHeaders(),
    cache: "no-store",
  });
  const posts = await readBlogResponse<
    Array<{
      locale: string;
      slug: string;
      published_at: string;
      date_updated: string | null;
    }>
  >(response, "Blog-Sitemap konnte nicht geladen werden");

  return (posts ?? [])
    .filter(
      (post): post is typeof post & { locale: AppLocale } =>
        routing.locales.includes(post.locale as AppLocale) &&
        Boolean(post.slug?.trim()),
    )
    .map((post) => ({
      locale: post.locale,
      slug: post.slug.trim(),
      lastModified: post.date_updated ?? post.published_at,
    }));
}

export function getBlogCoverImageId(post: BlogPost): string | null {
  if (typeof post.cover_image === "string") {
    return post.cover_image;
  }

  return post.cover_image?.id ?? null;
}

export function getBlogReadingMinutes(body: string): number {
  const words = body
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/[`*_>#\[\]()|~-]/g, " ")
    .trim()
    .split(/\s+/)
    .filter(Boolean).length;

  return Math.max(1, Math.ceil(words / 220));
}
