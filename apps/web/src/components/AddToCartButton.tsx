"use client";

import { useTranslations } from "next-intl";
import { Button } from "@sabzineh/ui";
import { useCartStore } from "@/stores/cart";

interface AddToCartButtonProps {
  productId: string;
  disabled?: boolean;
}

/** Adds one unit to the Zustand cart (persisted to localStorage). */
export function AddToCartButton({ productId, disabled = false }: AddToCartButtonProps) {
  const t = useTranslations("product");
  const add = useCartStore((state) => state.add);
  return (
    <Button
      size="sm"
      disabled={disabled}
      onClick={() => add(productId, 1)}
      aria-label={disabled ? t("outOfStock") : `${t("addToCart")}`}
    >
      {disabled ? t("outOfStock") : t("addToCart")}
    </Button>
  );
}
