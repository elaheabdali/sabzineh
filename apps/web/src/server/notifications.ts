/**
 * Notifications (Week 7) — the persisted side of realtime events.
 *
 * Every event a user should see is first stored as a Notification row
 * (Prisma when DATABASE_URL is set, in-memory otherwise — the same
 * adapter switch as orders, keyed only on DATABASE_URL), then published
 * to the in-process event bus for live SSE delivery. If SSE is down,
 * the client polls GET /api/notifications and reads the same rows.
 *
 * Notification types (payload shapes are documented at each call site):
 *   order-status   { orderId, status }            — order moved (incl. PAID)
 *   order-paid     { orderId, total }             — payment verified
 *   box-generated  { subscriptionId, weekStart }  — weekly box created
 *   vendor-approved { vendorId, shopName }         — admin approved the shop
 *   vendor-rejected { vendorId, shopName, reason } — admin rejected the shop
 *   payout-status  { payoutId, status }           — payout APPROVED / PAID
 */

import { publishEvent } from "./events";
import { getDataStore } from "./store";

export const NOTIFICATION_TYPES = [
  "order-status",
  "order-paid",
  "box-generated",
  "vendor-approved",
  "vendor-rejected",
  "payout-status",
] as const;

export type NotificationType = (typeof NOTIFICATION_TYPES)[number];

/**
 * Persist a notification and push it to the user's live stream.
 * Never throws: a notification must not break the flow that caused it
 * (order payment, vendor approval, payout).
 */
export async function notifyUser(
  userId: string,
  type: NotificationType,
  payload: Record<string, unknown>,
): Promise<void> {
  try {
    const store = getDataStore();
    const record = await store.createNotification(userId, type, payload);
    publishEvent(userId, {
      type,
      payload: { ...payload, notificationId: record.id },
      createdAt: record.createdAt.toISOString(),
    });
  } catch {
    // Notifications are best-effort; the caller already succeeded.
  }
}
