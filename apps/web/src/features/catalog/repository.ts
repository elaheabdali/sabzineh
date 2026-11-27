import type { PrismaClient, Product as PrismaProduct } from "@prisma/client";
import type {
  CatalogListResult,
  CategoryDTO,
  FacetCounts,
  FilterParams,
  ProductDTO,
  ReviewDTO,
  VendorDTO,
} from "@sabzineh/types";
import { getPrismaClient } from "@/lib/prisma";
import {
  buildCategoryTree,
  categories,
  getCategoryBySlug as getSeedCategoryBySlug,
  getProductBySlug as getSeedProductBySlug,
  getVendorById as getSeedVendorById,
  products as seedProducts,
  vendors as seedVendors,
  type CategoryNode,
} from "@/data/seed";
import { applyFilter, PAGE_SIZE, paginate } from "./filter";
import { buildFacetWhere, buildProductOrderBy, buildProductWhere } from "./prisma";
import { getSeedReviews } from "./reviews";
import { getProductImages } from "@/data/product-images";

/** Uploaded images ride on the DTO; absent = placeholder gallery. */
function withImages(item: ProductDTO): ProductDTO {
  const images = getProductImages(item.id).map((i) => i.url);
  return images.length > 0 ? { ...item, images } : item;
}

/**
 * Catalog repository — one interface, two adapters.
 *
 * - SeedCatalogRepository: in-memory over seed.json (no DATABASE_URL).
 * - PrismaCatalogRepository: real Postgres queries (DATABASE_URL set).
 *
 * The app NEVER imports either adapter directly; it calls
 * getCatalogRepository(), which switches on DATABASE_URL. Both
 * adapters implement identical semantics: same filter meaning, same
 * sort order, same facet-count rule (a facet is counted on the set
 * matching every filter EXCEPT that facet), same pagination.
 * Switching the data source changes no page code.
 */

export interface CatalogRepository {
  listProducts(params: FilterParams, scope?: { categoryIds?: string[] }): Promise<CatalogListResult>;
  getFacets(params: FilterParams, scope?: { categoryIds?: string[] }): Promise<FacetCounts>;
  getProductBySlug(slug: string): Promise<ProductDTO | null>;
  getProductById(id: string): Promise<ProductDTO | null>;
  /**
   * Adjusts stock by delta (negative = reserve at order time, positive =
   * release on cancel). Throws when the result would go below zero.
   * Returns the new stock level.
   */
  adjustStock(productId: string, delta: number): Promise<number>;
  getCategoryBySlug(slug: string): Promise<CategoryDTO | null>;
  getCategoryById(id: string): Promise<CategoryDTO | null>;
  getAllProductSlugs(): Promise<string[]>;
  getCategoryTree(): Promise<CategoryNode[]>;
  getCategoryAncestors(slug: string): Promise<CategoryDTO[]>;
  getVendorById(id: string): Promise<VendorDTO | null>;
  getVendors(): Promise<VendorDTO[]>;
  getRelatedProducts(product: ProductDTO, limit?: number): Promise<ProductDTO[]>;
  getReviews(productId: string): Promise<ReviewDTO[]>;
}

/** Category ids of a node and all its descendants (tree walk). */
export function descendantIds(tree: CategoryNode[], slug: string): string[] {
  const find = (nodes: CategoryNode[]): CategoryNode | undefined => {
    for (const node of nodes) {
      if (node.slug === slug) return node;
      const found = find(node.children);
      if (found) return found;
    }
    return undefined;
  };
  const node = find(tree);
  if (!node) return [];
  const collect = (n: CategoryNode): string[] => [n.id, ...n.children.flatMap(collect)];
  return collect(node);
}

/** Ancestor chain from the root down to (and including) the node. */
export function ancestorChain(tree: CategoryNode[], slug: string): CategoryDTO[] {
  const walk = (nodes: CategoryNode[], trail: CategoryDTO[]): CategoryDTO[] | null => {
    for (const node of nodes) {
      const next = [...trail, node];
      if (node.slug === slug) return next;
      const found = walk(node.children, next);
      if (found) return found;
    }
    return null;
  };
  return walk(tree, []) ?? [];
}

