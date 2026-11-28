import type { FilterParams } from "@sabzineh/types";
import { categories as seedCategories, vendors as seedVendors } from "@/data/seed";

/**
 * AI smart-search (Week 7) — deterministic, dependency-free heuristics.
 *
 * No AI API is called and no network request is made: a natural-language
 * Persian (or English) phrase is turned into the same FilterParams the
 * faceted UI uses, by:
 *
 *   1. synonym expansion — English words and common variants map to the
 *      canonical Persian term the catalog uses ("apple" → "سیب");
 *   2. typo-tolerant matching — a leftover word within a small edit
 *      distance of a known catalog word is corrected and the correction
 *      is reported, never silently hidden;
 *   3. phrase → structured filter rules — price ranges (below / above /
 *      between), minimum rating, attributes, sort, category and vendor
 *      names.
 *
 * Everything left over becomes the text query `q`. The vocabulary is a
 * static curated list (never the whole seed file) so this module stays
 * importable from the client-side search form without dragging the
 * catalog into the browser bundle.
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

/** Persian-aware normalisation for comparisons: ي/ك → ی/ک, آ → ا, ZWNJ removed. */
export function normalizeFa(input: string): string {
  return input
    .replace(/[ي]/g, "ی")
    .replace(/[ك]/g, "ک")
    .replace(/[آ]/g, "ا")
    .replace(/[‌‍]/g, "")
    .toLowerCase()
    .trim();
}

/** Classic Levenshtein edit distance (insert/delete/substitute = 1). */
export function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;
  let prev = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i];
    for (let j = 1; j <= b.length; j++) {
      cur[j] = Math.min(
        prev[j] + 1,
        cur[j - 1] + 1,
        prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1),
      );
    }
    prev = cur;
  }
  return prev[b.length];
}

/** Canonical Persian term → accepted variants (English + Persian forms). */
const SYNONYMS: Record<string, string[]> = {
  "سیب": ["apple", "apples", "سیب‌ها"],
  "گلابی": ["pear", "pears"],
  "پرتقال": ["orange", "oranges"],
  "لیمو": ["lemon", "lemons", "لیموشیرین"],
  "موز": ["banana", "bananas"],
  "انگور": ["grape", "grapes"],
  "هلو": ["peach", "peaches"],
  "آلو": ["plum", "plums"],
  "گیلاس": ["cherry", "cherries"],
  "توت": ["berry", "berries"],
  "عسل": ["honey"],
  "برنج": ["rice"],
  "زعفران": ["saffron"],
  "خرما": ["date", "dates"],
  "گردو": ["walnut", "walnuts"],
  "پسته": ["pistachio", "pistachios"],
  "بادام": ["almond", "almonds"],
  "زیتون": ["olive", "olives"],
  "چای": ["tea"],
  "قهوه": ["coffee"],
  "شیر": ["milk"],
  "ماست": ["yogurt", "yoghurt"],
  "پنیر": ["cheese"],
  "کره": ["butter"],
  "نان": ["bread"],
  "مربا": ["jam"],
  "روغن": ["oil"],
  "گوجه": ["tomato", "tomatoes", "گوجه‌فرنگی"],
  "خیار": ["cucumber", "cucumbers"],
  "سبزی": ["greens", "herb", "herbs"],
  "زردچوبه": ["turmeric"],
  "دارچین": ["cinnamon"],
  "هل": ["cardamom"],
  "فلفل": ["pepper"],
  "نمک": ["salt"],
  "شکر": ["sugar"],
  "آرد": ["flour"],
  "عدس": ["lentil", "lentils"],
  "نخود": ["chickpea", "chickpeas"],
  "لوبیا": ["bean", "beans"],
  "تخم مرغ": ["egg", "eggs"],
  "حبوبات": ["legumes"],
  "میوه": ["fruit", "fruits"],
  "سبزیجات": ["vegetables", "veg"],
  "لبنیات": ["dairy"],
  "خشکبار": ["dried", "nuts"],
  "ارده": ["tahini"],
  "کنجد": ["sesame"],
};

/** Words the typo corrector may correct *to* — catalog terms + synonyms. */
const VOCABULARY: string[] = [
  ...Object.keys(SYNONYMS),
  "ارگانیک",
  "محلی",
  "بومی",
  "گلوتن",
  "تازه",
  "صبحانه",
  "دیابت",
  "رژیمی",
  "خانگی",
  "سنتی",
  "کوهی",
  "دمنوش",
  "عسل",
  "زنجبیل",
  "آویشن",
  "نعناع",
  "ریحان",
  "جعفری",
  "تره",
  "پیاز",
  "سیب‌زمینی",
  "هویج",
  "کدو",
  "بادمجان",
  "کلم",
  "اسفناج",
  "کاهو",
  "انار",
  "کیوی",
  "آناناس",
  "نارگیل",
  "فندق",
  "کشمش",
  "آلوچه",
  "زردآلو",
  "شلیل",
  "طالبی",
  "هندوانه",
  "خربزه",
  "به",
  "خرمالو",
  "ازگیل",
  "سنجد",
  "عناب",
  "زرشک",
  "سماق",
  "گلاب",
  "عرق",
  "سرکه",
  "ترشی",
  "رب",
  "سس",
  "ماکارونی",
  "رشته",
  "بلغور",
  "جو",
  "گندم",
  "ذرت",
  "سویا",
  "کنسرو",
  "کمپوت",
  "آبمیوه",
  "شربت",
  "بستنی",
  "شکلات",
  "بیسکویت",
  "کیک",
  "شیرینی",
  "حلوا",
  "گز",
  "سوهان",
  "نبات",
  "قند",
];

