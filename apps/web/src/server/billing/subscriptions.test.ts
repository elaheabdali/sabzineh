import { describe, expect, it } from "vitest";
import { registerCustomer } from "@/lib/auth/service";
import { registerVendor } from "@/features/vendor/service";
import { getDataStore } from "@/server/store";
import { getBillingStore } from "./store";
import { finalizePayment } from "@/server/orders/service";
import {
  cancelSubscription,
  commissionRateForVendor,
  generateWeeklyBox,
  getSubscriptionDetail,
  hashString,
  nextDeliveryDate,
  pauseSubscription,
  pickBoxContents,
  resumeSubscription,
  skipNextWeek,
  subscribeToBox,
  subscribeToVendorPlan,
  SubscriptionError,
  vendorProductLimit,
} from "./subscriptions";

function uniqueEmail(prefix: string): string {
  return `${prefix}-${crypto.randomUUID().slice(0, 8)}@sabzineh.ir`;
}

async function makeCustomerWithAddress(walletTopUp = 0) {
  const email = uniqueEmail("boxcust");
  const { user } = await registerCustomer({
    name: "Box Customer",
    email,
    phone: "09123456789",
    password: "secret123",
  });
  const address = await getDataStore().createAddress(user.id, {
    title: "Home",
    city: "Tehran",
    text: "123 Green Street",
    postalCode: "1234567890",
    phone: "09123456789",
  });
  if (walletTopUp > 0) {
    await getDataStore().applyWalletTransaction(user.id, walletTopUp, "TEST_TOPUP", "test");
  }
  return { user, address };
}

async function makeVendor() {
  const email = uniqueEmail("planvendor");
  const { user, vendorId } = await registerVendor({
    name: "Plan Vendor",
    email,
    phone: "09123456789",
    password: "secret123",
    shopName: `Plan Shop ${crypto.randomUUID().slice(0, 8)}`,
    city: "Tehran",
  });
  return { user, vendorId };
}

describe("pickBoxContents / nextDeliveryDate (pure)", () => {
  it("picks deterministically: same seed → same products", async () => {
    const { getCatalogRepository } = await import("@/features/catalog/repository");
    const products = await getCatalogRepository().listAllPublishedProducts();
    expect(products.length).toBeGreaterThan(10);
    const first = pickBoxContents(products, 8, "sub-1:2026-12-03");
    const second = pickBoxContents(products, 8, "sub-1:2026-12-03");
    expect(first.map((p) => p.id)).toEqual(second.map((p) => p.id));
    const other = pickBoxContents(products, 8, "sub-2:2026-12-03");
    expect(other.map((p) => p.id)).not.toEqual(first.map((p) => p.id));
    expect(first).toHaveLength(8);
    expect(new Set(first.map((p) => p.id)).size).toBe(8);
  });

  it("hashes stably and finds the next Thursday", () => {
    expect(hashString("abc")).toBe(hashString("abc"));
    // 2026-11-27 is a Friday; the next Thursday is 2026-12-03.
    const next = nextDeliveryDate("Thursday", new Date("2026-11-27T10:00:00"));
    expect(next.toISOString().slice(0, 10)).toBe("2026-12-03");
  });
});

describe("subscribeToBox (wallet)", () => {
  it("creates the subscription, box order and PAID invoice", async () => {
    const { user } = await makeCustomerWithAddress(1_000_000);
    const result = await subscribeToBox(user.id, "plan-box-weekly", "wallet");
    expect(result.subscription.status).toBe("ACTIVE");
    expect(result.subscription.planKind).toBe("BOX");
    expect(result.order.status).toBe("PAID");
    expect(result.order.total).toBe(890_000);
    expect(result.order.walletApplied).toBe(890_000);
    expect(result.paymentUrl).toBeNull();
    const detail = await getSubscriptionDetail(user.id, result.subscription.id);
    expect(detail?.deliveries).toHaveLength(1);
    expect(detail?.deliveries[0].status).toBe("SCHEDULED");
    expect(detail?.deliveries[0].orderId).toBe(result.order.id);
    expect(detail?.invoices[0].status).toBe("PAID");
    // Box contents: 8 items from real products, each qty 1.
    expect(result.order.items).toHaveLength(8);
    expect(result.order.items.every((i) => i.qty === 1)).toBe(true);
    const wallet = await getDataStore().getWalletBalance(user.id);
    expect(wallet).toBe(110_000);
  });

  it("refuses a second active box subscription and an unfunded wallet", async () => {
    const { user } = await makeCustomerWithAddress(1_000_000);
    await subscribeToBox(user.id, "plan-box-weekly", "wallet");
    await expect(subscribeToBox(user.id, "plan-box-biweekly", "wallet")).rejects.toMatchObject({
      code: "already-subscribed",
    });
    const poor = await makeCustomerWithAddress(0);
    await expect(subscribeToBox(poor.user.id, "plan-box-weekly", "wallet")).rejects.toMatchObject({
      code: "insufficient-wallet",
    });
  });

  it("rolls back the subscription when the customer has no address", async () => {
    const email = uniqueEmail("noaddr");
    const { user } = await registerCustomer({
      name: "No Address",
      email,
      phone: "09123456789",
      password: "secret123",
    });
    await getDataStore().applyWalletTransaction(user.id, 1_000_000, "TEST_TOPUP", "test");
    await expect(subscribeToBox(user.id, "plan-box-weekly", "wallet")).rejects.toMatchObject({
      code: "no-address",
    });
    const subs = await getBillingStore().listSubscriptionsByUser(user.id);
    expect(subs.every((s) => s.status === "CANCELLED")).toBe(true);
  });
});

