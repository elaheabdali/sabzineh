import type { MetadataRoute } from "next";
import { categories, products, vendors } from "@/data/seed";
import { siteUrl } from "@/lib/seo";

/**
 * Sitemap (Week 8).
 *
 * Built from the seed catalog — the same data the storefront renders
 * in seed mode — so it never depends on DATABASE_URL and stays correct
 * whether the Prisma adapter or the seed adapter is active. Public
 * routes only: home, search, every category, product and vendor shop,
 * in both locales. Auth/account/vendor/admin pages are intentionally
 * excluded (login-gated, not indexable).
 */
export default function sitemap(): MetadataRoute.Sitemap {
  const base = siteUrl();
  const now = new Date();
  const entries: MetadataRoute.Sitemap = [];

  for (const locale of ["fa", "en"] as const) {
    entries.push({ url: `${base}/${locale}`, lastModified: now, changeFrequency: "daily", priority: 1 });
    entries.push({
      url: `${base}/${locale}/search`,
      lastModified: now,
      changeFrequency: "daily",
      priority: 0.8,
    });
    for (const c of categories) {
      entries.push({
        url: `${base}/${locale}/category/${c.slug}`,
        lastModified: now,
        changeFrequency: "weekly",
        priority: 0.7,
      });
    }
    for (const p of products) {
      entries.push({
        url: `${base}/${locale}/product/${p.slug}`,
        lastModified: now,
        changeFrequency: "weekly",
        priority: 0.6,
      });
    }
    for (const v of vendors) {
      entries.push({
        url: `${base}/${locale}/vendor/${v.slug}`,
        lastModified: now,
        changeFrequency: "weekly",
        priority: 0.5,
      });
    }
  }
  return entries;
}
