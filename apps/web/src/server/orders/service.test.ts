import { describe, expect, it } from "vitest";
import { registerCustomer } from "@/lib/auth/service";
import { getCatalogRepository } from "@/features/catalog/repository";
import { getDataStore } from "@/server/store";
import {
  cancelOrder,
  computeCheckout,
  createOrder,
  createWalletTopUp,
  failPaymentByAuthority,
  finalizePayment,
  OrderError,
  refundOrder,
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

describe("Phase 1 — idempotency ownership + gateway-failure compensation", () => {
  it("rejects an idempotency replay from a different user", async () => {
    const address = await makeAddress();
    const key = crypto.randomUUID();
    const first = await createOrder(
      CUSTOMER,
      { items: [{ productId: P001, qty: 1 }], addressId: address.id, idempotencyKey: key },
      { locale: "fa" },
    );
    expect(first.created).toBe(true);
    await expect(
      createOrder(
        "u-admin",
        { items: [{ productId: P001, qty: 1 }], addressId: address.id, idempotencyKey: key },
        { locale: "fa" },
      ),
    ).rejects.toEqual(new OrderError("not-your-order"));
  });

  it("refunds the wallet, restores stock and un-burns the discount when gateway creation fails", async () => {
    const address = await makeAddress();
    const key = crypto.randomUUID();
    const balanceBefore = await getDataStore().getWalletBalance(CUSTOMER);
    const stockBefore = await stockOf(P001);
    const discountBefore = await getDataStore().getDiscountByCode("SABZ10");
    const prevProvider = process.env.PAYMENT_PROVIDER;
    const prevMerchant = process.env.ZARINPAL_MERCHANT_ID;
    // Zarinpal selected but not configured → getPaymentPort() throws
    // AFTER store.createOrder has committed (wallet debited, discount
    // consumed). The order must be compensated, not orphaned.
    process.env.PAYMENT_PROVIDER = "zarinpal";
    delete process.env.ZARINPAL_MERCHANT_ID;
    try {
      await expect(
        createOrder(
          CUSTOMER,
          {
            // qty 3 → 270,000 gross, above SABZ10's 200,000 minimum.
            items: [{ productId: P001, qty: 3 }],
            addressId: address.id,
            useWallet: true,
            discountCode: "SABZ10",
            idempotencyKey: key,
          },
          { locale: "fa" },
        ),
      ).rejects.toThrow();
    } finally {
      if (prevProvider === undefined) delete process.env.PAYMENT_PROVIDER;
      else process.env.PAYMENT_PROVIDER = prevProvider;
      if (prevMerchant === undefined) delete process.env.ZARINPAL_MERCHANT_ID;
      else process.env.ZARINPAL_MERCHANT_ID = prevMerchant;
    }
    const orphan = await getDataStore().getOrderByIdempotencyKey(key);
    expect(orphan?.status).toBe("CANCELLED");
    expect(await getDataStore().getWalletBalance(CUSTOMER)).toBe(balanceBefore);
    expect(await stockOf(P001)).toBe(stockBefore);
    const discountAfter = await getDataStore().getDiscountByCode("SABZ10");
    expect(discountAfter?.usedCount).toBe(discountBefore?.usedCount);
    const revalidated = await validateDiscountCode("SABZ10", CUSTOMER, 300_000);
    expect(revalidated.ok).toBe(true);
  });
});

describe("Phase 2 — wallet top-up + PAID refund", () => {
  it("a verified top-up credits the wallet exactly once", async () => {
    const before = await getDataStore().getWalletBalance(CUSTOMER);
    const topUp = await createWalletTopUp(CUSTOMER, 50_000);
    expect(topUp.paymentUrl).toContain("/payment/mock");
    // Not credited before the gateway verifies.
    expect(await getDataStore().getWalletBalance(CUSTOMER)).toBe(before);
    const order = await finalizePayment(topUp.authority);
    expect(order.status).toBe("PAID");
    expect(await getDataStore().getWalletBalance(CUSTOMER)).toBe(before + 50_000);
    // Replaying the callback does not credit twice.
    await finalizePayment(topUp.authority);
    expect(await getDataStore().getWalletBalance(CUSTOMER)).toBe(before + 50_000);
  });

  it("rejects invalid top-up amounts", async () => {
    await expect(createWalletTopUp(CUSTOMER, 0)).rejects.toMatchObject({ code: "invalid-topup" });
    await expect(createWalletTopUp(CUSTOMER, -5)).rejects.toMatchObject({ code: "invalid-topup" });
    await expect(createWalletTopUp(CUSTOMER, 10_000_001)).rejects.toMatchObject({
      code: "invalid-topup",
    });
  });

  it("refunding a PAID order credits wallet + gateway parts and restores stock", async () => {
    const stockBefore = await stockOf(P001);
    // A fresh customer with a small wallet, so the 90,000 order
    // splits into a wallet part and a gateway part.
    const email = `refund-${crypto.randomUUID().slice(0, 8)}@sabzineh.ir`;
    const { user } = await registerCustomer({
      name: "Refund Customer",
      email,
      phone: "09123456789",
      password: "secret123",
    });
    const addr = await getDataStore().createAddress(user.id, {
      title: "Home",
      city: "Tehran",
      text: "123 Green Street",
      postalCode: "1234567890",
      phone: "09123456789",
    });
    await getDataStore().applyWalletTransaction(user.id, 30_000, "TEST_TOPUP", "test");
    const { order, authority } = await createOrder(
      user.id,
      {
        items: [{ productId: P001, qty: 1 }],
        addressId: addr.id,
        useWallet: true,
        idempotencyKey: crypto.randomUUID(),
      },
      { locale: "fa" },
    );
    expect(order.walletApplied).toBe(30_000);
    expect(order.payable).toBe(60_000);
    await finalizePayment(authority!);
    expect((await getDataStore().getOrderById(order.id))?.status).toBe("PAID");
    expect(await getDataStore().getWalletBalance(user.id)).toBe(0);

    const refunded = await refundOrder(order.id);
    expect(refunded.status).toBe("REFUNDED");
    // Both parts come back to the wallet: 30,000 wallet + 60,000 gateway.
    expect(await getDataStore().getWalletBalance(user.id)).toBe(90_000);
    expect(await stockOf(P001)).toBe(stockBefore);
    // A second refund is rejected.
    await expect(refundOrder(order.id)).rejects.toMatchObject({ code: "not-refundable" });
  });
});
