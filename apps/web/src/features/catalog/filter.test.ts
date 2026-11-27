import { describe, expect, it } from "vitest";
import { applyFilter, buildFilterSearchParams, paginate, parseFilterParams, updateFilterParams } from "./filter";

const items = [
  { title: "سیب قرمز", categoryId: "apples", vendorId: "v01", price: 90000, stock: 5, organic: true, glutenFree: true, local: true, rating: 4.5 },
  { title: "پرتقال", categoryId: "citrus", vendorId: "v02", price: 60000, stock: 0, organic: false, glutenFree: true, local: false, rating: 4.0 },
  { title: "عسل کوهی", categoryId: "honey", vendorId: "v01", price: 800000, stock: 2, organic: true, glutenFree: true, local: true, rating: 5.0 },
];

describe("parseFilterParams", () => {
  it("parses numbers, booleans and sort from raw search params", () => {
    expect(
      parseFilterParams({ minPrice: "50000", maxPrice: "100000", inStock: "true", sort: "cheapest" }),
    ).toEqual({ minPrice: 50000, maxPrice: 100000, inStock: true, sort: "cheapest" });
  });

  it("drops unknown keys and invalid values instead of throwing", () => {
    expect(parseFilterParams({ sort: "bogus", minPrice: "abc", nope: "1" })).toEqual({});
  });

  it("drops maxPrice when the range is inverted", () => {
    expect(parseFilterParams({ minPrice: "100000", maxPrice: "50000" })).toEqual({ minPrice: 100000 });
  });
  it("parses local and page", () => {
    expect(parseFilterParams({ local: "true", page: "2" })).toEqual({ local: true, page: 2 });
  });

  it("clamps an invalid page to nothing instead of throwing", () => {
    expect(parseFilterParams({ page: "0" })).toEqual({});
  });
});

describe("buildFilterSearchParams", () => {
  it("round-trips through parseFilterParams", () => {
    const params = { category: "citrus", minPrice: 50000, inStock: true, sort: "cheapest" as const };
    expect(parseFilterParams(Object.fromEntries(new URLSearchParams(buildFilterSearchParams(params))))).toEqual(params);
  });

  it("round-trips local + page", () => {
    const params = { local: true, page: 3 };
    expect(parseFilterParams(Object.fromEntries(new URLSearchParams(buildFilterSearchParams(params))))).toEqual(params);
  });

  it("returns an empty string for an empty filter", () => {
    expect(buildFilterSearchParams({})).toBe("");
  });
});

describe("applyFilter", () => {
  it("filters by category + price + in-stock and sorts cheapest first", () => {
    const result = applyFilter(items, { minPrice: 50000, inStock: true, sort: "cheapest" });
    expect(result.map((i) => i.title)).toEqual(["سیب قرمز", "عسل کوهی"]);
  });

  it("searches titles case-insensitively", () => {
    expect(applyFilter(items, { q: "عسل" }).map((i) => i.title)).toEqual(["عسل کوهی"]);
  });

  it("filters by local only", () => {
    expect(applyFilter(items, { local: true }).map((i) => i.title)).toEqual(["سیب قرمز", "عسل کوهی"]);
  });

  it("sorts priciest first", () => {
    expect(applyFilter(items, { sort: "priciest" })[0].title).toBe("عسل کوهی");
  });
});

describe("paginate", () => {
  it("slices page 2 and reports totals", () => {
    const page = paginate([1, 2, 3, 4, 5], 2, 2);
    expect(page).toEqual({ items: [3, 4], total: 5, page: 2, pageSize: 2, totalPages: 3 });
  });

  it("clamps an out-of-range page to the last page", () => {
    expect(paginate([1, 2, 3], 9, 2).page).toBe(2);
  });
});

describe("updateFilterParams", () => {
  it("resets the page when a filter changes", () => {
    expect(updateFilterParams({ page: 3, sort: "newest" }, { sort: "cheapest" })).toEqual({
      sort: "cheapest",
    });
  });

  it("keeps the page when only the page changes", () => {
    expect(updateFilterParams({ sort: "cheapest" }, { page: 2 })).toEqual({ sort: "cheapest", page: 2 });
  });

  it("drops keys set to undefined", () => {
    expect(updateFilterParams({ vendor: "v01", organic: true }, { vendor: undefined })).toEqual({
      organic: true,
    });
  });
});
