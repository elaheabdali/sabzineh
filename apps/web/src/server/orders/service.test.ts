import { describe, expect, it } from "vitest";
import { getCatalogRepository } from "@/features/catalog/repository";
import { getDataStore } from "@/server/store";
import {
  cancelOrder,
  computeCheckout,
  createOrder,
  failPaymentByAuthority,
  finalizePayment,
  validateDiscountCode,
} from "./service";

const CUSTOMER = "u-customer";
const P001 = "p001"; // v01, 90,000 Toman, stock 33 in seed

async function makeAddress() {
  return getDataStore().createAddress(CUSTOMER, {
    title: "Home",
    city: "Tehran",
    text: "123 Green Street, District 3",
    postalCode: "1234567890",
    phone: "09123456789",
  });
}

async function stockOf(productId: string): Promise<number> {
  const product = await getCatalogRepository().getProductById(productId);
  if (!product) throw new Error(`missing product ${productId}`);
  return product.stock;
}

describe("validateDiscountCode", () => {
  it("accepts WELCOME at the minimum amount", async () => {
    const result = await validateDiscountCode("WELCOME", CUSTOMER, 200_000);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.validation.amount).toBe(50_000);
  });

  it("rejects WELCOME below the minimum amount", async () => {
    const result = await validateDiscountCode("WELCOME", CUSTOMER, 100_000);
    expect(result).toEqual({ ok: false, error: "min-amount" });
  });

  it("rejects an unknown code", async () => {
    const result = await validateDiscountCode("BOGUS", CUSTOMER, 500_000);
    expect(result).toEqual({ ok: false, error: "not-found" });
  });

  it("computes SABZ10 as 10% of the subtotal", async () => {
    const result = await validateDiscountCode("SABZ10", CUSTOMER, 300_000);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.validation.amount).toBe(30_000);
  });
});

describe("computeCheckout wallet arithmetic", () => {
  it("applies the full wallet balance and leaves the rest payable", async () => {
    // Demo-customer wallet: 150,000. Subtotal 180,000 → 150,000 from
    // wallet, 30,000 payable.
    const money = await computeCheckout({
      userId: CUSTOMER,
      items: [{ productId: P001, qty: 2 }],
      useWallet: true,
    });
    expect(money.gross).toBe(180_000);
    expect(money.walletApplied).toBe(150_000);
    expect(money.payable).toBe(30_000);
  });

  it("applies the discount before the wallet", async () => {
    const money = await computeCheckout({
      userId: CUSTOMER,
      items: [{ productId: P001, qty: 2 }],
      discountCode: "WELCOME",
    });
    expect(money.gross).toBe(180_000);
    expect(money.discountAmount).toBe(50_000);
    expect(money.payable).toBe(130_000);
  });
});

describe("createOrder idempotency + stock + wallet", () => {
  it("replays the same idempotency key without a second order or charge", async () => {
    const address = await makeAddress();
    const key = crypto.randomUUID();
    const stockBefore = await stockOf(P001);
    const first = await createOrder(
      CUSTOMER,
      { items: [{ productId: P001, qty: 1 }], addressId: address.id, idempotencyKey: key },
      { locale: "fa" },
    );
    expect(first.created).toBe(true);
    expect(first.order.status).toBe("PENDING");
    expect(first.order.total).toBe(90_000);
    expect(first.paymentUrl).toContain("/payment/mock");
    expect(first.authority).toBeTruthy();

    const second = await createOrder(
      CUSTOMER,
      { items: [{ productId: P001, qty: 1 }], addressId: address.id, idempotencyKey: key },
      { locale: "fa" },
    );
    expect(second.created).toBe(false);
    expect(second.order.id).toBe(first.order.id);
    expect(second.authority).toBe(first.authority);
    // Stock reserved exactly once.
    expect(await stockOf(P001)).toBe(stockBefore - 1);
  });

  it("pays a wallet-covered order immediately with no gateway URL", async () => {
    const address = await makeAddress();
    const balanceBefore = await getDataStore().getWalletBalance(CUSTOMER);
    expect(balanceBefore).toBe(150_000);
    const result = await createOrder(
      CUSTOMER,
      {
        items: [{ productId: P001, qty: 1 }],
        addressId: address.id,
        useWallet: true,
        idempotencyKey: crypto.randomUUID(),
      },
      { locale: "fa" },
    );
    expect(result.order.status).toBe("PAID");
    expect(result.order.walletApplied).toBe(90_000);
    expect(result.order.payable).toBe(0);
    expect(result.paymentUrl).toBeNull();
    expect(await getDataStore().getWalletBalance(CUSTOMER)).toBe(60_000);
  });

  it("cancelling a pending order restores stock", async () => {
    const address = await makeAddress();
    const stockBefore = await stockOf(P001);
    const result = await createOrder(
      CUSTOMER,
      { items: [{ productId: P001, qty: 1 }], addressId: address.id, idempotencyKey: crypto.randomUUID() },
      { locale: "fa" },
    );
    expect(await stockOf(P001)).toBe(stockBefore - 1);
    const cancelled = await cancelOrder(CUSTOMER, result.order.id);
    expect(cancelled.status).toBe("CANCELLED");
    expect(await stockOf(P001)).toBe(stockBefore);
  });

  it("mock payment success finalises the order as PAID", async () => {
    const address = await makeAddress();
    const result = await createOrder(
      CUSTOMER,
      { items: [{ productId: P001, qty: 1 }], addressId: address.id, idempotencyKey: crypto.randomUUID() },
      { locale: "fa" },
    );
    expect(result.authority).toBeTruthy();
    const paid = await finalizePayment(result.authority!);
    expect(paid.status).toBe("PAID");
    const payment = await getDataStore().getPaymentByOrderId(result.order.id);
    expect(payment?.status).toBe("PAID");
    expect(payment?.refId).toBeTruthy();
  });

  it("a failed payment cancels the order, restores stock and refunds the wallet", async () => {
    const address = await makeAddress();
    const stockBefore = await stockOf(P001);
    // Wallet now holds 60,000 (after the wallet-full test): partial
    // wallet use of 60,000 + 30,000 payable via gateway.
    const result = await createOrder(
      CUSTOMER,
      {
        items: [{ productId: P001, qty: 1 }],
        addressId: address.id,
        useWallet: true,
        idempotencyKey: crypto.randomUUID(),
      },
      { locale: "fa" },
    );
    expect(result.order.walletApplied).toBe(60_000);
    expect(result.order.payable).toBe(30_000);
    expect(await getDataStore().getWalletBalance(CUSTOMER)).toBe(0);
    expect(await stockOf(P001)).toBe(stockBefore - 1);

    const failed = await failPaymentByAuthority(result.authority!);
    expect(failed?.status).toBe("CANCELLED");
    expect(await stockOf(P001)).toBe(stockBefore);
    expect(await getDataStore().getWalletBalance(CUSTOMER)).toBe(60_000);
  });
});
