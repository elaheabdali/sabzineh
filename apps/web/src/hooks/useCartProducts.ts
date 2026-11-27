"use client";

import { useEffect, useState } from "react";
import { useCartStore } from "@/stores/cart";
import type { ProductDTO, VendorDTO } from "@sabzineh/types";

export interface CartLineDetail {
  product: ProductDTO;
  vendor: VendorDTO | null;
  qty: number;
}

/**
 * Resolves the client-side cart lines (ids + qty, localStorage) to
 * product data via the catalog API. Display-only: checkout always
 * re-validates price/stock server-side.
 */
export function useCartProducts(): CartLineDetail[] | null {
  const lines = useCartStore((s) => s.lines);
  const [details, setDetails] = useState<CartLineDetail[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    if (lines.length === 0) return;
    const ids = lines.map((l) => l.productId).join(",");
    fetch(`/api/catalog/products?ids=${encodeURIComponent(ids)}`)
      .then((r) => r.json())
      .then((data: { products: ProductDTO[]; vendors: VendorDTO[] }) => {
        if (cancelled) return;
        const byId = new Map(data.products.map((p) => [p.id, p] as const));
        const vendors = new Map(data.vendors.map((v) => [v.id, v] as const));
        setDetails(
          lines
            .map((l) => {
              const product = byId.get(l.productId);
              if (!product) return null;
              return {
                product,
                vendor: vendors.get(product.vendorId) ?? null,
                qty: l.qty,
              } satisfies CartLineDetail;
            })
            .filter((d): d is CartLineDetail => d !== null),
        );
      })
      .catch(() => {
        if (!cancelled) setDetails([]);
      });
    return () => {
      cancelled = true;
    };
  }, [lines]);

  // Empty cart: derive during render instead of setting state in
  // the effect (react-hooks/set-state-in-effect).
  if (lines.length === 0) return [];
  return details;
}
