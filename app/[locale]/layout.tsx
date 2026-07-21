import type { Metadata } from "next";
import "@fontsource-variable/roboto-condensed";
import "../globals.css";
import { hasLocale, NextIntlClientProvider } from "next-intl";
import { getMessages, getTranslations, setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import { routing, type AppLocale } from "@/i18n/routing";
import SiteFooter from "@/components/site-footer";

const htmlLanguages: Record<AppLocale, string> = {
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

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) return {};
  const t = await getTranslations({ locale, namespace: "Metadata" });
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

  return {
    metadataBase: new URL(siteUrl),
    title: t("title"),
    description: t("description"),
    openGraph: {
      title: t("title"),
      description: t("description"),
      siteName: "Findelio",
      type: "website",
    },
  };
}

export default async function LocaleLayout({ children, params }: { children: React.ReactNode; params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();

  setRequestLocale(locale);
  const messages = await getMessages();

  return (
    <html lang={htmlLanguages[locale]} data-scroll-behavior="smooth">
      <body>
        <NextIntlClientProvider messages={messages}>
          <div className="flex min-h-screen flex-col">
            {children}
            <SiteFooter />
          </div>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