const VOCABULARY_NORM = VOCABULARY.map((w) => normalizeFa(w));

/** Words with no search meaning, dropped from the leftover query. */
const STOP_WORDS = new Set(
  ["با", "و", "برای", "از", "به", "در", "که", "را", "می", "خواهم", "میخواهم", "دارم", "داری", "چی", "چیه", "لطفا", "محصولات", "محصول"].map(normalizeFa),
);

function stripWord(input: string, word: string): string {
  return input.replace(word, " ").replace(/\s+/g, " ").trim();
}

/**
 * Removes the words of `phrase` from `input` by normalized-word
 * comparison, so a ZWNJ difference between what the user typed and
 * the stored name cannot leave the words behind.
 */
function stripPhraseByWords(input: string, phrase: string): string {
  const phraseWords = new Set(phrase.split(/\s+/).filter(Boolean).map(normalizeFa));
  return input
    .split(/\s+/)
    .filter((word) => !phraseWords.has(normalizeFa(word)))
    .join(" ")
    .trim();
}

/** Max edit distance a correction may span: 1 for short words, 2 above. */
export function correctionThreshold(word: string): number {
  return word.length <= 4 ? 1 : 2;
}

/**
 * Closest known word to `word`, or null when nothing is close enough.
 * Exact matches return the word itself (canonical spelling).
 */
export function closestKnownWord(word: string): string | null {
  const norm = normalizeFa(word);
  if (norm.length < 2) return null;
  let best: string | null = null;
  let bestDistance = Number.POSITIVE_INFINITY;
  for (let i = 0; i < VOCABULARY.length; i++) {
    const candidate = VOCABULARY_NORM[i];
    if (candidate === norm) return VOCABULARY[i];
    const distance = levenshtein(norm, candidate);
    if (distance < bestDistance) {
      bestDistance = distance;
      best = VOCABULARY[i];
    }
  }
  if (best !== null && bestDistance <= correctionThreshold(norm)) return best;
  return null;
}

