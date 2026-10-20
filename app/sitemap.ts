import type { MetadataRoute } from "next";
import { routing } from "@/i18n/routing";
import { getPublishedListingSitemapEntries } from "@/lib/directus";
import { getPublishedBlogSitemapEntries } from "@/lib/directus-blog";
import {
  languageAlternates,
  localizedUrl,
} from "@/lib/seo";

export const dynamic = "force-dynamic";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const staticPaths = [
    { path: "", priority: 1, changeFrequency: "weekly" as const },
    { path: "/unternehmen", priority: 0.9, changeFrequency: "daily" as const },
    { path: "/firma-eintragen", priority: 0.8, changeFrequency: "monthly" as const },
    { path: "/fuer-unternehmen", priority: 0.8, changeFrequency: "monthly" as const },
    { path: "/blog", priority: 0.8, changeFrequency: "weekly" as const },
    { path: "/kontakt", priority: 0.6, changeFrequency: "yearly" as const },
    { path: "/impressum", priority: 0.3, changeFrequency: "yearly" as const },
    { path: "/datenschutz", priority: 0.3, changeFrequency: "yearly" as const },
    { path: "/cookies", priority: 0.3, changeFrequency: "yearly" as const },
    { path: "/agb", priority: 0.4, changeFrequency: "yearly" as const },
  ];
  const [publishedListings, publishedBlogPosts] = await Promise.all([
    getPublishedListingSitemapEntries(),
    getPublishedBlogSitemapEntries(),
  ]);
  const urls: MetadataRoute.Sitemap = [];

  for (const locale of routing.locales) {
    for (const entry of staticPaths) {
      urls.push({
        url: localizedUrl(locale, entry.path),
        changeFrequency: entry.changeFrequency,
        priority: entry.priority,
        alternates: { languages: languageAlternates(entry.path) },
      });
    }

    for (const listing of publishedListings) {
      const path = `/unternehmen/${listing.slug}`;
      urls.push({
        url: localizedUrl(locale, path),
        ...(listing.lastModified
          ? { lastModified: listing.lastModified }
          : {}),
        changeFrequency: "monthly",
        priority: 0.7,
        alternates: { languages: languageAlternates(path) },
      });
    }

    for (const post of publishedBlogPosts.filter(
      (candidate) => candidate.locale === locale,
    )) {
      urls.push({
        url: localizedUrl(locale, `/blog/${post.slug}`),
        lastModified: post.lastModified,
        changeFrequency: "monthly",
        priority: 0.7,
      });
    }
  }

  return urls;
}
