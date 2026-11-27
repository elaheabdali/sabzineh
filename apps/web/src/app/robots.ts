import type { MetadataRoute } from "next";
import { siteUrl } from "@/lib/seo";

/** robots.txt (Week 8): index everything public, point at the sitemap. */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: "*", allow: "/" },
    sitemap: `${siteUrl()}/sitemap.xml`,
  };
}
