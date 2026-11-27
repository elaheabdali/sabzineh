import type { OrderRecord } from "@/server/store";
import type { ProductDTO } from "@sabzineh/types";

/**
 * Personalised recommendations (Week 7) — deterministic, dependency-free
 * scoring. NO AI API is called and NO model runs: the score is a fixed
 * formula over the customer's own data (orders, cart, views), documented
 * below so the numbers are auditable.
 *
 * SCORE (per product, higher is better):
 *   base          = rating × 2                       (0–10, quality)
 *   vendorAffinity = +6 per past order containing an item from the
 *                    same vendor, capped at +12
 *   categoryAffinity = +4 per past order containing an item from the
 *                    same category, capped at +8
 *   bundle        = +8 when the product's vendor already has items in
 *                    the cart ("با این‌ها کامل می‌شود")
 *   cartCategory  = +5 when the product's category is already in the cart
 *   viewed        = +3 when the customer viewed the product before
 *                    without buying it
 *
 * Out-of-stock products and products already in the cart are excluded.
 * Guests and brand-new users (no orders, no cart, no views) fall back
 * to the best-rated in-stock products. Ties break by rating, then by
 * product id, so the order is fully deterministic for the same input.
 */

export type RecommendationReason =
  | "vendor-affinity"
  | "category-affinity"
  | "bundle"
  | "cart-category"
  | "viewed"
  | "bestseller";

export interface ScoredProduct {
  product: ProductDTO;
  score: number;
  reasons: RecommendationReason[];
}

export interface RecommendationInput {
  products: ProductDTO[];
  orders?: OrderRecord[];
  cartProductIds?: string[];
  viewedProductIds?: string[];
  limit?: number;
}

export const VENDOR_AFFINITY_PER_ORDER = 6;
export const VENDOR_AFFINITY_CAP = 12;
export const CATEGORY_AFFINITY_PER_ORDER = 4;
export const CATEGORY_AFFINITY_CAP = 8;
export const BUNDLE_BONUS = 8;
export const CART_CATEGORY_BONUS = 5;
export const VIEWED_BONUS = 3;

function countOrdersWith(
  orders: OrderRecord[],
  predicate: (order: OrderRecord) => boolean,
): number {
  return orders.filter(predicate).length;
}

export function scoreProducts(input: RecommendationInput): ScoredProduct[] {
  const orders = input.orders ?? [];
  const cartIds = new Set(input.cartProductIds ?? []);
  const viewedIds = new Set(input.viewedProductIds ?? []);
  const limit = input.limit ?? 8;

  const byId = new Map(input.products.map((p) => [p.id, p] as const));
  const cartProducts = [...cartIds].map((id) => byId.get(id)).filter((p) => p !== undefined);
  const cartVendorIds = new Set(cartProducts.map((p) => p.vendorId));
  const cartCategoryIds = new Set(cartProducts.map((p) => p.categoryId));

  const boughtIds = new Set(orders.flatMap((o) => o.items.map((i) => i.productId)));

  const scored: ScoredProduct[] = [];
  for (const product of input.products) {
    if (product.stock <= 0) continue;
    if (cartIds.has(product.id)) continue;

    const reasons: RecommendationReason[] = [];
    let score = product.rating * 2;

    const vendorOrders = countOrdersWith(orders, (o) =>
      o.items.some((i) => i.vendorId === product.vendorId),
    );
    if (vendorOrders > 0) {
      score += Math.min(vendorOrders * VENDOR_AFFINITY_PER_ORDER, VENDOR_AFFINITY_CAP);
      reasons.push("vendor-affinity");
    }

    const categoryOrders = countOrdersWith(orders, (o) =>
      o.items.some((i) => {
        const item = byId.get(i.productId);
        return item?.categoryId === product.categoryId;
      }),
    );
    if (categoryOrders > 0) {
      score += Math.min(categoryOrders * CATEGORY_AFFINITY_PER_ORDER, CATEGORY_AFFINITY_CAP);
      reasons.push("category-affinity");
    }

    if (cartVendorIds.has(product.vendorId)) {
      score += BUNDLE_BONUS;
      reasons.push("bundle");
    } else if (cartCategoryIds.has(product.categoryId)) {
      score += CART_CATEGORY_BONUS;
      reasons.push("cart-category");
    }

    if (viewedIds.has(product.id) && !boughtIds.has(product.id)) {
      score += VIEWED_BONUS;
      reasons.push("viewed");
    }

    if (reasons.length === 0) reasons.push("bestseller");
    scored.push({ product, score, reasons });
  }

  scored.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    if (b.product.rating !== a.product.rating) return b.product.rating - a.product.rating;
    return a.product.id.localeCompare(b.product.id);
  });
  return scored.slice(0, limit);
}

/** Guest / new-user fallback: best-rated in-stock products. */
export function bestSellers(products: ProductDTO[], limit = 8): ScoredProduct[] {
  return scoreProducts({ products, limit });
}
