/**
 * Seed-data accessors for the no-DB storefront.
 * The same JSON feeds Prisma seed (prisma/seed.ts); when DATABASE_URL
 * is set, these helpers are replaced by Prisma queries (Week 2+).
 *
 * The mutable arrays live on `globalThis` — the same singleton
 * pattern as the data/billing stores. Next.js compiles route
 * handlers into a separate bundle from RSC pages and server actions,
 * so a module-level array would be instantiated twice: a product
 * created through a server action would be invisible to the catalog
 * API route (and the cart that reads it). Sharing one array object
 * per process keeps every bundle reading the same store.
 */
import seed from "./seed.json";
import type { CategoryDTO, ProductDTO, VendorDTO } from "@sabzineh/types";

const globalForSeed = globalThis as unknown as {
  sabzinehSeed?: {
    categories: CategoryDTO[];
    vendors: VendorDTO[];
    products: ProductDTO[];
  };
};

function buildSeedData() {
  return {
    categories: seed.categories.map((c) => ({
      id: c.id,
      parentId: c.parentId,
      slug: c.slug,
      nameFa: c.nameFa,
      nameEn: c.nameEn,
      sortOrder: c.sortOrder,
    })),
    vendors: seed.vendors.map((v) => ({
      id: v.id,
      shopName: v.shopName,
      slug: v.slug,
      city: v.city,
      rating: v.rating,
      status: "APPROVED" as const,
    })),
    products: seed.products.map((p) => ({
      id: p.id,
      vendorId: p.vendorId,
      categoryId: p.categoryId,
      title: p.title,
      slug: p.slug,
      description: p.description,
      price: p.price,
      compareAtPrice: p.compareAtPrice,
      stock: p.stock,
      status: "PUBLISHED" as const,
      organic: p.organic,
      glutenFree: p.glutenFree,
      local: p.local,
      rating: p.rating,
    })),
  };
}

const sharedSeed = (globalForSeed.sabzinehSeed ??= buildSeedData());

export const categories: CategoryDTO[] = sharedSeed.categories;
export const vendors: VendorDTO[] = sharedSeed.vendors;
export const products: ProductDTO[] = sharedSeed.products;

export const plans = seed.plans;
export const discounts = seed.discounts;
export const banners = seed.banners;
export const demoUsers = seed.demoUsers;

export interface CategoryNode extends CategoryDTO {
  children: CategoryNode[];
  productCount: number;
}

/** Builds the 3-level tree with a product count on every node. */
export function buildCategoryTree(): CategoryNode[] {
  const byParent = new Map<string | null, CategoryDTO[]>();
  for (const category of categories) {
    const list = byParent.get(category.parentId) ?? [];
    list.push(category);
    byParent.set(category.parentId, list);
  }
  const countFor = (id: string): number =>
    products.filter((p) => p.categoryId === id).length +
    (byParent.get(id) ?? []).reduce((sum, child) => sum + countFor(child.id), 0);
  const build = (parentId: string | null): CategoryNode[] =>
    (byParent.get(parentId) ?? [])
      .sort((a, b) => a.sortOrder - b.sortOrder)
      .map((c) => ({ ...c, children: build(c.id), productCount: countFor(c.id) }));
  return build(null);
}

export function getCategoryBySlug(slug: string): CategoryDTO | undefined {
  return categories.find((c) => c.slug === slug);
}

export function getVendorById(id: string): VendorDTO | undefined {
  return vendors.find((v) => v.id === id);
}

export function getProductBySlug(slug: string): ProductDTO | undefined {
  return products.find((p) => p.slug === slug);
}

export function getProductsByCategory(categoryId: string): ProductDTO[] {
  return products.filter((p) => p.categoryId === categoryId);
}

/** Deterministic SVG placeholder (no external images, no CDN). */
export function placeholderImage(title: string, variant = 0): string {
  const initial = title.trim().charAt(0);
  const backgrounds = ["#dcead8", "#e8dcc8", "#d8e2ea"];
  const foregrounds = ["#265423", "#6b4a1f", "#1f3a5c"];
  const bg = backgrounds[variant % backgrounds.length];
  const fg = foregrounds[variant % foregrounds.length];
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="800" height="800"><rect width="800" height="800" fill="${bg}"/><text x="400" y="440" font-size="280" text-anchor="middle" fill="${fg}" font-family="sans-serif">${initial}</text></svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}
