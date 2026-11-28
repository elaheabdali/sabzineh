import { describe, expect, it, beforeEach } from "vitest";
import { useCartStore } from "./cart";

beforeEach(() => {
  useCartStore.setState({ lines: [] });
});

describe("cart store", () => {
  it("adds a product and counts quantities", () => {
    const store = useCartStore.getState();
    store.add("p001");
    store.add("p001", 2);
    store.add("p002");
    expect(useCartStore.getState().count()).toBe(4);
    expect(useCartStore.getState().lines).toHaveLength(2);
  });

  it("caps quantity at 99", () => {
    useCartStore.getState().add("p001", 150);
    expect(useCartStore.getState().lines[0].qty).toBe(99);
  });

  it("removes a line and clears the cart", () => {
    const store = useCartStore.getState();
    store.add("p001");
    store.add("p002");
    store.remove("p001");
    expect(useCartStore.getState().lines).toHaveLength(1);
    useCartStore.getState().clear();
    expect(useCartStore.getState().lines).toHaveLength(0);
  });

  it("setQty to zero removes the line", () => {
    useCartStore.getState().add("p001", 3);
    useCartStore.getState().setQty("p001", 0);
    expect(useCartStore.getState().lines).toHaveLength(0);
  });

  it("merges guest lines on login without duplicating", () => {
    const store = useCartStore.getState();
    store.add("p001", 2);
    useCartStore.getState().mergeGuestCart([
      { productId: "p001", qty: 3 },
      { productId: "p002", qty: 1 },
    ]);
    const lines = useCartStore.getState().lines;
    expect(lines.find((l) => l.productId === "p001")?.qty).toBe(5);
    expect(lines.find((l) => l.productId === "p002")?.qty).toBe(1);
    expect(useCartStore.getState().count()).toBe(6);
  });

  it("computes the display subtotal from seed prices", () => {
    // p001 is the first seeded product (سیب قرمز ارگانیک, price from seed).
    useCartStore.getState().add("p001", 2);
    expect(useCartStore.getState().subtotal()).toBeGreaterThan(0);
  });
});