// ---------------------------------------------------------------------------
// Seed adapter (no database)
// ---------------------------------------------------------------------------

function seedSearch(items: ProductDTO[], q: string): ProductDTO[] {
  const query = q.toLowerCase();
  return items.filter((item) => {
    if (item.title.toLowerCase().includes(query)) return true;
    const vendor = seedVendors.find((v) => v.id === item.vendorId);
    return vendor?.shopName.toLowerCase().includes(query) ?? false;
  });
}

export class SeedCatalogRepository implements CatalogRepository {
  private scoped(params: FilterParams, scope?: { categoryIds?: string[] }): ProductDTO[] {
    // Public listing: only PUBLISHED products. Vendor drafts live in
    // the same array (Week 5) and must never leak into the storefront.
    let items = seedProducts.filter((p) => p.status === "PUBLISHED");
    const ids = scope?.categoryIds;
    if (ids) {
      const set = new Set(ids);
      items = items.filter((p) => set.has(p.categoryId));
    } else if (params.category) {
      const resolved = descendantIds(buildCategoryTree(), params.category);
      const set = new Set(resolved);
      items = items.filter((p) => set.has(p.categoryId));
    }
    return items;
  }

  /** Filters minus the facet being counted (mirrors buildFacetWhere). */
  private except(params: FilterParams, omit: (keyof FilterParams)[]): FilterParams {
    const next: FilterParams = { ...params };
    for (const key of omit) delete next[key];
    return next;
  }

  private apply(items: ProductDTO[], params: FilterParams): ProductDTO[] {
    const rest: FilterParams = { ...params };
    delete rest.q;
    delete rest.category;
    let result = applyFilter(items, rest);
    if (params.q) result = seedSearch(result, params.q);
    return result;
  }

  async listProducts(params: FilterParams, scope?: { categoryIds?: string[] }): Promise<CatalogListResult> {
    const filtered = this.apply(this.scoped(params, scope), params);
    const page = paginate(filtered, params.page, PAGE_SIZE);
    return { items: page.items.map(withImages), total: page.total, page: page.page, pageSize: page.pageSize, totalPages: page.totalPages };
  }

  async getFacets(params: FilterParams, scope?: { categoryIds?: string[] }): Promise<FacetCounts> {
    const base = this.scoped(params, scope);
    const countBy = (items: ProductDTO[], key: (p: ProductDTO) => string) => {
      const counts = new Map<string, number>();
      for (const item of items) counts.set(key(item), (counts.get(key(item)) ?? 0) + 1);
      return [...counts.entries()].map(([id, count]) => ({ id, count }));
    };
    const categoryItems = this.apply(base, this.except(params, []));
    const vendorItems = this.apply(base, this.except(params, ["vendor"]));
    const priceItems = this.apply(base, this.except(params, ["minPrice", "maxPrice"]));
    const prices = priceItems.map((p) => p.price);
    return {
      categories: countBy(categoryItems, (p) => p.categoryId),
      vendors: countBy(vendorItems, (p) => p.vendorId),
      attributes: {
        organic: this.apply(base, this.except(params, ["organic"])).filter((p) => p.organic).length,
        glutenFree: this.apply(base, this.except(params, ["glutenFree"])).filter((p) => p.glutenFree).length,
        local: this.apply(base, this.except(params, ["local"])).filter((p) => p.local).length,
        inStock: this.apply(base, this.except(params, ["inStock"])).filter((p) => p.stock > 0).length,
      },
      price: { min: prices.length ? Math.min(...prices) : 0, max: prices.length ? Math.max(...prices) : 0 },
    };
  }

  async getProductBySlug(slug: string): Promise<ProductDTO | null> {
    const product = getSeedProductBySlug(slug);
    // Drafts are not public: the product page 404s for them.
    if (!product || product.status !== "PUBLISHED") return null;
    return withImages(product);
  }

  async getProductById(id: string): Promise<ProductDTO | null> {
    // Internal lookup (checkout re-validates price/stock): status is
    // deliberately NOT filtered here.
    const product = seedProducts.find((p) => p.id === id);
    return product ? withImages(product) : null;
  }

