import { Link } from "@/i18n/navigation";
import { formatPrice } from "@/lib/format";
import { getVendorById, placeholderImage } from "@/data/seed";
import { AddToCartButton } from "./AddToCartButton";
import type { ProductDTO } from "@sabzineh/types";

interface ProductCardProps {
  product: ProductDTO;
  locale: "fa" | "en";
}

/** Product tile: image, title, vendor, price, add-to-cart. */
export function ProductCard({ product, locale }: ProductCardProps) {
  const vendor = getVendorById(product.vendorId);
  return (
    <article data-testid="product-card" className="flex flex-col overflow-hidden rounded-2xl border border-cream-200 bg-white">
      <Link href={`/product/${product.slug}`} aria-label={product.title}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={placeholderImage(product.title)}
          alt={product.title}
          width={800}
          height={800}
          loading="lazy"
          className="aspect-square w-full object-cover"
        />
      </Link>
      <div className="flex flex-1 flex-col gap-2 p-4">
        <h3 data-testid="product-title" className="text-sm font-bold leading-6 text-ink-900">
          <Link href={`/product/${product.slug}`} className="hover:text-leaf-700 hover:underline">
            {product.title}
          </Link>
        </h3>
        {vendor ? <p className="text-xs text-neutral-500">{vendor.shopName}</p> : null}
        <div className="mt-auto flex items-end justify-between gap-2">
          <p className="text-base font-black text-leaf-700">
            {formatPrice(product.price, locale)}
            {product.compareAtPrice ? (
              <span className="ms-2 text-xs font-normal text-neutral-400 line-through">
                {formatPrice(product.compareAtPrice, locale)}
              </span>
            ) : null}
          </p>
          <span className="text-xs text-neutral-500" aria-label={`Rating ${product.rating} of 5`}>
            ★ {product.rating.toLocaleString(locale === "fa" ? "fa-IR" : "en-US")}
          </span>
        </div>
        <AddToCartButton productId={product.id} disabled={product.stock === 0} />
      </div>
    </article>
  );
}
