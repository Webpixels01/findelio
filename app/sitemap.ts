import type { MetadataRoute } from "next";
import { routing } from "@/i18n/routing";
import { getPublishedListingSlugs } from "@/lib/directus";

export const dynamic = "force-dynamic";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
  const staticPaths = [
    "",
    "/unternehmen",
    "/firma-eintragen",
    "/kontakt",
    "/login",
    "/impressum",
    "/datenschutz",
  ];
  const publishedSlugs = await getPublishedListingSlugs();
  const urls: MetadataRoute.Sitemap = [];

  for (const locale of routing.locales) {
    for (const path of staticPaths) {
      urls.push({
        url: `${baseUrl}/${locale}${path}`,
        changeFrequency: "weekly",
        priority: path === "" ? 1 : 0.7,
      });
    }

    for (const slug of publishedSlugs) {
      urls.push({
        url: `${baseUrl}/${locale}/unternehmen/${slug}`,
        changeFrequency: "monthly",
        priority: 0.6,
      });
    }
  }

  return urls;
}