  async adjustStock(productId: string, delta: number): Promise<number> {
    const product = seedProducts.find((p) => p.id === productId);
    if (!product) throw new Error(`Unknown product: ${productId}`);
    const next = product.stock + delta;
    if (next < 0) throw new Error(`Insufficient stock for product: ${product.title}`);
    // In-memory mutation: the seed array is the store in no-DB mode,
    // so the new level is visible to every later read in this process.
    product.stock = next;
    return next;
  }

  async getCategoryBySlug(slug: string): Promise<CategoryDTO | null> {
    return getSeedCategoryBySlug(slug) ?? null;
  }

  async getCategoryById(id: string): Promise<CategoryDTO | null> {
    return categories.find((c) => c.id === id) ?? null;
  }

  async getAllProductSlugs(): Promise<string[]> {
    return seedProducts.filter((p) => p.status === "PUBLISHED").map((p) => p.slug);
  }

  async getCategoryTree(): Promise<CategoryNode[]> {
    return buildCategoryTree();
  }

  async getCategoryAncestors(slug: string): Promise<CategoryDTO[]> {
    return ancestorChain(buildCategoryTree(), slug);
  }

  async getVendorById(id: string): Promise<VendorDTO | null> {
    return getSeedVendorById(id) ?? null;
  }

  async getVendors(): Promise<VendorDTO[]> {
    return seedVendors;
  }

  async getRelatedProducts(product: ProductDTO, limit = 4): Promise<ProductDTO[]> {
    return seedProducts
      .filter((p) => p.categoryId === product.categoryId && p.id !== product.id && p.status === "PUBLISHED")
      .slice(0, limit)
      .map(withImages);
  }

  async getReviews(productId: string): Promise<ReviewDTO[]> {
    const product = seedProducts.find((p) => p.id === productId);
    if (!product) return [];
    return getSeedReviews(product.id, product.rating);
  }
}

// ---------------------------------------------------------------------------
// Prisma adapter (real database — DATABASE_URL set)
// ---------------------------------------------------------------------------

function toProductDTO(p: PrismaProduct): ProductDTO {
  return {
    id: p.id,
    vendorId: p.vendorId,
    categoryId: p.categoryId,
    title: p.title,
    slug: p.slug,
    description: p.description,
    price: p.price,
    compareAtPrice: p.compareAtPrice,
    stock: p.stock,
    status: p.status,
    organic: p.organic,
    glutenFree: p.glutenFree,
    local: p.local,
    rating: p.rating,
  };
}

type PrismaProductWithImages = PrismaProduct & { images: { url: string }[] };

function toProductDTOWithImages(p: PrismaProductWithImages): ProductDTO {
  const dto = toProductDTO(p);
  const images = p.images.map((i) => i.url);
  return images.length > 0 ? { ...dto, images } : dto;
}

const productImagesInclude = { images: { orderBy: { sortOrder: "asc" } } } as const;

function toVendorDTO(v: {
  id: string;
  shopName: string;
  slug: string;
  city: string;
  rating: number;
  status: "PENDING" | "APPROVED" | "REJECTED" | "SUSPENDED";
}): VendorDTO {
  return { id: v.id, shopName: v.shopName, slug: v.slug, city: v.city, rating: v.rating, status: v.status };
}

export class PrismaCatalogRepository implements CatalogRepository {
  constructor(private readonly prisma: PrismaClient) {}

  private async resolveCategoryIds(params: FilterParams, scope?: { categoryIds?: string[] }): Promise<string[]> {
    if (scope?.categoryIds) return scope.categoryIds;
    if (!params.category) return [];
    const tree = await this.getCategoryTree();
    return descendantIds(tree, params.category);
  }

