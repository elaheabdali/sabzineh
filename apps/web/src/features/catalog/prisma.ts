import type { Prisma } from "@prisma/client";
import type { FilterParams, Sort } from "@sabzineh/types";

/**
 * Prisma query builders for the catalog — pure functions, no database
 * needed, so they are unit-tested without DATABASE_URL (see
 * prisma.test.ts). The seed adapter (repository.ts) reproduces the
 * exact same semantics in memory; the two must stay in sync.
 *
 * NOTE: `params.category` is a slug. The repository resolves it to
 * descendant category IDs first and passes them as `categoryIds`;
 * this builder never sees the slug.
 */

/** Full-text style search over product title + vendor name. */
export function buildSearchWhere(q: string): Prisma.ProductWhereInput {
  const query = q.trim();
  if (!query) return {};
  return {
    OR: [
      { title: { contains: query, mode: "insensitive" } },
      { vendor: { shopName: { contains: query, mode: "insensitive" } } },
    ],
  };
}

/** The complete product filter as a Prisma `where` clause. */
export function buildProductWhere(
  params: FilterParams,
  categoryIds: string[] = [],
): Prisma.ProductWhereInput {
  const AND: Prisma.ProductWhereInput[] = [{ status: "PUBLISHED" }];
  if (categoryIds.length > 0) AND.push({ categoryId: { in: categoryIds } });
  if (params.vendor) AND.push({ vendorId: params.vendor });
  if (params.minPrice !== undefined || params.maxPrice !== undefined) {
    AND.push({ price: { gte: params.minPrice, lte: params.maxPrice } });
  }
  if (params.inStock) AND.push({ stock: { gt: 0 } });
  if (params.organic) AND.push({ organic: true });
  if (params.glutenFree) AND.push({ glutenFree: true });
  if (params.local) AND.push({ local: true });
  if (params.minRating !== undefined) AND.push({ rating: { gte: params.minRating } });
  if (params.q) AND.push(buildSearchWhere(params.q));
  return { AND };
}

export type FacetKey =
  | "vendor"
  | "organic"
  | "glutenFree"
  | "local"
  | "inStock"
  | "minRating"
  | "price"
  | "q";

/**
 * The `where` clause for counting one facet: every filter applies
 * EXCEPT the facet being counted, so its counts never collapse to
 * zero because of the facet itself (standard faceted search).
 */
export function buildFacetWhere(
  params: FilterParams,
  categoryIds: string[] = [],
  exclude: FacetKey,
): Prisma.ProductWhereInput {
  const { ...rest } = params;
  switch (exclude) {
    case "vendor":
      delete rest.vendor;
      break;
    case "organic":
      delete rest.organic;
      break;
    case "glutenFree":
      delete rest.glutenFree;
      break;
    case "local":
      delete rest.local;
      break;
    case "inStock":
      delete rest.inStock;
      break;
    case "minRating":
      delete rest.minRating;
      break;
    case "price":
      delete rest.minPrice;
      delete rest.maxPrice;
      break;
    case "q":
      delete rest.q;
      break;
  }
  return buildProductWhere(rest, categoryIds);
}

/** Sort select value → Prisma `orderBy`. */
export function buildProductOrderBy(sort: Sort | undefined): Prisma.ProductOrderByWithRelationInput[] {
  switch (sort) {
    case "cheapest":
      return [{ price: "asc" }, { id: "asc" }];
    case "priciest":
      return [{ price: "desc" }, { id: "asc" }];
    case "bestselling":
      // No sales counter on Product yet — rating is the proxy until
      // order-item aggregates land (Week 6 admin reports).
      return [{ rating: "desc" }, { createdAt: "desc" }];
    case "newest":
    default:
      return [{ createdAt: "desc" }, { id: "asc" }];
  }
}
