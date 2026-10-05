import { getRequestConfig } from "next-intl/server";
import { hasLocale } from "next-intl";
import { routing } from "./routing";

import deCh from "../messages/de-ch.json";
import en from "../messages/en.json";
import sk from "../messages/sk.json";
import cs from "../messages/cs.json";
import hu from "../messages/hu.json";
import pl from "../messages/pl.json";
import ru from "../messages/ru.json";
import ptPt from "../messages/pt-pt.json";
import ro from "../messages/ro.json";
import vi from "../messages/vi.json";

const messages = {
  "de-ch": deCh,
  en,
  sk,
  cs,
  hu,
  pl,
  ru,
  "pt-pt": ptPt,
  ro,
  vi,
};

export default getRequestConfig(async ({ requestLocale }) => {
  const requestedLocale = await requestLocale;
  const locale = hasLocale(routing.locales, requestedLocale)
    ? requestedLocale
    : routing.defaultLocale;

  return {
    locale,
    messages: messages[locale],
  };
});
