import { getDataStore } from "@/server/store";
import { notifyUser } from "@/server/notifications";
import { getVendorRepository } from "@/features/vendor/repository";
import { calcPayout } from "./commission";
import { getBillingStore, type PayoutRecord } from "./store";
import type { SessionUser } from "@sabzineh/types";

/**
 * Payouts (Week 6) — records + status transitions, NOT real bank
 * transfers. The money a vendor is owed comes from DELIVERED order
 * ITEMS belonging to that vendor (order status is single-value per
 * order, so per-item is the only honest split), minus the commission
 * snapshotted on each item at order time.
 *
 * Flow: vendor requests → REQUESTED → admin approves → APPROVED →
 * admin marks paid → PAID. Every admin step is written to the audit
 * log. A vendor+period can only have one open payout.
 */

export class PayoutError extends Error {
  constructor(
    public readonly code:
      | "not-found"
      | "invalid-transition"
      | "already-requested"
      | "nothing-to-pay"
      | "forbidden",
  ) {
    super(code);
    this.name = "PayoutError";
  }
}

export interface PayoutPreview {
  gross: number;
  commission: number;
  net: number;
  itemCount: number;
  orderCount: number;
}

/** What the vendor is owed for DELIVERED items in a period. */
export async function computePayout(
  vendorId: string,
  periodStart: Date,
  periodEnd: Date,
): Promise<PayoutPreview> {
  const rows = await getDataStore().listVendorOrderItems(vendorId);
  // Phase 2 (double-count bug): an item already covered by ANY
  // existing payout of this vendor (REQUESTED, APPROVED or PAID) is
  // never payable again. The old code filtered only by the requested
  // window, so re-requesting with a shifted window paid the same
  // delivered items twice.
  const claimed = await getBillingStore().listPayouts(vendorId);
  const isClaimed = (at: Date) =>
    claimed.some((p) => at >= p.periodStart && at <= p.periodEnd);
  const delivered = rows.filter(
    (r) =>
      r.orderStatus === "DELIVERED" &&
      r.createdAt >= periodStart &&
      r.createdAt <= periodEnd &&
      !isClaimed(r.createdAt),
  );
  const { gross, commission, net } = calcPayout(
    delivered.map((r) => ({ gross: r.gross, commissionRate: r.commissionRate })),
  );
  return {
    gross,
    commission,
    net,
    itemCount: delivered.length,
    orderCount: new Set(delivered.map((r) => r.orderId)).size,
  };
}

/** Vendor claims the payout for a period (one open payout per period). */
export async function requestPayout(
  session: SessionUser,
  periodStart: Date,
  periodEnd: Date,
): Promise<PayoutRecord> {
  if (session.role !== "VENDOR" || !session.vendorId) {
    throw new PayoutError("forbidden");
  }
  const vendorId = session.vendorId;
  const store = getBillingStore();
  // The open-payout check comes first: computePayout already
  // excludes items claimed by an open payout, so a duplicate
  // request for the same period would otherwise surface as
  // nothing-to-pay instead of already-requested.
  const existing = await store.findPayoutByVendorPeriod(vendorId, periodStart, periodEnd);
  if (existing && existing.status !== "PAID") throw new PayoutError("already-requested");
  const preview = await computePayout(vendorId, periodStart, periodEnd);
  if (preview.net <= 0) throw new PayoutError("nothing-to-pay");
  return store.createPayout({
    vendorId,
    periodStart,
    periodEnd,
    gross: preview.gross,
    commission: preview.commission,
    net: preview.net,
  });
}

export async function approvePayout(adminId: string, payoutId: string): Promise<PayoutRecord> {
  const store = getBillingStore();
  const payout = await store.getPayoutById(payoutId);
  if (!payout) throw new PayoutError("not-found");
  if (payout.status !== "REQUESTED") throw new PayoutError("invalid-transition");
  const updated = await store.updatePayoutStatus(payout.id, "APPROVED");
  if (!updated) throw new PayoutError("not-found");
  // Week 7: the vendor hears about the approval live.
  const profile = await getVendorRepository().getVendorProfileById(payout.vendorId);
  if (profile) {
    await notifyUser(profile.userId, "payout-status", {
      payoutId: payout.id,
      status: "APPROVED",
    });
  }
  await store.createAuditLog({
    actorId: adminId,
    action: "payout.approve",
    entity: "Payout",
    entityId: payout.id,
    meta: { vendorId: payout.vendorId, net: payout.net },
  });
  return updated;
}

export async function markPayoutPaid(adminId: string, payoutId: string): Promise<PayoutRecord> {
  const store = getBillingStore();
  const payout = await store.getPayoutById(payoutId);
  if (!payout) throw new PayoutError("not-found");
  if (payout.status !== "APPROVED") throw new PayoutError("invalid-transition");
  const updated = await store.updatePayoutStatus(payout.id, "PAID");
  if (!updated) throw new PayoutError("not-found");
  // Week 7: the vendor hears about the payment live.
  const profile = await getVendorRepository().getVendorProfileById(payout.vendorId);
  if (profile) {
    await notifyUser(profile.userId, "payout-status", {
      payoutId: payout.id,
      status: "PAID",
    });
  }
  await store.createAuditLog({
    actorId: adminId,
    action: "payout.pay",
    entity: "Payout",
    entityId: payout.id,
    meta: { vendorId: payout.vendorId, net: payout.net },
  });
  return updated;
}

export async function listPayoutsForAdmin(): Promise<PayoutRecord[]> {
  return getBillingStore().listPayouts();
}

export async function listPayoutsForVendor(vendorId: string): Promise<PayoutRecord[]> {
  return getBillingStore().listPayouts(vendorId);
}
