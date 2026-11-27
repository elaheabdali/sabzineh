import { FilterParamsSchema, type FilterParams, type Sort } from "@sabzineh/types";

/**
 * URL-synced faceted filter. The URL is the only source of truth:
 * parsing it reproduces the exact list, so filtered links are
 * shareable and the back button works. Server-rendered (Week 2
 * moves the query itself to Prisma; the shape does not change).
 */

export const SORT_OPTIONS: { value: Sort; labelFa: string; labelEn: string }[] = [
  { value: "newest", labelFa: "جدیدترین", labelEn: "Newest" },
  { value: "cheapest", labelFa: "ارزان‌ترین", labelEn: "Cheapest" },
  { value: "priciest", labelFa: "گران‌ترین", labelEn: "Most expensive" },
  { value: "bestselling", labelFa: "پرفروش‌ترین", labelEn: "Best selling" },
];

/** Products per catalog page (server-side pagination, both adapters). */
export const PAGE_SIZE = 12;

/** Parses raw searchParams into a validated FilterParams object. */
export function parseFilterParams(input: Record<string, string | string[] | undefined>): FilterParams {
  const flat: Record<string, string> = {};
  for (const [key, value] of Object.entries(input)) {
    if (typeof value === "string") flat[key] = value;
  }
  const parsed = FilterParamsSchema.safeParse(flat);
  if (!parsed.success) return {};
  const params = parsed.data;
  // Guard against an inverted price range: treat it as "no max".
  if (
    params.minPrice !== undefined &&
    params.maxPrice !== undefined &&
    params.minPrice > params.maxPrice
  ) {
    delete params.maxPrice;
  }
  return params;
}

/** Builds the query string for a filter state (drops empty values). */
export function buildFilterSearchParams(params: FilterParams): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === "") continue;
    search.set(key, String(value));
  }
  const query = search.toString();
  return query ? `?${query}` : "";
}

/** Applies a parsed filter to an in-memory product list (Week 1). */
export function applyFilter<T extends {
  title: string;
  categoryId: string;
  vendorId: string;
  price: number;
  stock: number;
  organic: boolean;
  glutenFree: boolean;
  local: boolean;
  rating: number;
}>(items: T[], params: FilterParams): T[] {
  let result = items;
  if (params.q) {
    const q = params.q.toLowerCase();
    result = result.filter((item) => item.title.toLowerCase().includes(q));
  }
  if (params.category) result = result.filter((item) => item.categoryId === params.category);
  if (params.vendor) result = result.filter((item) => item.vendorId === params.vendor);
  if (params.minPrice !== undefined) result = result.filter((item) => item.price >= params.minPrice!);
  if (params.maxPrice !== undefined) result = result.filter((item) => item.price <= params.maxPrice!);
  if (params.inStock) result = result.filter((item) => item.stock > 0);
  if (params.organic) result = result.filter((item) => item.organic);
  if (params.glutenFree) result = result.filter((item) => item.glutenFree);
  if (params.local) result = result.filter((item) => item.local);
  if (params.minRating !== undefined) result = result.filter((item) => item.rating >= params.minRating!);
  switch (params.sort) {
    case "cheapest":
      return [...result].sort((a, b) => a.price - b.price);
    case "priciest":
      return [...result].sort((a, b) => b.price - a.price);
    case "bestselling":
      return [...result].sort((a, b) => b.rating - a.rating);
    case "newest":
    default:
      return result;
  }
}

export interface PageSlice<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

/** Slices a filtered list into one page; page is clamped to range. */
export function paginate<T>(items: T[], page: number | undefined, pageSize: number = PAGE_SIZE): PageSlice<T> {
  const total = items.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const safePage = Math.min(Math.max(page ?? 1, 1), totalPages);
  const start = (safePage - 1) * pageSize;
  return { items: items.slice(start, start + pageSize), total, page: safePage, pageSize, totalPages };
}

/**
 * Merges a patch into the current filter state. Changing any filter
 * (other than the page itself) resets the page to 1; `undefined`
 * values drop the key entirely.
 */
export function updateFilterParams(current: FilterParams, patch: FilterParams): FilterParams {
  const next: FilterParams = { ...current, ...patch };
  for (const [key, value] of Object.entries(next)) {
    if (value === undefined) delete next[key as keyof FilterParams];
  }
  if (!("page" in patch)) delete next.page;
  return next;
}
