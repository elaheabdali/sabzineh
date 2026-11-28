import { describe, expect, it } from "vitest";
import type { OrderRecord } from "@/server/store";
import type { ProductDTO } from "@sabzineh/types";
import { bestSellers, scoreProducts } from "./recommendations";

function product(overrides: Partial<ProductDTO> & { id: string }): ProductDTO {
  return {
    vendorId: "v01",
    categoryId: "honey",
    title: `product ${overrides.id}`,
    slug: `slug-${overrides.id}`,
    description: "",
    price: 100000,
    compareAtPrice: null,
    stock: 10,
    status: "PUBLISHED",
    organic: false,
    glutenFree: false,
    local: false,
    rating: 4,
    ...overrides,
  };
}

function orderWith(productIds: { productId: string; vendorId: string }[]): OrderRecord {
  return {
    id: `order-${Math.random()}`,
    userId: "u-customer",
    status: "PAID",
    total: 100000,
    discountId: null,
    discountAmount: 0,
    walletApplied: 0,
    payable: 100000,
    addressId: null,
    idempotencyKey: `key-${Math.random()}`,
    createdAt: new Date(),
    items: productIds.map((p) => ({
      id: `item-${p.productId}`,
      orderId: "",
      productId: p.productId,
      vendorId: p.vendorId,
      qty: 1,
      unitPrice: 100000,
      commissionRate: 0.1,
    })),
  };
}

describe("scoreProducts", () => {
  it("ranks a repeat vendor's product above a higher-rated stranger", () => {
    const products = [
      product({ id: "p-affinity", vendorId: "v01", categoryId: "honey", rating: 4.0 }),
      product({ id: "p-stranger", vendorId: "v02", categoryId: "rice", rating: 5.0 }),
    ];
    const orders = [orderWith([{ productId: "p-old", vendorId: "v01" }])];
    const ranked = scoreProducts({ products, orders });
    // Stranger: 5.0×2 = 10. Affinity: 4.0×2 + 6 (vendor) = 14.
    expect(ranked[0].product.id).toBe("p-affinity");
    expect(ranked[0].reasons).toContain("vendor-affinity");
    expect(ranked[0].score).toBe(14);
    expect(ranked[1].score).toBe(10);
  });

  it("caps vendor affinity at 12 across many orders", () => {
    const products = [product({ id: "p1", vendorId: "v01", rating: 4.0 })];
    const orders = [
      orderWith([{ productId: "a", vendorId: "v01" }]),
      orderWith([{ productId: "b", vendorId: "v01" }]),
      orderWith([{ productId: "c", vendorId: "v01" }]),
    ];
    const [ranked] = scoreProducts({ products, orders });
    // 4.0×2 + min(3×6, 12) = 8 + 12 = 20.
    expect(ranked.score).toBe(20);
  });

  it("boosts same-vendor bundle completion for cart items", () => {
    const products = [
      product({ id: "p-cart", vendorId: "v01", categoryId: "honey", rating: 4.0 }),
      product({ id: "p-bundle", vendorId: "v01", categoryId: "rice", rating: 4.0 }),
      product({ id: "p-other", vendorId: "v02", categoryId: "rice", rating: 4.0 }),
    ];
    const ranked = scoreProducts({ products, cartProductIds: ["p-cart"] });
    expect(ranked[0].product.id).toBe("p-bundle");
    expect(ranked[0].reasons).toContain("bundle");
    expect(ranked.map((r) => r.product.id)).not.toContain("p-cart");
  });

  it("boosts viewed-but-not-bought products", () => {
    const products = [
      product({ id: "p-viewed", rating: 4.0 }),
      product({ id: "p-plain", rating: 4.2 }),
    ];
    const ranked = scoreProducts({ products, viewedProductIds: ["p-viewed"] });
    // Viewed: 8 + 3 = 11. Plain: 8.4.
    expect(ranked[0].product.id).toBe("p-viewed");
    expect(ranked[0].reasons).toContain("viewed");
  });

  it("excludes out-of-stock products and cart items", () => {
    const products = [
      product({ id: "p-out", stock: 0, rating: 5.0 }),
      product({ id: "p-in", stock: 3, rating: 4.0 }),
    ];
    const ranked = scoreProducts({ products, cartProductIds: ["p-in"] });
    expect(ranked).toHaveLength(0);
  });

  it("is deterministic: same input, same order", () => {
    const products = [
      product({ id: "p1", rating: 4.5 }),
      product({ id: "p2", rating: 4.5 }),
      product({ id: "p3", rating: 4.5 }),
    ];
    const input = { products, orders: [orderWith([{ productId: "x", vendorId: "v01" }])] };
    expect(scoreProducts(input).map((r) => r.product.id)).toEqual(
      scoreProducts(input).map((r) => r.product.id),
    );
  });

  it("falls back to best-sellers for guests", () => {
    const products = [
      product({ id: "p-low", rating: 3.0 }),
      product({ id: "p-top", rating: 4.9 }),
      product({ id: "p-mid", rating: 4.2 }),
    ];
    const ranked = bestSellers(products, 2);
    expect(ranked.map((r) => r.product.id)).toEqual(["p-top", "p-mid"]);
    expect(ranked[0].reasons).toEqual(["bestseller"]);
  });
});