describe("subscribeToBox (gateway) + payment settle hook", () => {
  it("leaves the order PENDING until the callback verifies, then pays the invoice", async () => {
    const { user } = await makeCustomerWithAddress(0);
    const result = await subscribeToBox(user.id, "plan-box-weekly", "gateway");
    expect(result.paymentUrl).toContain("/payment/mock");
    expect(result.authority).toMatch(/^MOCK-/);
    expect(result.order.status).toBe("PENDING");
    const before = await getSubscriptionDetail(user.id, result.subscription.id);
    expect(before?.invoices[0].status).toBe("PENDING");
    const paid = await finalizePayment(result.authority!);
    expect(paid.status).toBe("PAID");
    const after = await getSubscriptionDetail(user.id, result.subscription.id);
    expect(after?.invoices[0].status).toBe("PAID");
  });
});

describe("subscription lifecycle", () => {
  it("pause → resume → skip week → cancel, with invalid transitions rejected", async () => {
    const { user } = await makeCustomerWithAddress(1_000_000);
    const { subscription } = await subscribeToBox(user.id, "plan-box-weekly", "wallet");
    const paused = await pauseSubscription(user.id, subscription.id);
    expect(paused.status).toBe("PAUSED");
    await expect(pauseSubscription(user.id, subscription.id)).rejects.toMatchObject({
      code: "invalid-transition",
    });
    const resumed = await resumeSubscription(user.id, subscription.id);
    expect(resumed.status).toBe("ACTIVE");
    const skipped = await skipNextWeek(user.id, subscription.id);
    expect(skipped.status).toBe("SKIPPED");
    const cancelled = await cancelSubscription(user.id, subscription.id);
    expect(cancelled.status).toBe("CANCELLED");
    await expect(resumeSubscription(user.id, subscription.id)).rejects.toMatchObject({
      code: "invalid-transition",
    });
  });

  it("a second generateWeeklyBox for the same week returns the same rows", async () => {
    const { user } = await makeCustomerWithAddress(1_000_000);
    const { subscription } = await subscribeToBox(user.id, "plan-box-weekly", "wallet");
    const detail = await getSubscriptionDetail(user.id, subscription.id);
    const delivery = detail!.deliveries[0];
    const again = await generateWeeklyBox(subscription, delivery.weekStart);
    expect(again.delivery.id).toBe(delivery.id);
    expect(again.order.id).toBe(delivery.orderId);
  });

  it("a customer cannot touch another customer's subscription", async () => {
    const { user } = await makeCustomerWithAddress(1_000_000);
    const other = await makeCustomerWithAddress(1_000_000);
    const { subscription } = await subscribeToBox(user.id, "plan-box-weekly", "wallet");
    await expect(pauseSubscription(other.user.id, subscription.id)).rejects.toBeInstanceOf(
      SubscriptionError,
    );
  });
});

describe("vendor plans", () => {
  it("basic plan: 12% commission and a 20-product cap", async () => {
    const { user, vendorId } = await makeVendor();
    await getDataStore().applyWalletTransaction(user.id, 1_000_000, "TEST_TOPUP", "test");
    const result = await subscribeToVendorPlan(user.id, "plan-vendor-basic", "wallet");
    expect(result.subscription?.status).toBe("ACTIVE");
    expect(await commissionRateForVendor(vendorId)).toBe(0.12);
    expect(await vendorProductLimit(vendorId)).toBe(20);
  });

  it("pro plan: 8% commission and a 200-product cap", async () => {
    const { user, vendorId } = await makeVendor();
    await getDataStore().applyWalletTransaction(user.id, 1_000_000, "TEST_TOPUP", "test");
    await subscribeToVendorPlan(user.id, "plan-vendor-pro", "wallet");
    expect(await commissionRateForVendor(vendorId)).toBe(0.08);
    expect(await vendorProductLimit(vendorId)).toBe(200);
  });

  it("defaults to basic terms without a subscription, and rejects a second plan", async () => {
    const { vendorId } = await makeVendor();
    expect(await commissionRateForVendor(vendorId)).toBe(0.12);
    expect(await vendorProductLimit(vendorId)).toBe(20);
    const second = await makeVendor();
    await getDataStore().applyWalletTransaction(second.user.id, 1_000_000, "TEST_TOPUP", "test");
    await subscribeToVendorPlan(second.user.id, "plan-vendor-basic", "wallet");
    await expect(
      subscribeToVendorPlan(second.user.id, "plan-vendor-pro", "wallet"),
    ).rejects.toMatchObject({ code: "already-subscribed" });
  });

  it("gateway plan activates only after the payment verifies", async () => {
    const { user, vendorId } = await makeVendor();
    const result = await subscribeToVendorPlan(user.id, "plan-vendor-basic", "gateway");
    expect(result.paymentUrl).toContain("/payment/mock");
    expect(result.subscription).toBeNull();
    expect(await getBillingStore().getActiveSubscription(user.id, "VENDOR")).toBeNull();
    const paid = await finalizePayment(result.authority!);
    expect(paid.status).toBe("PAID");
    const active = await getBillingStore().getActiveSubscription(user.id, "VENDOR");
    expect(active?.planId).toBe("plan-vendor-basic");
    expect(await commissionRateForVendor(vendorId)).toBe(0.12);
  });

  it("a customer cannot subscribe to a vendor plan", async () => {
    const { user } = await makeCustomerWithAddress(1_000_000);
    await expect(
      subscribeToVendorPlan(user.id, "plan-vendor-basic", "wallet"),
    ).rejects.toMatchObject({ code: "forbidden" });
  });
});
