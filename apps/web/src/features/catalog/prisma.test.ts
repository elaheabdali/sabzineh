import { describe, expect, it } from "vitest";
import { buildFacetWhere, buildProductOrderBy, buildProductWhere, buildSearchWhere } from "./prisma";

/**
 * Prisma query builders are pure functions — these tests pin the SQL
 * semantics without a database. The seed adapter (repository.test.ts)
 * must produce the same results for the same inputs.
 */
describe("buildProductWhere", () => {
  it("always restricts to published products", () => {
    expect(buildProductWhere({})).toEqual({ AND: [{ status: "PUBLISHED" }] });
  });

  it("builds category + price + in-stock + attributes", () => {
    expect(
      buildProductWhere(
        { minPrice: 50000, maxPrice: 200000, inStock: true, organic: true, local: true },
        ["apples-pears", "citrus"],
      ),
    ).toEqual({
      AND: [
        { status: "PUBLISHED" },
        { categoryId: { in: ["apples-pears", "citrus"] } },
        { price: { gte: 50000, lte: 200000 } },
        { stock: { gt: 0 } },
        { organic: true },
        { local: true },
      ],
    });
  });

  it("builds vendor + rating + search", () => {
    const where = buildProductWhere({ vendor: "v01", minRating: 4.5, q: "عسل" });
    expect(where).toEqual({
      AND: [
        { status: "PUBLISHED" },
        { vendorId: "v01" },
        { rating: { gte: 4.5 } },
        {
          OR: [
            { title: { contains: "عسل", mode: "insensitive" } },
            { vendor: { shopName: { contains: "عسل", mode: "insensitive" } } },
          ],
        },
      ],
    });
  });

  it("omits the price clause when no bound is set", () => {
    expect(buildProductWhere({ sort: "cheapest" })).toEqual({ AND: [{ status: "PUBLISHED" }] });
  });
});

describe("buildSearchWhere", () => {
  it("returns empty for a blank query", () => {
    expect(buildSearchWhere("   ")).toEqual({});
  });
});

describe("buildFacetWhere", () => {
  it("drops only the excluded facet", () => {
    const where = buildFacetWhere({ vendor: "v01", organic: true, minPrice: 1000 }, [], "vendor");
    expect(where).toEqual({
      AND: [{ status: "PUBLISHED" }, { price: { gte: 1000, lte: undefined } }, { organic: true }],
    });
  });

  it("drops both price bounds when excluding price", () => {
    const where = buildFacetWhere({ minPrice: 1000, maxPrice: 5000, inStock: true }, [], "price");
    expect(where).toEqual({ AND: [{ status: "PUBLISHED" }, { stock: { gt: 0 } }] });
  });
});

describe("buildProductOrderBy", () => {
  it("maps every sort option", () => {
    expect(buildProductOrderBy("cheapest")).toEqual([{ price: "asc" }, { id: "asc" }]);
    expect(buildProductOrderBy("priciest")).toEqual([{ price: "desc" }, { id: "asc" }]);
    expect(buildProductOrderBy("bestselling")).toEqual([{ rating: "desc" }, { createdAt: "desc" }]);
    expect(buildProductOrderBy("newest")).toEqual([{ createdAt: "desc" }, { id: "asc" }]);
    expect(buildProductOrderBy(undefined)).toEqual([{ createdAt: "desc" }, { id: "asc" }]);
  });
});
