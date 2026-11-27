"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { AddToCartButton } from "./AddToCartButton";
import type { Locale } from "@/i18n/routing";

interface ProductPurchaseBoxProps {
  productId: string;
  stock: number;
  locale: Locale;
}

/**
 * Product purchase box: quantity stepper (clamped to stock, max 99)
 * + add-to-cart wired to the Zustand cart. Prices are display-only;
 * the server re-checks price and stock at order creation.
 */
export function ProductPurchaseBox({ productId, stock, locale }: ProductPurchaseBoxProps) {
  const t = useTranslations("product");
  const [qty, setQty] = useState(1);
  const max = Math.max(1, Math.min(99, stock));
  const set = (next: number) => setQty(Math.min(Math.max(next, 1), max));
  const outOfStock = stock === 0;

  return (
    <div className="flex flex-col gap-3" data-testid="purchase-box">
      {outOfStock ? (
        <p className="text-sm font-medium text-red-700" data-testid="stock-state">
          {t("outOfStock")}
        </p>
      ) : stock <= 5 ? (
        <p className="text-sm font-medium text-amber-700" data-testid="stock-state">
          {t("onlyLeft", { count: stock })}
        </p>
      ) : (
        <p className="text-sm text-neutral-500" data-testid="stock-state">
          {t("inStock")} — {t("stock")}: {stock.toLocaleString(locale === "fa" ? "fa-IR" : "en-US")}
        </p>
      )}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2" aria-label={t("quantity")}>
          <button
            type="button"
            onClick={() => set(qty - 1)}
            disabled={outOfStock || qty <= 1}
            data-testid="qty-decrease"
            aria-label={t("decrease")}
            className="size-9 cursor-pointer rounded-lg border border-cream-200 bg-white text-lg text-ink-900 disabled:cursor-not-allowed disabled:text-neutral-300"
          >
            −
          </button>
          <span data-testid="qty-value" aria-live="polite" className="w-8 text-center text-base font-bold text-ink-900">
            {qty.toLocaleString(locale === "fa" ? "fa-IR" : "en-US")}
          </span>
          <button
            type="button"
            onClick={() => set(qty + 1)}
            disabled={outOfStock || qty >= max}
            data-testid="qty-increase"
            aria-label={t("increase")}
            className="size-9 cursor-pointer rounded-lg border border-cream-200 bg-white text-lg text-ink-900 disabled:cursor-not-allowed disabled:text-neutral-300"
          >
            +
          </button>
        </div>
        <div className="w-48">
          <AddToCartButton productId={productId} qty={qty} disabled={outOfStock} />
        </div>
      </div>
    </div>
  );
}
