import type { Metadata } from "next";
import { routing, type AppLocale } from "@/i18n/routing";

export const SITE_NAME = "Findelio";

export const htmlLanguageTags: Record<AppLocale, string> = {
  "de-ch": "de-CH",
  en: "en",
  sk: "sk",
  cs: "cs",
  hu: "hu",
  pl: "pl",
  ru: "ru",
  "pt-pt": "pt-PT",
  ro: "ro",
};

const openGraphLocales: Record<AppLocale, string> = {
  "de-ch": "de_CH",
  en: "en_US",
  sk: "sk_SK",
  cs: "cs_CZ",
  hu: "hu_HU",
  pl: "pl_PL",
  ru: "ru_RU",
  "pt-pt": "pt_PT",
  ro: "ro_RO",
};

function normalizedBaseUrl(): string {
  const configuredUrl = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  const baseUrl = configuredUrl || "http://localhost:3000";

  return baseUrl.replace(/\/+$/, "");
}

export function getSiteUrl(): string {
  return normalizedBaseUrl();
}

export function absoluteUrl(path = ""): string {
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;

  return `${normalizedBaseUrl()}${normalizedPath === "/" ? "" : normalizedPath}`;
}

export function localizedPath(locale: AppLocale, path = ""): string {
  const normalizedPath = path
    ? `/${path.replace(/^\/+|\/+$/g, "")}`
    : "";

  return `/${locale}${normalizedPath}`;
}

export function localizedUrl(locale: AppLocale, path = ""): string {
  return absoluteUrl(localizedPath(locale, path));
}

export function languageAlternates(path = ""): Record<string, string> {
  const alternatives = Object.fromEntries(
    routing.locales.map((locale) => [
      htmlLanguageTags[locale],
      localizedUrl(locale, path),
    ]),
  );

  return {
    ...alternatives,
    "x-default": localizedUrl(routing.defaultLocale, path),
  };
}

type PageMetadataInput = {
  locale: AppLocale;
  path?: string;
  title: string;
  description: string;
  image?: string | null;
  imageAlt?: string;
  noIndex?: boolean;
  includeLanguageAlternates?: boolean;
  openGraphType?: "website" | "article";
};

export function buildPageMetadata({
  locale,
  path = "",
  title,
  description,
  image,
  imageAlt = SITE_NAME,
  noIndex = false,
  includeLanguageAlternates = true,
  openGraphType = "website",
}: PageMetadataInput): Metadata {
  const pageUrl = localizedUrl(locale, path);
  const imageUrl = image
    ? image.startsWith("http://") || image.startsWith("https://")
      ? image
      : absoluteUrl(image)
    : localizedUrl(locale, "/share-image");

  return {
    title,
    description,
    alternates: noIndex
      ? undefined
      : {
          canonical: pageUrl,
          ...(includeLanguageAlternates
            ? { languages: languageAlternates(path) }
            : {}),
        },
    robots: noIndex
      ? {
          index: false,
          follow: false,
          googleBot: { index: false, follow: false },
        }
      : {
          index: true,
          follow: true,
        },
    openGraph: {
      title,
      description,
      type: openGraphType,
      siteName: SITE_NAME,
      url: pageUrl,
      locale: openGraphLocales[locale],
      alternateLocale: routing.locales
        .filter((candidate) => candidate !== locale)
        .map((candidate) => openGraphLocales[candidate]),
      images: [
        {
          url: imageUrl,
          width: 1200,
          height: 630,
          alt: imageAlt,
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [imageUrl],
    },
  };
}

export const privatePageMetadata: Metadata = {
  robots: {
    index: false,
    follow: false,
    noarchive: true,
    googleBot: {
      index: false,
      follow: false,
      noimageindex: true,
    },
  },
};
