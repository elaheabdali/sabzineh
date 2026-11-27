import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { getProductBySlug, getProductsByCategory, getVendorById, placeholderImage } from "@/data/seed";
import { ProductCard } from "@/components/ProductCard";
import { AddToCartButton } from "@/components/AddToCartButton";
import { formatPrice } from "@/lib/format";
import type { Locale } from "@/i18n/routing";

interface ProductPageProps {
  params: Promise<{ locale: string; slug: string }>;
}

export function generateStaticParams() {
  return [];
}

/**
 * Product page (Week 1): gallery placeholder, specs, vendor, rating,
 * related products from the same category. Checkout wiring lands in
 * Week 3–4; the add-to-cart button already works via the cart store.
 */
export default async function ProductPage({ params }: ProductPageProps) {
  const { locale, slug } = await params;
  const loc = (locale === "en" ? "en" : "fa") as Locale;
  const t = await getTranslations("product");
  const product = getProductBySlug(slug);
  if (!product) notFound();
  const vendor = getVendorById(product.vendorId);
  const related = getProductsByCategory(product.categoryId)
    .filter((p) => p.id !== product.id)
    .slice(0, 4);

  return (
    <div className="flex flex-col gap-10 pt-8">
      <nav aria-label="Breadcrumb">
        <ol className="flex flex-wrap items-center gap-2 text-sm text-neutral-500">
          <li>
            <Link href="/" className="hover:text-leaf-700 hover:underline">
              {loc === "fa" ? "خانه" : "Home"}
            </Link>
          </li>
          <li aria-hidden="true">/</li>
          <li>
            <Link href={`/category/${product.categoryId}`} className="hover:text-leaf-700 hover:underline">
              {loc === "fa" ? "دسته‌بندی" : "Category"}
            </Link>
          </li>
          <li aria-hidden="true">/</li>
          <li aria-current="page" className="font-medium text-ink-900">
            {product.title}
          </li>
        </ol>
      </nav>

      <div className="grid gap-8 md:grid-cols-2">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={placeholderImage(product.title)}
          alt={product.title}
          width={800}
          height={800}
          className="aspect-square w-full rounded-3xl border border-cream-200 object-cover"
        />
        <div className="flex flex-col gap-4">
          <h1 className="text-2xl font-black leading-snug text-ink-900">{product.title}</h1>
          {vendor ? (
            <p className="text-sm text-neutral-500">
              {t("vendor")}: {vendor.shopName} — {vendor.city}
            </p>
          ) : null}
          <p className="text-sm leading-7 text-neutral-600">{product.description}</p>
          <div className="flex flex-wrap gap-2">
            {product.organic ? (
              <span className="rounded-full bg-leaf-100 px-3 py-1 text-xs font-medium text-leaf-700">
                {t("organic")}
              </span>
            ) : null}
            {product.glutenFree ? (
              <span className="rounded-full bg-leaf-100 px-3 py-1 text-xs font-medium text-leaf-700">
                {t("glutenFree")}
              </span>
            ) : null}
            <span className="rounded-full bg-cream-100 px-3 py-1 text-xs text-neutral-600">
              {t("stock")}: {product.stock.toLocaleString(loc === "fa" ? "fa-IR" : "en-US")}
            </span>
          </div>
          <p className="text-2xl font-black text-leaf-700">
            {formatPrice(product.price, loc)}
            {product.compareAtPrice ? (
              <span className="ms-2 text-base font-normal text-neutral-400 line-through">
                {formatPrice(product.compareAtPrice, loc)}
              </span>
            ) : null}
          </p>
          <div className="w-48">
            <AddToCartButton productId={product.id} disabled={product.stock === 0} />
          </div>
        </div>
      </div>

      {related.length > 0 ? (
        <section aria-labelledby="related">
          <h2 id="related" className="text-xl font-black text-ink-900">
            {t("related")}
          </h2>
          <div className="mt-4 grid grid-cols-2 gap-4 lg:grid-cols-4">
            {related.map((item) => (
              <ProductCard key={item.id} product={item} locale={loc} />
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}
