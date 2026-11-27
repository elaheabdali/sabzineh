import type { Metadata } from "next";
import type { Locale } from "@/i18n/routing";

/**
 * SEO helpers (Week 8).
 *
 * The canonical site URL comes from NEXT_PUBLIC_APP_URL; in Vercel it
 * must be set to the production URL (see README / docs/vercel-deploy.md).
 * The fallback is the live project URL, so canonicals, Open Graph and
 * the sitemap stay correct even if the variable is missing.
 */
export function siteUrl(): string {
  const raw = process.env.NEXT_PUBLIC_APP_URL ?? "";
  return raw.replace(/\/$/, "") || "https://sabzineh-web.vercel.app";
}

/** hreflang alternates for a locale-relative path (e.g. "/category/x"). */
export function localeAlternates(path: string): Metadata["alternates"] {
  const base = siteUrl();
  const clean = path.startsWith("/") ? path : `/${path}`;
  return {
    canonical: `${base}/fa${clean}`,
    languages: {
      fa: `${base}/fa${clean}`,
      en: `${base}/en${clean}`,
      "x-default": `${base}/fa${clean}`,
    },
  };
}

/** JSON-LD for the storefront itself (home page). */
export function websiteJsonLd(locale: Locale) {
  const base = siteUrl();
  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Organization",
        "@id": `${base}/#organization`,
        name: locale === "fa" ? "سبزینه" : "Sabzineh",
        url: `${base}/fa`,
        description:
          locale === "fa"
            ? "مارکت‌پلیس چندفروشنده محصولات ارگانیک و غذایی محلی"
            : "Multi-vendor marketplace for organic and local food",
      },
      {
        "@type": "WebSite",
        "@id": `${base}/#website`,
        url: `${base}/fa`,
        name: locale === "fa" ? "سبزینه" : "Sabzineh",
        publisher: { "@id": `${base}/#organization` },
        inLanguage: locale,
      },
    ],
  };
}

export interface BreadcrumbItem {
  name: string;
  path: string;
}

/** BreadcrumbList JSON-LD; paths are locale-relative ("/", "/category/x"). */
export function breadcrumbJsonLd(locale: Locale, items: BreadcrumbItem[]) {
  const base = siteUrl();
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: item.name,
      item: `${base}/${locale}${item.path === "/" ? "" : item.path}`,
    })),
  };
}

export interface ProductJsonLdInput {
  title: string;
  description: string;
  slug: string;
  price: number;
  compareAtPrice?: number | null;
  stock: number;
  rating: number;
  vendorName: string;
  categoryName: string;
}

/** Product JSON-LD (no images: product photos are data-URI placeholders). */
export function productJsonLd(locale: Locale, p: ProductJsonLdInput) {
  const base = siteUrl();
  return {
    "@context": "https://schema.org",
    "@type": "Product",
    name: p.title,
    description: p.description,
    url: `${base}/${locale}/product/${p.slug}`,
    category: p.categoryName,
    brand: { "@type": "Brand", name: p.vendorName },
    aggregateRating: {
      "@type": "AggregateRating",
      ratingValue: p.rating,
      bestRating: 5,
    },
    offers: {
      "@type": "Offer",
      url: `${base}/${locale}/product/${p.slug}`,
      priceCurrency: "IRT",
      price: p.price,
      availability: p.stock > 0 ? "https://schema.org/InStock" : "https://schema.org/OutOfStock",
      itemCondition: "https://schema.org/NewCondition",
    },
  };
}
