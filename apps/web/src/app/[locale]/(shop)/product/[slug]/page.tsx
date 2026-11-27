import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { getCatalogRepository } from "@/features/catalog/repository";
import { ProductCard } from "@/components/ProductCard";
import { ProductGallery } from "@/components/ProductGallery";
import { ProductPurchaseBox } from "@/components/ProductPurchaseBox";
import { formatJalali, formatPrice } from "@/lib/format";
import type { Locale } from "@/i18n/routing";

interface ProductPageProps {
  params: Promise<{ locale: string; slug: string }>;
}

export async function generateStaticParams() {
  const repo = getCatalogRepository();
  const slugs = await repo.getAllProductSlugs();
  return slugs.map((slug) => ({ slug }));
}

export async function generateMetadata({ params }: ProductPageProps): Promise<Metadata> {
  const { locale, slug } = await params;
  const repo = getCatalogRepository();
  const product = await repo.getProductBySlug(slug);
  if (!product) return {};
  return {
    title: locale === "fa" ? `${product.title} | سبزینه` : `${product.title} | Sabzineh`,
    description: product.description,
  };
}

/**
 * Product page (Week 2, complete): gallery with thumbnails, vendor,
 * attributes, price in Toman, stock state + quantity control wired to
 * the Zustand cart, rating + reviews, related products from the same
 * category. Prices and stock are display-only — the server re-checks
 * both at order creation (Week 4).
 */
export default async function ProductPage({ params }: ProductPageProps) {
  const { locale, slug } = await params;
  const loc = (locale === "en" ? "en" : "fa") as Locale;
  const t = await getTranslations("product");
  const repo = getCatalogRepository();

  const product = await repo.getProductBySlug(slug);
  if (!product) notFound();
  const [vendor, category, related, reviews] = await Promise.all([
    repo.getVendorById(product.vendorId),
    repo.getCategoryById(product.categoryId),
    repo.getRelatedProducts(product, 4),
    repo.getReviews(product.id),
  ]);
  const ancestors = category ? await repo.getCategoryAncestors(category.slug) : [];

  return (
    <div className="flex flex-col gap-10 pt-8">
      <nav aria-label="Breadcrumb">
        <ol className="flex flex-wrap items-center gap-2 text-sm text-neutral-500">
          <li>
            <Link href="/" className="hover:text-leaf-700 hover:underline">
              {loc === "fa" ? "خانه" : "Home"}
            </Link>
          </li>
          {ancestors.map((ancestor) => (
            <li key={ancestor.id} className="flex items-center gap-2">
              <span aria-hidden="true">/</span>
              <Link href={`/category/${ancestor.slug}`} className="hover:text-leaf-700 hover:underline">
                {loc === "fa" ? ancestor.nameFa : ancestor.nameEn}
              </Link>
            </li>
          ))}
          <li aria-hidden="true">/</li>
          <li aria-current="page" className="font-medium text-ink-900">
            {product.title}
          </li>
        </ol>
      </nav>

      <div className="grid gap-8 md:grid-cols-2">
        <ProductGallery title={product.title} />
        <div className="flex flex-col gap-4">
          <h1 className="text-2xl font-black leading-snug text-ink-900">{product.title}</h1>
          {vendor ? (
            <p className="text-sm text-neutral-500">
              {t("vendor")}:{" "}
              <Link href={`/search?vendor=${vendor.id}`} className="font-medium text-leaf-700 hover:underline">
                {vendor.shopName}
              </Link>{" "}
              — {vendor.city}
              <span className="ms-2" aria-label={`Rating ${vendor.rating} of 5`}>
                ★ {vendor.rating.toLocaleString(loc === "fa" ? "fa-IR" : "en-US")}
              </span>
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
            <span className="rounded-full bg-cream-100 px-3 py-1 text-xs text-neutral-600" aria-label={`Rating ${product.rating} of 5`}>
              ★ {product.rating.toLocaleString(loc === "fa" ? "fa-IR" : "en-US")} / ۵
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
          <ProductPurchaseBox productId={product.id} stock={product.stock} locale={loc} />
        </div>
      </div>

      <section aria-labelledby="reviews">
        <h2 id="reviews" className="text-xl font-black text-ink-900">
          {t("reviews")} ({reviews.length.toLocaleString(loc === "fa" ? "fa-IR" : "en-US")})
        </h2>
        {reviews.length === 0 ? (
          <p className="mt-2 text-sm text-neutral-500">{t("noReviews")}</p>
        ) : (
          <ul className="mt-4 flex flex-col gap-3">
            {reviews.map((review) => (
              <li key={review.id} className="rounded-2xl border border-cream-200 bg-white p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-sm font-bold text-ink-900">{review.author}</span>
                  <span className="text-xs text-neutral-500">
                    <span aria-label={`Rating ${review.rating} of 5`}>
                      ★ {review.rating.toLocaleString(loc === "fa" ? "fa-IR" : "en-US")}
                    </span>
                    {" — "}
                    {formatJalali(review.createdAt, loc)}
                  </span>
                </div>
                <p className="mt-2 text-sm leading-7 text-neutral-600">{review.text}</p>
              </li>
            ))}
          </ul>
        )}
      </section>

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
