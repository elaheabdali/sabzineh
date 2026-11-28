"use client";

import { useEffect } from "react";
import { useCartStore } from "@/stores/cart";

/**
 * Rendered on the order page only when the order is PAID: clears the
 * client-side cart exactly once (ela-coffee pattern). A cancelled
 * payment never reaches this page, so the cart stays intact.
 */
export function ClearCartOnPaid() {
  const clear = useCartStore((s) => s.clear);
  useEffect(() => {
    clear();
  }, [clear]);
  return null;
}
