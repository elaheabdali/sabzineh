"use client";

import { useTranslations } from "next-intl";
import { Button } from "@sabzineh/ui";
import { useCartStore } from "@/stores/cart";

interface AddToCartButtonProps {
  productId: string;
  qty?: number;
  disabled?: boolean;
}

/** Adds `qty` units to the Zustand cart (persisted to localStorage). */
export function AddToCartButton({ productId, qty = 1, disabled = false }: AddToCartButtonProps) {
  const t = useTranslations("product");
  const add = useCartStore((state) => state.add);
  return (
    <Button
      size="sm"
      disabled={disabled}
      onClick={() => add(productId, qty)}
      aria-label={disabled ? t("outOfStock") : `${t("addToCart")}`}
    >
      {disabled ? t("outOfStock") : t("addToCart")}
    </Button>
  );
}
