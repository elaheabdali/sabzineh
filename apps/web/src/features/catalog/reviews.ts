import type { ReviewDTO } from "@sabzineh/types";

/**
 * Deterministic demo reviews for the seed storefront.
 *
 * The seed JSON has no reviews table, so reviews are derived from the
 * product id (FNV-1a hash): same product → same reviews, on every
 * render and in every environment. Real reviews come from the Review
 * model once DATABASE_URL is set (Week 6 admin approval queue);
 * the Prisma repository then replaces this module.
 */

const REVIEWERS = [
  "سارا محمدی",
  "امیر رضایی",
  "نگار کریمی",
  "حسین احمدی",
  "مریم موسوی",
  "رضا صادقی",
];

const REVIEW_TEXTS = [
  "تازه و باکیفیت بود؛ بسته‌بندی هم تمیز و بهداشتی رسید.",
  "دقیقاً همان چیزی بود که در عکس دیده بودم. حتماً دوباره می‌خرم.",
  "کیفیت خوبی دارد و ارسال سریع بود. برای مصرف روزانه عالی است.",
  "طعم و تازگی‌اش نسبت به قیمت خیلی خوب بود.",
  "بسته‌بندی بهداشتی و مرتب بود؛ محصول هم تازه رسید.",
];

function fnv1a(input: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

/** 2–3 deterministic reviews per product, rating near the product rating. */
export function getSeedReviews(productId: string, productRating: number): ReviewDTO[] {
  const hash = fnv1a(productId);
  const count = 2 + (hash % 2);
  const reviews: ReviewDTO[] = [];
  for (let i = 0; i < count; i++) {
    const pick = (hash >> (i * 5)) & 0x7fffffff;
    const offset = ((pick % 3) - 1) * 0.3; // -0.3 / 0 / +0.3
    const rating = Math.min(5, Math.max(1, Math.round((productRating + offset) * 10) / 10));
    const day = 3 + (pick % 25);
    reviews.push({
      id: `${productId}-review-${i + 1}`,
      author: REVIEWERS[(hash + i * 2) % REVIEWERS.length],
      rating,
      text: REVIEW_TEXTS[(hash + i * 3) % REVIEW_TEXTS.length],
      createdAt: new Date(Date.UTC(2026, 10, day)).toISOString(),
    });
  }
  return reviews;
}
