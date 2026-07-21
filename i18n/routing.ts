import { defineRouting } from "next-intl/routing";

export const routing = defineRouting({
  locales: ["de-ch", "en", "sk", "cs", "hu", "pl", "ru", "pt-pt", "ro"],
  defaultLocale: "de-ch",
  localePrefix: "always",
});

export type AppLocale = (typeof routing.locales)[number];
