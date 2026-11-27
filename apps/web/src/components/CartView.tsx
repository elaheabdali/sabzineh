"use client";

import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { useCartStore } from "@/stores/cart";
import { useCartProducts } from "@/hooks/useCartProducts";
import { formatPrice } from "@/lib/format";
import type { Locale } from "@/i18n/routing";

/**
 * Cart view (client) — per-vendor groups, quantity controls capped
 * at stock, remove, subtotal. Totals here are display-only; the
 * server re-computes everything at checkout.
 */
export function CartView({ locale }: { locale: Locale }) {
  const t = useTranslations("cart");
  const tCommon = useTranslations("common");
  const details = useCartProducts();
  const setQty = useCartStore((s) => s.setQty);
  const remove = useCartStore((s) => s.remove);

  if (details === null) {
    return (
      <div className="pt-8" data-testid="cart-page">
        <p className="text-sm text-neutral-600">{tCommon("loading")}</p>
      </div>
    );
  }

  if (details.length === 0) {
    return (
      <div className="flex flex-col items-start gap-4 pt-8" data-testid="cart-page">
        <h1 className="text-2xl font-black text-ink-900">{t("title")}</h1>
        <p className="text-sm text-neutral-600">{t("empty")}</p>
        <p className="text-sm text-neutral-500">{t("emptyHint")}</p>
        <Link
          href="/"
          className="rounded-xl bg-leaf-700 px-4 py-2 text-sm font-bold text-white"
        >
          {t("continueShopping")}
        </Link>
      </div>
    );
  }

  const groups = new Map<string, typeof details>();
  for (const d of details) {
    const key = d.vendor?.shopName ?? d.product.vendorId;
    const list = groups.get(key) ?? [];
    list.push(d);
    groups.set(key, list);
  }
  const total = details.reduce((sum, d) => sum + d.product.price * d.qty, 0);

  return (
    <div className="flex flex-col gap-6 pt-8" data-testid="cart-page">
      <h1 className="text-2xl font-black text-ink-900">{t("title")}</h1>
      {[...groups.entries()].map(([vendorName, items]) => (
        <section
          key={vendorName}
          className="rounded-2xl border border-cream-200 bg-white p-4"
          data-testid="cart-vendor-group"
        >
          <h2 className="mb-3 text-sm font-bold text-ink-900">
            {t("vendor")}: {vendorName}
          </h2>
          <ul className="flex flex-col divide-y divide-cream-100">
            {items.map(({ product, qty }) => (
              <li
                key={product.id}
                className="flex items-center gap-4 py-3"
                data-testid="cart-line"
                data-product-id={product.id}
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-bold text-ink-900" data-testid="cart-line-title">
                    {product.title}
                  </p>
                  <p className="text-xs text-neutral-500">
                    {formatPrice(product.price, locale)} · {t("quantity")}: {qty}
                  </p>
                </div>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    aria-label="decrease"
                    data-testid="cart-qty-decrease"
                    onClick={() => setQty(product.id, qty - 1)}
                    className="cursor-pointer rounded-lg border border-cream-200 px-2 py-1 text-sm"
                  >
                    −
                  </button>
                  <span className="w-8 text-center text-sm font-bold" data-testid="cart-qty">
                    {qty.toLocaleString(locale === "fa" ? "fa-IR" : "en-US")}
                  </span>
                  <button
                    type="button"
                    aria-label="increase"
                    data-testid="cart-qty-increase"
                    disabled={qty >= Math.min(99, product.stock)}
                    onClick={() => setQty(product.id, qty + 1)}
                    className="cursor-pointer rounded-lg border border-cream-200 px-2 py-1 text-sm disabled:opacity-40"
                  >
                    +
                  </button>
                </div>
                <button
                  type="button"
                  data-testid="cart-remove"
                  onClick={() => remove(product.id)}
                  className="cursor-pointer rounded-lg px-2 py-1 text-sm text-red-700 hover:bg-red-50"
                >
                  {t("remove")}
                </button>
              </li>
            ))}
          </ul>
        </section>
      ))}
      <div className="flex items-center justify-between rounded-2xl border border-cream-200 bg-white p-4">
        <span className="text-sm font-bold text-ink-900">{t("subtotal")}</span>
        <span className="text-lg font-black text-ink-900" data-testid="cart-total">
          {formatPrice(total, locale)}
        </span>
      </div>
      <Link
        href="/checkout"
        data-testid="checkout-button"
        className="rounded-xl bg-leaf-700 px-6 py-3 text-center text-sm font-bold text-white"
      >
        {t("checkout")}
      </Link>
    </div>
  );
}