  async listProducts(params: FilterParams, scope?: { categoryIds?: string[] }): Promise<CatalogListResult> {
    const categoryIds = await this.resolveCategoryIds(params, scope);
    const where = buildProductWhere(params, categoryIds);
    const page = Math.max(params.page ?? 1, 1);
    const [items, total] = await Promise.all([
      this.prisma.product.findMany({
        where,
        orderBy: buildProductOrderBy(params.sort),
        skip: (page - 1) * PAGE_SIZE,
        take: PAGE_SIZE,
        include: productImagesInclude,
      }),
      this.prisma.product.count({ where }),
    ]);
    const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
    const safePage = Math.min(page, totalPages);
    const safeItems =
      safePage === page
        ? items
        : await this.prisma.product.findMany({
            where,
            orderBy: buildProductOrderBy(params.sort),
            skip: (safePage - 1) * PAGE_SIZE,
            take: PAGE_SIZE,
            include: productImagesInclude,
          });
    return { items: safeItems.map(toProductDTOWithImages), total, page: safePage, pageSize: PAGE_SIZE, totalPages };
  }

  async getFacets(params: FilterParams, scope?: { categoryIds?: string[] }): Promise<FacetCounts> {
    const categoryIds = await this.resolveCategoryIds(params, scope);
    const [categoryGroups, vendorGroups, organic, glutenFree, local, inStock, price] = await Promise.all([
      this.prisma.product.groupBy({
        by: ["categoryId"],
        where: buildProductWhere(params, categoryIds),
        _count: { _all: true },
      }),
      this.prisma.product.groupBy({
        by: ["vendorId"],
        where: buildFacetWhere(params, categoryIds, "vendor"),
        _count: { _all: true },
      }),
      this.prisma.product.count({ where: { ...buildFacetWhere(params, categoryIds, "organic"), organic: true } }),
      this.prisma.product.count({ where: { ...buildFacetWhere(params, categoryIds, "glutenFree"), glutenFree: true } }),
      this.prisma.product.count({ where: { ...buildFacetWhere(params, categoryIds, "local"), local: true } }),
      this.prisma.product.count({ where: { ...buildFacetWhere(params, categoryIds, "inStock"), stock: { gt: 0 } } }),
      this.prisma.product.aggregate({
        where: buildFacetWhere(params, categoryIds, "price"),
        _min: { price: true },
        _max: { price: true },
      }),
    ]);
    return {
      categories: categoryGroups.map((g) => ({ id: g.categoryId, count: g._count._all })),
      vendors: vendorGroups.map((g) => ({ id: g.vendorId, count: g._count._all })),
      attributes: { organic, glutenFree, local, inStock },
      price: { min: price._min.price ?? 0, max: price._max.price ?? 0 },
    };
  }

  async getProductBySlug(slug: string): Promise<ProductDTO | null> {
    // Public page: drafts 404 here just like in the seed adapter.
    const product = await this.prisma.product.findFirst({
      where: { slug, status: "PUBLISHED" },
      include: productImagesInclude,
    });
    return product ? toProductDTOWithImages(product) : null;
  }

  async getProductById(id: string): Promise<ProductDTO | null> {
    // Internal lookup (checkout): status is deliberately NOT filtered.
    const product = await this.prisma.product.findUnique({
      where: { id },
      include: productImagesInclude,
    });
    return product ? toProductDTOWithImages(product) : null;
  }

  async adjustStock(productId: string, delta: number): Promise<number> {
    // Guarded update: only applies when the result stays >= 0, so two
    // concurrent checkouts cannot oversell the same product.
    const updated = await this.prisma.product.updateMany({
      where: { id: productId, stock: { gte: -delta } },
      data: { stock: { increment: delta } },
    });
    if (updated.count === 0) {
      const product = await this.prisma.product.findUnique({
        where: { id: productId },
        select: { title: true },
      });
      throw new Error(`Insufficient stock for product: ${product?.title ?? productId}`);
    }
    const after = await this.prisma.product.findUnique({
      where: { id: productId },
      select: { stock: true },
    });
    return after?.stock ?? 0;
  }

  async getCategoryBySlug(slug: string): Promise<CategoryDTO | null> {
    const category = await this.prisma.category.findUnique({ where: { slug } });
    return category
      ? {
          id: category.id,
          parentId: category.parentId,
          slug: category.slug,
          nameFa: category.nameFa,
          nameEn: category.nameEn,
          sortOrder: category.sortOrder,
        }
      : null;
  }

