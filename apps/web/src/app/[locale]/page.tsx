import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { buildCategoryTree, products, vendors, banners } from "@/data/seed";
import { ProductCard } from "@/components/ProductCard";
import { RecommendationsSection } from "@/components/RecommendationsSection";
import type { Locale } from "@/i18n/routing";

interface HomePageProps {
  params: Promise<{ locale: string }>;
}

/** Storefront home: hero banner, top-level categories, featured products. */
export default async function HomePage({ params }: HomePageProps) {
  const { locale } = await params;
  const loc = (locale === "en" ? "en" : "fa") as Locale;
  const t = await getTranslations("home");
  const tree = buildCategoryTree();
  const featured = [...products].sort((a, b) => b.rating - a.rating).slice(0, 8);
  const hero = banners.find((b) => b.placement === "HOME_HERO");

  return (
    <div className="flex flex-col gap-12 pt-8">
      <section className="rounded-3xl bg-leaf-700 px-6 py-12 text-white sm:px-12">
        <h1 className="max-w-2xl text-3xl font-black leading-snug sm:text-4xl">{t("heroTitle")}</h1>
        <p className="mt-3 max-w-xl text-base leading-7 text-leaf-100">{t("heroSubtitle")}</p>
        <p className="mt-2 text-sm text-leaf-200">{hero?.title}</p>
        <Link
          href="/category/fruits-vegetables"
          className="mt-6 inline-block rounded-lg bg-white px-5 py-3 text-sm font-bold text-leaf-700 hover:bg-cream-100"
        >
          {t("heroCta")}
        </Link>
      </section>

      <section aria-labelledby="home-categories">
        <h2 id="home-categories" className="text-xl font-black text-ink-900">
          {t("categories")}
        </h2>
        <ul className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          {tree.map((node) => (
            <li key={node.id}>
              <Link
                href={`/category/${node.slug}`}
                className="block rounded-2xl border border-cream-200 bg-white p-4 hover:border-leaf-600"
              >
                <span className="block text-sm font-bold text-ink-900">
                  {loc === "fa" ? node.nameFa : node.nameEn}
                </span>
                <span className="mt-1 block text-xs text-neutral-500">
                  {node.productCount.toLocaleString(loc === "fa" ? "fa-IR" : "en-US")} {t("allProducts")}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="home-featured">
        <div className="flex items-baseline justify-between">
          <h2 id="home-featured" className="text-xl font-black text-ink-900">
            {t("featured")}
          </h2>
          <Link href="/category/fruits-vegetables" className="text-sm font-medium text-leaf-700 hover:underline">
            {t("allProducts")}
          </Link>
        </div>
        <div className="mt-4 grid grid-cols-2 gap-4 lg:grid-cols-4">
          {featured.map((product) => (
            <ProductCard key={product.id} product={product} locale={loc} />
          ))}
        </div>
      </section>

      <RecommendationsSection locale={loc} />

      <section aria-labelledby="home-vendors">
        <h2 id="home-vendors" className="text-xl font-black text-ink-900">
          {t("vendors")}
        </h2>
        <ul className="mt-4 flex flex-wrap gap-2">
          {vendors.map((vendor) => (
            <li
              key={vendor.id}
              className="rounded-full border border-cream-200 bg-white px-4 py-2 text-sm text-ink-900"
            >
              {vendor.shopName} — {vendor.city}
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
