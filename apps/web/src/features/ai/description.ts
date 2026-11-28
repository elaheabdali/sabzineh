/**
 * Vendor product description / tag generator (Week 7) — template-based
 * draft helper. NO AI API is called: the description is assembled from
 * the product's own fields (title, category, attributes, price) with
 * fixed Persian/English templates, and the tags come from keyword
 * extraction over the title + category + attributes. The vendor edits
 * the draft before saving; nothing is ever auto-published.
 */

export interface ProductDraftInput {
  title: string;
  categoryName: string;
  vendorName?: string;
  organic?: boolean;
  glutenFree?: boolean;
  local?: boolean;
  price?: number;
  locale?: "fa" | "en";
}

export interface ProductDraft {
  description: string;
  tags: string[];
}

function attributePhrasesFa(input: ProductDraftInput): string[] {
  const phrases: string[] = [];
  if (input.organic) phrases.push("ارگانیک");
  if (input.glutenFree) phrases.push("بدون گلوتن");
  if (input.local) phrases.push("محلی و تازه");
  return phrases;
}

function attributePhrasesEn(input: ProductDraftInput): string[] {
  const phrases: string[] = [];
  if (input.organic) phrases.push("organic");
  if (input.glutenFree) phrases.push("gluten-free");
  if (input.local) phrases.push("local and fresh");
  return phrases;
}

function formatPriceFa(price: number): string {
  return `${price.toLocaleString("fa-IR")} تومان`;
}

/** Build a draft description + tags. Pure: no I/O, no AI call. */
export function generateProductDraft(input: ProductDraftInput): ProductDraft {
  const title = input.title.trim();
  const category = input.categoryName.trim();
  const tags = new Set<string>();

  const words = title.split(/[\s‌]+/).filter((w) => w.length >= 2);
  for (const word of words) tags.add(word);
  for (const word of category.split(/[\s‌]+/).filter((w) => w.length >= 2)) tags.add(word);
  if (input.organic) tags.add("ارگانیک");
  if (input.glutenFree) tags.add("بدون گلوتن");
  if (input.local) tags.add("محلی");
  if (input.vendorName) tags.add(input.vendorName);

  if (input.locale === "en") {
    const attrs = attributePhrasesEn(input);
    const attrPart = attrs.length > 0 ? ` It is ${attrs.join(", ")}.` : "";
    const vendorPart = input.vendorName ? ` From ${input.vendorName}.` : "";
    const pricePart =
      input.price !== undefined ? ` Price: ${input.price.toLocaleString("en-US")} Toman.` : "";
    return {
      description: `${title} — fresh ${category} for your table.${attrPart}${vendorPart} Packed hygienically and shipped promptly.${pricePart}`,
      tags: [...tags].slice(0, 8),
    };
  }

  const attrs = attributePhrasesFa(input);
  const attrPart = attrs.length > 0 ? `؛ ${attrs.join("، ")}` : "";
  const vendorPart = input.vendorName ? ` از ${input.vendorName}` : "";
  const pricePart = input.price !== undefined ? ` قیمت: ${formatPriceFa(input.price)}.` : "";
  return {
    description: `${title} تازه و باکیفیت از دسته ${category}${attrPart}${vendorPart}؛ برداشت روز، بدون افزودنی و با بسته‌بندی بهداشتی ارسال می‌شود.${pricePart}`,
    tags: [...tags].slice(0, 8),
  };
}
