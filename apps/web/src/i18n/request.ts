import { getRequestConfig } from "next-intl/server";
import { hasLocale } from "next-intl";
import { routing } from "./routing";
import fa from "../messages/fa.json";
import en from "../messages/en.json";

/**
 * Per-request next-intl config. Messages are the JSON catalogs in
 * src/messages — the single source of truth for both locales.
 */
export default getRequestConfig(async ({ requestLocale }) => {
  const requested = await requestLocale;
  const locale = hasLocale(routing.locales, requested) ? requested : routing.defaultLocale;
  return {
    locale,
    messages: locale === "fa" ? fa : en,
    timeZone: "Asia/Tehran",
  };
});