/** Expand English/variant words in `text` to their canonical Persian term. */
export function expandSynonyms(text: string): string {
  let out = text;
  for (const [canonical, variants] of Object.entries(SYNONYMS)) {
    for (const variant of variants) {
      const pattern = new RegExp(`\\b${variant.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "gi");
      if (pattern.test(out)) out = out.replace(pattern, canonical);
    }
  }
  return out;
}

export interface SmartSearchCorrection {
  from: string;
  to: string;
}

export interface SmartSearchResult {
  params: FilterParams;
  /** Persian labels of the rules that matched, shown as chips. */
  matched: string[];
  /** Typo corrections applied to the leftover query, shown to the user. */
  corrected: SmartSearchCorrection[];
  /** One-line Persian summary of what was understood. */
  understood: string;
}

function parsePriceAmount(raw: string): number | null {
  const amount = Number(raw.replace(/[٬,]/g, ""));
  return Number.isFinite(amount) && amount > 0 ? amount : null;
}

/**
 * Pure natural-language → structured filters. No I/O, no AI call —
 * every mapping above is a fixed rule in this file.
 */
export function parseSmartQuery(input: string): SmartSearchResult {
  let rest = normalizeDigits(input).trim();
  const params: FilterParams = {};
  const matched: string[] = [];
  const corrected: SmartSearchCorrection[] = [];

  // --- price range: "بین ۵۰ تا ۱۰۰ هزار تومان" -------------------------
  const betweenMatch = rest.match(/بین\s*([\d٬,]+)\s*تا\s*([\d٬,]+)\s*(هزار|میلیون)?/);
  if (betweenMatch) {
    const min = parsePriceAmount(betweenMatch[1]);
    const max = parsePriceAmount(betweenMatch[2]);
    const multiplier = betweenMatch[3] === "میلیون" ? 1_000_000 : 1_000;
    if (min !== null && max !== null && min < max) {
      params.minPrice = min * multiplier;
      params.maxPrice = max * multiplier;
      matched.push(
        `بین ${min.toLocaleString("fa-IR")} تا ${max.toLocaleString("fa-IR")} ${betweenMatch[3] ?? "هزار"} تومان`,
      );
      rest = stripWord(rest, betweenMatch[0]);
      rest = rest.replace(/تومان/g, " ").replace(/\s+/g, " ").trim();
    }
  }

  // --- price ceiling: "زیر ۱۰۰ هزار تومان" ------------------------------
  const maxMatch = rest.match(/(?:زیر|کمتر از|حداکثر|تا)\s*([\d٬,]+)\s*(هزار|میلیون)?/);
  if (maxMatch && params.maxPrice === undefined) {
    const amount = parsePriceAmount(maxMatch[1]);
    const multiplier = maxMatch[2] === "میلیون" ? 1_000_000 : 1_000;
    if (amount !== null) {
      params.maxPrice = amount * multiplier;
      matched.push(`زیر ${amount.toLocaleString("fa-IR")} ${maxMatch[2] ?? "هزار"} تومان`);
      rest = stripWord(rest, maxMatch[0]);
      rest = rest.replace(/تومان/g, " ").replace(/\s+/g, " ").trim();
    }
  }

  // --- minimum rating: "امتیاز بالای ۴" ---------------------------------
  // Runs BEFORE the price-floor rule: "بالای ۴" without a money unit is
  // a rating, not a price.
  const ratingMatch = rest.match(/(?:امتیاز|رتبه)\s*(?:بالای|حداقل|بیشتر از)?\s*([1-5](?:[./][0-9])?)/);
  if (ratingMatch) {
    const value = Number(ratingMatch[1].replace("/", "."));
    if (Number.isFinite(value) && value >= 1 && value <= 5) {
      params.minRating = value;
      matched.push(`امتیاز بالای ${value.toLocaleString("fa-IR")}`);
      rest = stripWord(rest, ratingMatch[0]);
    }
  }

  // --- price floor: "بالای ۲۰۰ هزار تومان" ------------------------------
  // A bare number after "بالای" is ambiguous (rating vs price), so the
  // floor rule requires an explicit money unit.
  const minMatch = rest.match(/(?:بالای|بیشتر از|حداقل)\s*([\d٬,]+)\s*(هزار|میلیون|تومان)/);
  if (minMatch && params.minPrice === undefined) {
    const amount = parsePriceAmount(minMatch[1]);
    const multiplier = minMatch[2] === "میلیون" ? 1_000_000 : minMatch[2] === "هزار" ? 1_000 : 1;
    if (amount !== null) {
      params.minPrice = amount * multiplier;
      matched.push(
        `بالای ${amount.toLocaleString("fa-IR")} ${minMatch[2] === "تومان" ? "تومان" : `${minMatch[2]} تومان`}`,
      );
      rest = stripWord(rest, minMatch[0]);
      rest = rest.replace(/تومان/g, " ").replace(/\s+/g, " ").trim();
    }
  }

  // --- category by full name ("میوه تازه", "عسل و مربا") ----------------
  // Only multi-word names are matched: a single word like "عسل" is a
  // product term first, and treating it as a category would swallow
  // the search query.
  const normRest = normalizeFa(rest);
  for (const category of seedCategories) {
    const nameFa = normalizeFa(category.nameFa);
    if (nameFa.split(/\s+/).length < 2) continue;
    if (nameFa.length > 0 && normRest.includes(nameFa)) {
      params.category = category.slug;
      matched.push(category.nameFa);
      rest = stripPhraseByWords(rest, category.nameFa);
      break;
    }
  }

  // --- vendor by shop name ("باغ سبز کرج") ------------------------------
  for (const vendor of seedVendors) {
    if (normalizeFa(rest).includes(normalizeFa(vendor.shopName))) {
      params.vendor = vendor.id;
      matched.push(vendor.shopName);
      rest = stripPhraseByWords(rest, vendor.shopName);
      break;
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
    { phrases: ["جدیدترین", "جدید", "تازه‌ترین"], label: "جدیدترین", apply: () => { params.sort = "newest"; } },
  ];
  for (const rule of rules) {
    const found = rule.phrases.find((phrase) => rest.includes(phrase));
    if (found) {
      rule.apply();
      matched.push(rule.label);
      rest = stripWord(rest, found);
    }
  }

  // --- leftover words: synonym expansion, then typo correction ----------
  if (rest.length > 0) {
    const expanded = expandSynonyms(rest);
    const words = expanded.split(/\s+/).filter(Boolean);
    const finalWords: string[] = [];
    for (const rawWord of words) {
      // Strip trailing punctuation ("عسل؟" → "عسل") before any lookup.
      const word = rawWord.replace(/^[؟?!.،,]+|[؟?!.،,]+$/g, "");
      if (word.length === 0) continue;
      // Persian stop words carry no search meaning.
      if (STOP_WORDS.has(normalizeFa(word))) continue;
      const norm = normalizeFa(word);
      if (VOCABULARY_NORM.includes(norm) || word.length < 3) {
        finalWords.push(word);
        continue;
      }
      const close = closestKnownWord(word);
      if (close && normalizeFa(close) !== norm) {
        corrected.push({ from: word, to: close });
        finalWords.push(close);
      } else {
        finalWords.push(word);
      }
    }
    const q = finalWords.join(" ").trim();
    if (q.length > 0) params.q = q;
  }

  const understoodParts = [...matched];
  if (params.q) understoodParts.unshift(`«${params.q}»`);
  const understood =
    understoodParts.length > 0 ? `نتایج برای ${understoodParts.join(" + ")}` : "همه محصولات";

  return { params, matched, corrected, understood };
}
