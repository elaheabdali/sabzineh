import { describe, expect, it } from "vitest";
import { parseSmartQuery } from "./smart-search";

describe("parseSmartQuery (stub)", () => {
  it("maps attribute phrases to filters", () => {
    const { params, matched } = parseSmartQuery("عسل ارگانیک بدون گلوتن");
    expect(params).toEqual({ organic: true, glutenFree: true, q: "عسل" });
    expect(matched).toEqual(["بدون گلوتن", "ارگانیک"]);
  });

  it("extracts a Persian-digit price ceiling", () => {
    const { params } = parseSmartQuery("زیر ۱۰۰ هزار تومان");
    expect(params.maxPrice).toBe(100000);
    expect(params.q).toBeUndefined();
  });

  it("extracts a million-Toman ceiling", () => {
    expect(parseSmartQuery("کمتر از ۲ میلیون").params.maxPrice).toBe(2_000_000);
  });

  it("maps sort phrases", () => {
    expect(parseSmartQuery("ارزان‌ترین برنج").params).toEqual({ sort: "cheapest", q: "برنج" });
    expect(parseSmartQuery("پرفروش‌ترین عسل").params.sort).toBe("bestselling");
  });

  it("maps local + in-stock", () => {
    const { params } = parseSmartQuery("نان محلی موجود");
    expect(params).toEqual({ local: true, inStock: true, q: "نان" });
  });

  it("leaves plain text as the query", () => {
    expect(parseSmartQuery("زعفران قائنات")).toEqual({ params: { q: "زعفران قائنات" }, matched: [] });
  });

  it("returns empty params for empty input", () => {
    expect(parseSmartQuery("   ")).toEqual({ params: {}, matched: [] });
  });
});
