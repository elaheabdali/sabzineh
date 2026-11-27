"use client";

import { useEffect, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { ProductCard } from "./ProductCard";
import { useCartStore } from "@/stores/cart";
import type { ProductDTO } from "@sabzineh/types";
import type { Locale } from "@/i18n/routing";
import type { RecommendationReason } from "@/features/ai/recommendations";

interface RecommendationItem {
  product: ProductDTO;
  score: number;
  reasons: RecommendationReason[];
}

export const VIEWED_STORAGE_KEY = "sabzineh-viewed";

/**
 * Personalised recommendations (Week 7).
 *
 * Fetches GET /api/recommendations with the cart ids (Zustand) and
 * the viewed ids (localStorage, written by <TrackView/> on product
 * pages). The server scores from the customer's order history; guests
 * get best-sellers. Each card carries a "why this" line translated
 * from the scoring reason — the formula lives in
 * features/ai/recommendations.ts and no AI model is involved.
 */
export function RecommendationsSection({ locale }: { locale: Locale }) {
  const t = useTranslations("recommendations");
  // Select the stable `lines` array: mapping to ids inside the selector
  // returns a new array every render and loops the store subscription.
  const lines = useCartStore((s) => s.lines);
  const cartIds = useMemo(() => lines.map((l) => l.productId), [lines]);
  const [items, setItems] = useState<RecommendationItem[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    const viewed: string[] = (() => {
      try {
        return JSON.parse(localStorage.getItem(VIEWED_STORAGE_KEY) ?? "[]") as string[];
      } catch {
        return [];
      }
    })();
    const query = new URLSearchParams();
    if (cartIds.length > 0) query.set("cart", cartIds.join(","));
    if (viewed.length > 0) query.set("viewed", viewed.join(","));
    fetch(`/api/recommendations?${query.toString()}`)
      .then((r) => r.json())
      .then((data: { items: RecommendationItem[] }) => {
        if (!cancelled) setItems(data.items);
      })
      .catch(() => {
        if (!cancelled) setItems([]);
      });
    return () => {
      cancelled = true;
    };
    // Re-fetch when the cart changes; viewed ids are read on mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cartIds.join(",")]);

  if (!items || items.length === 0) return null;

  return (
    <section aria-labelledby="recommendations-title" data-testid="recommendations">
      <h2 id="recommendations-title" className="text-xl font-black text-ink-900">
        {t("title")}
      </h2>
      <div className="mt-4 grid grid-cols-2 gap-4 lg:grid-cols-4">
        {items.map((item) => (
          <div key={item.product.id} className="flex flex-col gap-1">
            <ProductCard product={item.product} locale={locale} />
            <p data-testid="recommendation-reason" className="px-1 text-xs leading-5 text-neutral-500">
              {item.reasons.map((reason) => t(reason)).join("، ")}
            </p>
          </div>
        ))}
      </div>
    </section>
  );
}
