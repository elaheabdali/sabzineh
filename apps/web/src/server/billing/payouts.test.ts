import { describe, expect, it } from "vitest";
import { registerCustomer } from "@/lib/auth/service";
import { getDataStore } from "@/server/store";
import { getBillingStore } from "./store";
import { createOrder } from "@/server/orders/service";
import {
  approvePayout,
  computePayout,
  listPayoutsForAdmin,
  markPayoutPaid,
  requestPayout,
} from "./payouts";

const ADMIN = "u-admin";
const WIDE_START = new Date("2020-01-01");
const WIDE_END = new Date("2100-01-01");

function vendorSession(vendorId: string) {
  return {
    id: `u-${vendorId}`,
    email: `${vendorId}@vendors.sabzineh.ir`,
    name: `Vendor ${vendorId}`,
    role: "VENDOR" as const,
    vendorId,
  };
}

// Products are isolated per vendor so each test's payout math is
// independent (tests share one in-memory store per file).
const P001 = "p001"; // v01, 90,000 Toman in seed
const P026 = "p026"; // v02, 65,000 Toman in seed
const P003 = "p003"; // v03, 135,000 Toman in seed

async function buyAndDeliver(productId: string, qty: number): Promise<string> {
  const email = `payout-${crypto.randomUUID().slice(0, 8)}@sabzineh.ir`;
  const { user } = await registerCustomer({
    name: "Payout Customer",
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
  const { order } = await createOrder(user.id, {
    items: [{ productId, qty }],
    addressId: address.id,
    idempotencyKey: crypto.randomUUID(),
  });
  await getDataStore().updateOrderStatus(order.id, "DELIVERED");
  return order.id;
}

describe("computePayout", () => {
  it("sums DELIVERED items per vendor, minus the snapshotted commission", async () => {
    await buyAndDeliver(P001, 2); // 2 × 90,000 at 12% commission
    const preview = await computePayout("v01", WIDE_START, WIDE_END);
    expect(preview.gross).toBe(180_000);
    expect(preview.commission).toBe(21_600);
    expect(preview.net).toBe(158_400);
    expect(preview.itemCount).toBe(1);
    expect(preview.orderCount).toBe(1);
  });

  it("ignores other vendors", async () => {
    // No delivered orders for v02 yet in this file.
    const preview = await computePayout("v02", WIDE_START, WIDE_END);
    expect(preview).toEqual({ gross: 0, commission: 0, net: 0, itemCount: 0, orderCount: 0 });
  });

  it("ignores delivered items outside the period", async () => {
    await buyAndDeliver(P026, 1);
    const preview = await computePayout("v02", new Date("2020-01-01"), new Date("2020-12-31"));
    expect(preview.net).toBe(0);
  });
});

describe("payout lifecycle", () => {
  it("REQUESTED → APPROVED → PAID, with guards and an audit trail", async () => {
    await buyAndDeliver(P003, 1); // 135,000 at 12% → net 118,800
    const session = vendorSession("v03");
    const requested = await requestPayout(session, WIDE_START, WIDE_END);
    expect(requested.status).toBe("REQUESTED");
    expect(requested.gross).toBe(135_000);
    expect(requested.commission).toBe(16_200);
    expect(requested.net).toBe(118_800);

    await expect(requestPayout(session, WIDE_START, WIDE_END)).rejects.toMatchObject({
      code: "already-requested",
    });

    const approved = await approvePayout(ADMIN, requested.id);
    expect(approved.status).toBe("APPROVED");
    await expect(approvePayout(ADMIN, requested.id)).rejects.toMatchObject({
      code: "invalid-transition",
    });

    const paid = await markPayoutPaid(ADMIN, requested.id);
    expect(paid.status).toBe("PAID");

    const logs = await getBillingStore().listAuditLogs(50);
    const actions = logs.map((l) => l.action);
    expect(actions).toContain("payout.approve");
    expect(actions).toContain("payout.pay");
    const queue = await listPayoutsForAdmin();
    expect(queue.some((p) => p.id === requested.id && p.status === "PAID")).toBe(true);
  });

  it("a paid period cannot be paid twice, and an empty period cannot be requested", async () => {
    const session = vendorSession("v03");
    // Phase 2: this test previously asserted the double-count bug —
    // it expected the already-PAID v03 items to be payable again for
    // the same window. Items covered by an existing payout are now
    // excluded, so the same window has nothing left to pay.
    await expect(requestPayout(session, WIDE_START, WIDE_END)).rejects.toMatchObject({
      code: "nothing-to-pay",
    });
    const preview = await computePayout("v03", WIDE_START, WIDE_END);
    expect(preview.net).toBe(0);
    expect(preview.itemCount).toBe(0);

    await expect(
      requestPayout(session, new Date("2020-01-01"), new Date("2020-12-31")),
    ).rejects.toMatchObject({ code: "nothing-to-pay" });
  });

  it("a shifted window does not resurrect items claimed by an earlier payout", async () => {
    // v01's delivered items were previewed in the computePayout
    // describe but never claimed; claim them, then re-check with a
    // different (overlapping) window.
    const session = vendorSession("v01");
    const claimed = await requestPayout(session, WIDE_START, WIDE_END);
    expect(claimed.net).toBe(158_400);
    const shifted = await computePayout(
      "v01",
      new Date("2019-01-01"),
      new Date("2101-01-01"),
    );
    expect(shifted.net).toBe(0);
    expect(shifted.itemCount).toBe(0);
  });

  it("only vendors can request, and unknown payouts are not found", async () => {
    const customerSession = {
      id: "u-customer",
      email: "customer@sabzineh.ir",
      name: "Customer",
      role: "CUSTOMER" as const,
      vendorId: null,
    };
    await expect(requestPayout(customerSession, WIDE_START, WIDE_END)).rejects.toMatchObject({
      code: "forbidden",
    });
    await expect(approvePayout(ADMIN, "no-such-payout")).rejects.toMatchObject({
      code: "not-found",
    });
  });
});
