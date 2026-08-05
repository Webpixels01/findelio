import type { MetadataRoute } from "next";
import { routing } from "@/i18n/routing";
import { getSiteUrl } from "@/lib/seo";

export default function robots(): MetadataRoute.Robots {
  const baseUrl = getSiteUrl();
  const privatePaths = routing.locales.flatMap((locale) => [
    `/${locale}/dashboard`,
    `/${locale}/login`,
    `/${locale}/registrierung-bestaetigen`,
    `/${locale}/firmenkonto-einrichten`,
    `/${locale}/team/einladung`,
  ]);

  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/api/", ...privatePaths],
    },
    sitemap: `${baseUrl}/sitemap.xml`,
    host: baseUrl,
  };
}
