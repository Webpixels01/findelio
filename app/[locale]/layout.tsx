import type { Metadata } from "next";
import "@fontsource-variable/roboto-condensed";
import "../globals.css";
import { hasLocale, NextIntlClientProvider } from "next-intl";
import { getMessages, getTranslations, setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import { routing } from "@/i18n/routing";
import SiteFooter from "@/components/site-footer";
import CookieNotice from "@/components/cookie-notice";
import GoogleAnalytics from "@/components/google-analytics";
import StructuredData from "@/components/structured-data";
import {
  absoluteUrl,
  getSiteUrl,
  htmlLanguageTags,
  localizedUrl,
} from "@/lib/seo";

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) return {};
  const t = await getTranslations({ locale, namespace: "Metadata" });
  const faviconVersion = "d70b58d";

  return {
    metadataBase: new URL(getSiteUrl()),
    applicationName: "Findelio",
    title: t("title"),
    description: t("description"),
    authors: [{ name: "Findelio", url: getSiteUrl() }],
    creator: "Findelio",
    publisher: "Findelio",
    icons: {
      icon: [
        { url: `/favicon.ico?v=${faviconVersion}`, type: "image/x-icon" },
        { url: `/favicon.svg?v=${faviconVersion}`, type: "image/svg+xml" },
      ],
      shortcut: [`/favicon.ico?v=${faviconVersion}`],
      apple: `/favicon.svg?v=${faviconVersion}`,
    },
    formatDetection: {
      email: false,
      address: false,
      telephone: false,
    },
    openGraph: {
      title: t("title"),
      description: t("description"),
      siteName: "Findelio",
      type: "website",
      images: [
        {
          url: localizedUrl(locale, "/share-image"),
          width: 1200,
          height: 630,
          alt: t("title"),
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title: t("title"),
      description: t("description"),
      images: [localizedUrl(locale, "/share-image")],
    },
  };
}

export default async function LocaleLayout({ children, params }: { children: React.ReactNode; params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();

  setRequestLocale(locale);
  const messages = await getMessages();
  const organizationData = {
    "@context": "https://schema.org",
    "@type": "Organization",
    "@id": `${getSiteUrl()}/#organization`,
    name: "Findelio",
    legalName: "Webpixels",
    url: getSiteUrl(),
    logo: absoluteUrl("/findelio-logo-horizontal.svg"),
    email: "info@findelio.ch",
    telephone: "+41766137772",
    address: {
      "@type": "PostalAddress",
      streetAddress: "Kirchgasse 13",
      postalCode: "8532",
      addressLocality: "Warth",
      addressCountry: "CH",
    },
    contactPoint: {
      "@type": "ContactPoint",
      contactType: "customer service",
      email: "info@findelio.ch",
      telephone: "+41766137772",
      availableLanguage: routing.locales.map(
        (supportedLocale) => htmlLanguageTags[supportedLocale],
      ),
    },
  };

  return (
    <html lang={htmlLanguageTags[locale]} data-scroll-behavior="smooth">
      <head>
        <GoogleAnalytics />
      </head>
      <body suppressHydrationWarning>
        <StructuredData data={organizationData} />
        <NextIntlClientProvider messages={messages}>
          <div className="flex min-h-screen flex-col">
            {children}
            <SiteFooter />
          </div>
          <CookieNotice />
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
