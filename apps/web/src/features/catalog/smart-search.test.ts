import { describe, expect, it } from "vitest";
import {
  closestKnownWord,
  expandSynonyms,
  levenshtein,
  parseSmartQuery,
} from "./smart-search";

describe("parseSmartQuery (Week 7 heuristic search)", () => {
  it("maps attribute phrases to filters", () => {
    const { params, matched, corrected } = parseSmartQuery("عسل ارگانیک بدون گلوتن");
    expect(params).toEqual({ organic: true, glutenFree: true, q: "عسل" });
    expect(matched).toEqual(["بدون گلوتن", "ارگانیک"]);
    expect(corrected).toEqual([]);
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
    const result = parseSmartQuery("زعفران قائنات");
    expect(result.params).toEqual({ q: "زعفران قائنات" });
    expect(result.matched).toEqual([]);
    expect(result.understood).toContain("زعفران قائنات");
  });

  it("returns empty params for empty input", () => {
    const result = parseSmartQuery("   ");
    expect(result.params).toEqual({});
    expect(result.matched).toEqual([]);
    expect(result.understood).toBe("همه محصولات");
  });

  it("extracts a price range with بین…تا", () => {
    const { params, matched } = parseSmartQuery("عسل بین ۵۰ تا ۱۰۰ هزار تومان");
    expect(params.minPrice).toBe(50000);
    expect(params.maxPrice).toBe(100000);
    expect(params.q).toBe("عسل");
    expect(matched.some((m) => m.includes("بین"))).toBe(true);
  });

  it("extracts a minimum rating", () => {
    const { params } = parseSmartQuery("عسل با امتیاز بالای ۴");
    expect(params.minRating).toBe(4);
    expect(params.q).toBe("عسل");
  });

  it("maps a category by its Persian name", () => {
    const { params, matched } = parseSmartQuery("میوه تازه ارگانیک");
    expect(params.category).toBe("fresh-fruit");
    expect(params.organic).toBe(true);
    expect(matched).toContain("میوه تازه");
  });

  it("maps a vendor by shop name", () => {
    const { params } = parseSmartQuery("محصولات باغ سبز کرج");
    expect(params.vendor).toBe("v01");
  });

  it("corrects a typo and reports it", () => {
    const { params, corrected } = parseSmartQuery("عسلل ارگانیک");
    expect(params.q).toBe("عسل");
    expect(params.organic).toBe(true);
    expect(corrected).toEqual([{ from: "عسلل", to: "عسل" }]);
  });

  it("does not correct words that are far from any known word", () => {
    const { params, corrected } = parseSmartQuery("زعفران قائنات");
    expect(params.q).toBe("زعفران قائنات");
    expect(corrected).toEqual([]);
  });

  it("strips question marks so stop words still match", () => {
    expect(parseSmartQuery("عسل چی داری؟").params).toEqual({ q: "عسل" });
    expect(parseSmartQuery("عسل؟").params).toEqual({ q: "عسل" });
  });

  it("explains what was understood", () => {
    const { understood } = parseSmartQuery("عسل ارگانیک زیر ۱۰۰ هزار تومان");
    expect(understood).toContain("عسل");
    expect(understood).toContain("ارگانیک");
    expect(understood).toContain("۱۰۰");
  });
});

describe("expandSynonyms", () => {
  it("maps English words to the Persian catalog term", () => {
    expect(expandSynonyms("apple")).toBe("سیب");
    expect(expandSynonyms("honey ارگانیک")).toBe("عسل ارگانیک");
    expect(expandSynonyms("fresh rice")).toBe("fresh برنج");
  });

  it("leaves unknown words untouched", () => {
    expect(expandSynonyms("زعفران")).toBe("زعفران");
  });
});

describe("levenshtein + closestKnownWord", () => {
  it("measures edit distance", () => {
    expect(levenshtein("عسل", "عسل")).toBe(0);
    expect(levenshtein("عسل", "عسلل")).toBe(1);
    expect(levenshtein("سیب", "سیبب")).toBe(1);
    expect(levenshtein("عسل", "برنج")).toBeGreaterThan(2);
  });

  it("finds the closest known word within the threshold", () => {
    expect(closestKnownWord("عسلل")).toBe("عسل");
    expect(closestKnownWord("عسل")).toBe("عسل");
  });

  it("returns null when nothing is close enough", () => {
    expect(closestKnownWord("قائنات")).toBeNull();
    expect(closestKnownWord("xyz")).toBeNull();
  });
});
