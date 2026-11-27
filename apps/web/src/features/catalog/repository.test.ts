import { describe, expect, it } from "vitest";
import { SeedCatalogRepository, descendantIds } from "./repository";
import { buildCategoryTree } from "@/data/seed";

const repo = new SeedCatalogRepository();

describe("SeedCatalogRepository.listProducts", () => {
  it("paginates a large category: 12 per page, disjoint pages", async () => {
    const tree = await repo.getCategoryTree();
    const ids = descendantIds(tree, "fruits-vegetables");
    const page1 = await repo.listProducts({ page: 1 }, { categoryIds: ids });
    const page2 = await repo.listProducts({ page: 2 }, { categoryIds: ids });
    expect(page1.pageSize).toBe(12);
    expect(page1.items).toHaveLength(12);
    expect(page1.total).toBeGreaterThan(12);
    expect(page1.totalPages).toBe(Math.ceil(page1.total / 12));
    expect(page2.items.map((p) => p.id)).not.toEqual(page1.items.map((p) => p.id));
    expect(new Set([...page1.items, ...page2.items].map((p) => p.id)).size).toBe(
      page1.items.length + page2.items.length,
    );
  });

  it("filters category + price + in-stock and sorts cheapest first", async () => {
    const tree = await repo.getCategoryTree();
    const ids = descendantIds(tree, "fruits-vegetables");
    const result = await repo.listProducts(
      { maxPrice: 100000, inStock: true, sort: "cheapest" },
      { categoryIds: ids },
    );
    expect(result.items.length).toBeGreaterThan(0);
    expect(result.items.every((p) => p.price <= 100000 && p.stock > 0)).toBe(true);
    const prices = result.items.map((p) => p.price);
    expect(prices).toEqual([...prices].sort((a, b) => a - b));
  });

  it("searches titles and vendor names", async () => {
    const byTitle = await repo.listProducts({ q: "عسل" });
    expect(byTitle.total).toBeGreaterThan(0);
    expect(byTitle.items.every((p) => p.title.includes("عسل"))).toBe(true);

    const byVendor = await repo.listProducts({ q: "باغ سبز کرج" });
    expect(byVendor.total).toBeGreaterThan(0);
    expect(byVendor.items.every((p) => p.vendorId === "v01")).toBe(true);
  });

  it("returns an empty page for a query with no matches", async () => {
    const result = await repo.listProducts({ q: "zzzzzz-no-such-product" });
    expect(result.total).toBe(0);
    expect(result.items).toEqual([]);
  });
});

describe("SeedCatalogRepository.getFacets", () => {
  it("vendor counts sum to the scoped total", async () => {
    const tree = await repo.getCategoryTree();
    const ids = descendantIds(tree, "dairy");
    const [facets, list] = await Promise.all([
      repo.getFacets({}, { categoryIds: ids }),
      repo.listProducts({}, { categoryIds: ids }),
    ]);
    const sum = facets.vendors.reduce((s, v) => s + v.count, 0);
    expect(sum).toBe(list.total);
  });

  it("attribute counts ignore their own filter", async () => {
    const facets = await repo.getFacets({ organic: true });
    const all = await repo.getFacets({});
    expect(facets.attributes.organic).toBe(all.attributes.organic);
    expect(facets.attributes.organic).toBeGreaterThan(0);
  });

  it("price bounds cover the whole catalog", async () => {
    const facets = await repo.getFacets({});
    expect(facets.price.min).toBe(35000);
    expect(facets.price.max).toBeGreaterThan(1_000_000);
  });
});

describe("SeedCatalogRepository helpers", () => {
  it("resolves a category slug to its descendant ids", async () => {
    const tree = buildCategoryTree();
    const ids = descendantIds(tree, "fresh-fruit");
    expect(ids).toContain("fresh-fruit");
    expect(ids).toContain("apples-pears");
    expect(ids).toContain("citrus");
    expect(ids).not.toContain("dairy");
  });

  it("returns related products from the same category, excluding self", async () => {
    const product = await repo.getProductBySlug("apples-pears-1");
    expect(product).not.toBeNull();
    const related = await repo.getRelatedProducts(product!, 4);
    expect(related.length).toBeGreaterThan(0);
    expect(related.every((p) => p.categoryId === product!.categoryId && p.id !== product!.id)).toBe(true);
  });

  it("returns deterministic reviews for a product", async () => {
    const first = await repo.getReviews("p001");
    const second = await repo.getReviews("p001");
    expect(first).toEqual(second);
    expect(first.length).toBeGreaterThanOrEqual(2);
    expect(first.every((r) => r.rating >= 1 && r.rating <= 5)).toBe(true);
  });

  it("returns the ancestor chain for a leaf category", async () => {
    const ancestors = await repo.getCategoryAncestors("apples-pears");
    expect(ancestors.map((c) => c.slug)).toEqual(["fruits-vegetables", "fresh-fruit", "apples-pears"]);
  });
});