  async getCategoryById(id: string): Promise<CategoryDTO | null> {
    const category = await this.prisma.category.findUnique({ where: { id } });
    return category
      ? {
          id: category.id,
          parentId: category.parentId,
          slug: category.slug,
          nameFa: category.nameFa,
          nameEn: category.nameEn,
          sortOrder: category.sortOrder,
        }
      : null;
  }

  async getAllProductSlugs(): Promise<string[]> {
    const rows = await this.prisma.product.findMany({
      where: { status: "PUBLISHED" },
      select: { slug: true },
    });
    return rows.map((r) => r.slug);
  }

  async getCategoryTree(): Promise<CategoryNode[]> {
    const [all, counts] = await Promise.all([
      this.prisma.category.findMany({ orderBy: { sortOrder: "asc" } }),
      this.prisma.product.groupBy({ by: ["categoryId"], where: { status: "PUBLISHED" }, _count: { _all: true } }),
    ]);
    const countById = new Map(counts.map((c) => [c.categoryId, c._count._all]));
    const byParent = new Map<string | null, typeof all>();
    for (const category of all) {
      const list = byParent.get(category.parentId) ?? [];
      list.push(category);
      byParent.set(category.parentId, list);
    }
    const countFor = (id: string): number =>
      (countById.get(id) ?? 0) +
      (byParent.get(id) ?? []).reduce((sum, child) => sum + countFor(child.id), 0);
    const build = (parentId: string | null): CategoryNode[] =>
      (byParent.get(parentId) ?? []).map((c) => ({
        id: c.id,
        parentId: c.parentId,
        slug: c.slug,
        nameFa: c.nameFa,
        nameEn: c.nameEn,
        sortOrder: c.sortOrder,
        children: build(c.id),
        productCount: countFor(c.id),
      }));
    return build(null);
  }

  async getCategoryAncestors(slug: string): Promise<CategoryDTO[]> {
    const tree = await this.getCategoryTree();
    return ancestorChain(tree, slug);
  }

  async getVendorById(id: string): Promise<VendorDTO | null> {
    const vendor = await this.prisma.vendorProfile.findUnique({ where: { id } });
    return vendor ? toVendorDTO(vendor) : null;
  }

  async getVendors(): Promise<VendorDTO[]> {
    const vendors = await this.prisma.vendorProfile.findMany({
      where: { status: "APPROVED" },
      orderBy: { shopName: "asc" },
    });
    return vendors.map(toVendorDTO);
  }

  async getRelatedProducts(product: ProductDTO, limit = 4): Promise<ProductDTO[]> {
    const items = await this.prisma.product.findMany({
      where: { categoryId: product.categoryId, status: "PUBLISHED", id: { not: product.id } },
      orderBy: [{ rating: "desc" }],
      take: limit,
      include: productImagesInclude,
    });
    return items.map(toProductDTOWithImages);
  }

  async getReviews(productId: string): Promise<ReviewDTO[]> {
    const reviews = await this.prisma.review.findMany({
      where: { productId, status: "APPROVED" },
      orderBy: { createdAt: "desc" },
      take: 10,
    });
    // Review has no author name on the model; the demo seed uses the
    // deterministic generator until real user names exist.
    return reviews.map((r, i) => ({
      id: r.id,
      author: `خریدار ${i + 1}`,
      rating: r.rating,
      text: r.text,
      createdAt: r.createdAt.toISOString(),
    }));
  }
}

// ---------------------------------------------------------------------------
// Factory — the only entry point pages use
// ---------------------------------------------------------------------------

/** Prisma when DATABASE_URL is set, otherwise the seed adapter. */
export function getCatalogRepository(): CatalogRepository {
  const prisma = getPrismaClient();
  if (prisma) return new PrismaCatalogRepository(prisma);
  return new SeedCatalogRepository();
}

/** Which adapter is active — shown in README/docs, never a secret. */
export function getCatalogDataSource(): "prisma" | "seed" {
  return getPrismaClient() ? "prisma" : "seed";
}
