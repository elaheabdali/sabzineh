import { defineRouting } from "next-intl/routing";

export const routing = defineRouting({
  locales: ["fa", "en"],
  defaultLocale: "fa",
  localeCookie: { secure: process.env.NODE_ENV === "production" },
});

export type Locale = (typeof routing.locales)[number];
