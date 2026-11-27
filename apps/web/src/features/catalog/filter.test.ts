import { describe, expect, it } from "vitest";
import { applyFilter, buildFilterSearchParams, parseFilterParams } from "./filter";

const items = [
  { title: "سیب قرمز", categoryId: "apples", vendorId: "v01", price: 90000, stock: 5, organic: true, glutenFree: true, rating: 4.5 },
  { title: "پرتقال", categoryId: "citrus", vendorId: "v02", price: 60000, stock: 0, organic: false, glutenFree: true, rating: 4.0 },
  { title: "عسل کوهی", categoryId: "honey", vendorId: "v01", price: 800000, stock: 2, organic: true, glutenFree: true, rating: 5.0 },
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
});

describe("buildFilterSearchParams", () => {
  it("round-trips through parseFilterParams", () => {
    const params = { category: "citrus", minPrice: 50000, inStock: true, sort: "cheapest" as const };
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

  it("sorts priciest first", () => {
    expect(applyFilter(items, { sort: "priciest" })[0].title).toBe("عسل کوهی");
  });
});
