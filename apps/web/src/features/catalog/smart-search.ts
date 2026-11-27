import type { FilterParams } from "@sabzineh/types";

/**
 * AI smart-search — STUB (Week 2).
 *
 * Hook point for the plan's "natural-language → structured filters"
 * feature: a keyword matcher maps Persian phrases to the same
 * FilterParams the faceted UI uses. It calls NO AI API and makes NO
 * network request. In Week 7 this function is replaced by a server
 * AI client call behind the identical signature; the search page,
 * the URL shape and the tests do not change.
 *
 * Supported phrases (examples):
 *   "بدون گلوتن" → glutenFree      "ارگانیک" → organic
 *   "محلی" / "بومی" → local         "موجود" → inStock
 *   "ارزان" → sort cheapest         "پرفروش" → sort bestselling
 *   "زیر ۱۰۰ هزار تومان" → maxPrice 100000
 * Everything left over becomes the text query `q`.
 */

const FA_DIGITS = "۰۱۲۳۴۵۶۷۸۹";
const AR_DIGITS = "٠١٢٣٤٥٦٧٨٩";

function normalizeDigits(input: string): string {
  return input.replace(/[۰-۹٠-٩]/g, (d) => {
    const fa = FA_DIGITS.indexOf(d);
    if (fa >= 0) return String(fa);
    return String(AR_DIGITS.indexOf(d));
  });
}

function stripWord(input: string, word: string): string {
  return input.replace(word, " ").replace(/\s+/g, " ").trim();
}

export interface SmartSearchResult {
  params: FilterParams;
  /** Persian labels of the rules that matched, shown as chips. */
  matched: string[];
}

/** Pure keyword matcher — no I/O, no AI call. */
export function parseSmartQuery(input: string): SmartSearchResult {
  let rest = normalizeDigits(input).trim();
  const params: FilterParams = {};
  const matched: string[] = [];

  const priceMatch = rest.match(/(?:زیر|کمتر از|حداکثر|تا)\s*([\d٬,]+)\s*(هزار|میلیون)?/);
  if (priceMatch) {
    const amount = Number(priceMatch[1].replace(/[٬,]/g, ""));
    const multiplier = priceMatch[2] === "میلیون" ? 1_000_000 : 1_000;
    if (Number.isFinite(amount) && amount > 0) {
      params.maxPrice = amount * multiplier;
      matched.push(`زیر ${amount.toLocaleString("fa-IR")} ${priceMatch[2] ?? "هزار"} تومان`);
      rest = stripWord(rest, priceMatch[0]);
      // "تومان" after a price is a unit, not a search term.
      rest = rest.replace(/تومان/g, " ").replace(/\s+/g, " ").trim();
    }
  }

  const rules: { phrases: string[]; label: string; apply: () => void }[] = [
    { phrases: ["بدون گلوتن"], label: "بدون گلوتن", apply: () => { params.glutenFree = true; } },
    { phrases: ["ارگانیک"], label: "ارگانیک", apply: () => { params.organic = true; } },
    { phrases: ["محلی", "بومی"], label: "محلی", apply: () => { params.local = true; } },
    { phrases: ["موجود"], label: "فقط موجود", apply: () => { params.inStock = true; } },
    { phrases: ["ارزان‌ترین", "ارزان"], label: "ارزان‌ترین", apply: () => { params.sort = "cheapest"; } },
    { phrases: ["گران‌ترین", "گران"], label: "گران‌ترین", apply: () => { params.sort = "priciest"; } },
    { phrases: ["پرفروش‌ترین", "پرفروش"], label: "پرفروش‌ترین", apply: () => { params.sort = "bestselling"; } },
    { phrases: ["جدیدترین", "جدید"], label: "جدیدترین", apply: () => { params.sort = "newest"; } },
  ];
  for (const rule of rules) {
    const found = rule.phrases.find((phrase) => rest.includes(phrase));
    if (found) {
      rule.apply();
      matched.push(rule.label);
      rest = stripWord(rest, found);
    }
  }

  if (rest.length > 0) params.q = rest;
  return { params, matched };
}
