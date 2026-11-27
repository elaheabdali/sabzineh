import type { Metadata } from "next";
import type { ReactNode } from "react";
import { NextIntlClientProvider, hasLocale } from "next-intl";
import { getMessages, setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import { routing, type Locale } from "@/i18n/routing";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { AssistantChat } from "@/components/AssistantChat";
import { buildCategoryTree } from "@/data/seed";
import { getSession } from "@/lib/auth/guards";
import { localeAlternates, siteUrl } from "@/lib/seo";
import "../globals.css";

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const isFa = locale !== "en";
  return {
    metadataBase: new URL(siteUrl()),
    title: isFa ? "سبزینه — تازه از مزرعه" : "Sabzineh — fresh from the farm",
    description: isFa
      ? "مارکت‌پلیس چندفروشنده محصولات ارگانیک و غذایی محلی، با باکس اشتراک هفتگی."
      : "Multi-vendor marketplace for organic and local food, with a weekly subscription box.",
    alternates: localeAlternates("/"),
    openGraph: {
      type: "website",
      locale: isFa ? "fa_IR" : "en_US",
      url: `${siteUrl()}/${locale}`,
      siteName: isFa ? "سبزینه" : "Sabzineh",
      title: isFa ? "سبزینه — تازه از مزرعه" : "Sabzineh — fresh from the farm",
      description: isFa
        ? "مارکت‌پلیس چندفروشنده محصولات ارگانیک و غذایی محلی، با باکس اشتراک هفتگی."
        : "Multi-vendor marketplace for organic and local food, with a weekly subscription box.",
    },
    icons: { icon: "/favicon.svg" },
  };
}

export default async function LocaleLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale: requested } = await params;
  if (!hasLocale(routing.locales, requested)) notFound();
  const locale = requested as Locale;
  setRequestLocale(locale);
  const messages = await getMessages();
  const tree = buildCategoryTree();
  const sessionUser = await getSession();

  return (
    <html lang={locale} dir={locale === "fa" ? "rtl" : "ltr"}>
      <body>
        <NextIntlClientProvider messages={messages}>
          <Header locale={locale} categoryTree={tree} sessionUser={sessionUser} />
          <main className="mx-auto min-h-[60vh] w-full max-w-7xl px-4 pb-16">{children}</main>
          <Footer locale={locale} />
          <AssistantChat locale={locale} />
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
