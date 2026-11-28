import { calcDiscount, calcSubtotal, calcWalletApplied } from "@/features/catalog/pricing";
import { getCatalogRepository } from "@/features/catalog/repository";
import { getPaymentPort } from "@/lib/payments/port";
import {
  commissionRateForVendor,
  settleOrderFailureSideEffects,
  settleOrderPaymentSideEffects,
} from "@/server/billing/subscriptions";
import { getDataStore, type DiscountRecord, type OrderRecord } from "@/server/store";
import { notifyUser } from "@/server/notifications";
import type { Money, OrderCreateInput } from "@sabzineh/types";
import { buildOrderPreview, previewItems } from "./create-order";

/**
 * Order service (Week 3) — the only place orders are created.
 *
 * Invariants (all enforced server-side, never from client data):
 * - Prices and stock are re-read from the catalogue at order time.
 * - The same Idempotency-Key always returns the same order (no
 *   double charge, no duplicate wallet debit, no double stock
 *   reservation).
 * - Stock is reserved at order creation and released on cancel /
 *   failed payment. Wallet debit happens once, at creation; a
 *   cancelled order refunds it with a wallet transaction.
 * - Commission is snapshotted per OrderItem from the vendor's plan
 *   rate at order time (0.12 default = vendor-basic plan).
 */

export const DEFAULT_COMMISSION_RATE = 0.12;

export class OrderError extends Error {
  constructor(
    public readonly code:
      | "unknown-product"
      | "insufficient-stock"
      | "invalid-address"
      | "invalid-discount"
      | "insufficient-wallet"
      | "order-not-found"
      | "not-your-order"
      | "not-cancellable",
  ) {
    super(code);
    this.name = "OrderError";
  }
}

export interface DiscountValidation {
  discount: DiscountRecord;
  amount: number;
}

export type DiscountValidationResult =
  | { ok: true; validation: DiscountValidation }
  | { ok: false; error: "not-found" | "expired" | "min-amount" | "usage-limit" | "already-used" };

/**
 * Pure discount rules, split from the store lookup so the rules are
 * unit-testable without a database.
 */
export function validateDiscountRules(
  discount: DiscountRecord,
  opts: { subtotal: number; usedByUser: boolean; now?: Date },
): DiscountValidationResult {
  const now = opts.now ?? new Date();
  if (discount.expiresAt && discount.expiresAt.getTime() <= now.getTime()) {
    return { ok: false, error: "expired" };
  }
  if (discount.usageLimit !== null && discount.usedCount >= discount.usageLimit) {
    return { ok: false, error: "usage-limit" };
  }
  if (opts.usedByUser) return { ok: false, error: "already-used" };
  const amount = calcDiscount(opts.subtotal, discount);
  if (opts.subtotal < discount.minAmount) return { ok: false, error: "min-amount" };
  return { ok: true, validation: { discount, amount } };
}

/** Server-side discount lookup + validation for one user + subtotal. */
export async function validateDiscountCode(
  code: string,
  userId: string,
  subtotal: number,
): Promise<DiscountValidationResult> {
  const store = getDataStore();
  const discount = await store.getDiscountByCode(code.trim().toUpperCase());
  if (!discount) return { ok: false, error: "not-found" };
  const usedByUser = (await store.countDiscountUseByUser(discount.id, userId)) > 0;
  return validateDiscountRules(discount, { subtotal, usedByUser });
}

/** Full money breakdown for a cart: subtotal → discount → wallet → payable. */
export async function computeCheckout(input: {
  userId: string;
  items: { productId: string; qty: number }[];
  discountCode?: string;
  useWallet?: boolean;
}): Promise<Money & { discountId: string | null; discountAmount: number }> {
  const preview = await previewItems(input.items);
  const gross = preview.subtotal;
  let discountAmount = 0;
  let discountId: string | null = null;
  if (input.discountCode) {
    const result = await validateDiscountCode(input.discountCode, input.userId, gross);
    if (!result.ok) throw new OrderError("invalid-discount");
    discountAmount = result.validation.amount;
    discountId = result.validation.discount.id;
  }
  const afterDiscount = Math.max(0, gross - discountAmount);
  const walletBalance = input.useWallet ? await getDataStore().getWalletBalance(input.userId) : 0;
  const { walletApplied, remainingPayable } = calcWalletApplied(afterDiscount, walletBalance);
  return {
    gross,
    discount: discountAmount,
    walletApplied,
    payable: remainingPayable,
    discountId,
    discountAmount,
  };
}

export interface CreateOrderResult {
  order: OrderRecord;
  created: boolean;
  /** Gateway redirect when a payment is still due (null = paid by wallet). */
  paymentUrl: string | null;
  authority: string | null;
}

/**
 * Creates an order from a validated checkout input. Idempotent on
 * `idempotencyKey`: a retry with the same key returns the original
 * order without charging or reserving twice.
 */
export async function createOrder(
  userId: string,
  input: OrderCreateInput,
  opts?: { locale?: string },
): Promise<CreateOrderResult> {
  const store = getDataStore();
  const existing = await store.getOrderByIdempotencyKey(input.idempotencyKey);
  if (existing) {
    const payment = await store.getPaymentByOrderId(existing.id);
    if (payment?.status === "PENDING" && payment.authority && existing.payable > 0) {
      const port = getPaymentPort();
      return {
        order: existing,
        created: false,
        paymentUrl: port.paymentUrlFor(payment.authority, opts?.locale ?? "fa"),
        authority: payment.authority,
      };
    }
    return { order: existing, created: false, paymentUrl: null, authority: payment?.authority ?? null };
  }

  const address = await store.getAddressById(input.addressId);
  if (!address || address.userId !== userId) throw new OrderError("invalid-address");

  const preview = await buildOrderPreview(input);
  const money = await computeCheckout({
    userId,
    items: input.items,
    discountCode: input.discountCode,
    useWallet: input.useWallet,
  });

  // Reserve stock first; every failure below releases it again.
  const repo = getCatalogRepository();
  const reserved: { productId: string; qty: number }[] = [];
  try {
    for (const line of preview.lines) {
      await repo.adjustStock(line.productId, -line.qty);
      reserved.push({ productId: line.productId, qty: line.qty });
    }
  } catch (error) {
    for (const r of reserved) await repo.adjustStock(r.productId, r.qty).catch(() => undefined);
    throw error;
  }

  try {
    // Commission per vendor, from the vendor's active plan at order
    // time (Week 6): pro vendors pay 0.08, everyone else 0.12.
    const rates = new Map<string, number>();
    for (const line of preview.lines) {
      if (!rates.has(line.vendorId)) {
        rates.set(line.vendorId, await commissionRateForVendor(line.vendorId));
      }
    }
    const order = await store.createOrder({
      userId,
      items: preview.lines.map((l) => ({
        productId: l.productId,
        vendorId: l.vendorId,
        qty: l.qty,
        unitPrice: l.unitPrice,
        commissionRate: rates.get(l.vendorId) ?? DEFAULT_COMMISSION_RATE,
      })),
      total: money.gross,
      discountId: money.discountId,
      discountAmount: money.discountAmount,
      walletApplied: money.walletApplied,
      payable: money.payable,
      addressId: input.addressId,
      idempotencyKey: input.idempotencyKey,
    });

    if (money.payable === 0) {
      await store.createPayment({
        orderId: order.id,
        provider: "MOCK",
        authority: null,
        amount: 0,
        status: "PAID",
        refId: "WALLET",
      });
      return { order, created: true, paymentUrl: null, authority: null };
    }

    const port = getPaymentPort();
    const provider = port.provider === "zarinpal" ? "ZARINPAL" : "MOCK";
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
    const payment = await port.createPayment({
      orderId: order.id,
      amount: money.payable,
      description: `Sabzineh order ${order.id}`,
      callbackUrl: `${baseUrl}/api/payments/callback`,
      locale: opts?.locale ?? "fa",
    });
    await store.createPayment({
      orderId: order.id,
      provider,
      authority: payment.authority,
      amount: money.payable,
      status: "PENDING",
      refId: null,
    });
    return { order, created: true, paymentUrl: payment.paymentUrl, authority: payment.authority };
  } catch (error) {
    // Order creation failed after reservation — release the stock.
    for (const r of reserved) await repo.adjustStock(r.productId, r.qty).catch(() => undefined);
    throw error;
  }
}

/**
 * Verifies a gateway payment by authority and settles the order.
 * Safe to call twice: only a PENDING payment transitions.
 */
export async function finalizePayment(authority: string): Promise<OrderRecord> {
  const store = getDataStore();
  const payment = await store.getPaymentByAuthority(authority);
  if (!payment) throw new OrderError("order-not-found");
  const order = await store.getOrderById(payment.orderId);
  if (!order) throw new OrderError("order-not-found");
  if (payment.status !== "PENDING") return order;

  const port = getPaymentPort();
  const result = await port.verify(authority, payment.amount);
  if (result.status === "PAID") {
    await store.updatePayment(payment.id, { status: "PAID", refId: result.refId });
    await store.updateOrderStatus(order.id, "PAID");
    // Box invoice / vendor plan paid by this order (Week 6).
    await settleOrderPaymentSideEffects(order);
    // Week 7: the customer hears about the payment live (SSE + bell).
    await notifyUser(order.userId, "order-paid", { orderId: order.id, total: order.total });
    const updated = await store.getOrderById(order.id);
    return updated ?? order;
  }

  await settleFailedPayment(order.id);
  const updated = await store.getOrderById(order.id);
  return updated ?? order;
}

/** Shared cancel path: release stock + refund the wallet debit. */
async function settleFailedPayment(orderId: string): Promise<void> {
  const store = getDataStore();
  const order = await store.getOrderById(orderId);
  if (!order || order.status !== "PENDING") return;
  const payment = await store.getPaymentByOrderId(orderId);
  if (payment && payment.status === "PENDING") {
    await store.updatePayment(payment.id, { status: "FAILED" });
  }
  await store.updateOrderStatus(orderId, "CANCELLED");
  // Week 7: the customer hears about the cancellation live.
  await notifyUser(order.userId, "order-status", { orderId: order.id, status: "CANCELLED" });
  const repo = getCatalogRepository();
  for (const item of order.items) {
    await repo.adjustStock(item.productId, item.qty).catch(() => undefined);
  }
  if (order.walletApplied > 0) {
    await store
      .applyWalletTransaction(order.userId, order.walletApplied, "ORDER_REFUND", order.id)
      .catch(() => undefined);
  }
  // A failed/cancelled box order skips that week's delivery (Week 6).
  await settleOrderFailureSideEffects(order);
}

/** Customer cancels their own PENDING order (cart stays intact elsewhere). */
export async function cancelOrder(userId: string, orderId: string): Promise<OrderRecord> {
  const store = getDataStore();
  const order = await store.getOrderById(orderId);
  if (!order) throw new OrderError("order-not-found");
  if (order.userId !== userId) throw new OrderError("not-your-order");
  if (order.status !== "PENDING") throw new OrderError("not-cancellable");
  await settleFailedPayment(orderId);
  const updated = await store.getOrderById(orderId);
  return updated ?? order;
}

/**
 * Gateway-side failure (user pressed Cancel on the payment page, or
 * Zarinpal returned Status != OK): the PENDING order is cancelled,
 * stock is released and the wallet debit refunded. No user session
 * is required — the authority token is the credential.
 */
export async function failPaymentByAuthority(authority: string): Promise<OrderRecord | null> {
  const store = getDataStore();
  const payment = await store.getPaymentByAuthority(authority);
  if (!payment) return null;
  await settleFailedPayment(payment.orderId);
  return store.getOrderById(payment.orderId);
}

/**
 * Rebuilds the gateway URL for an interrupted (PENDING) checkout —
 * used by the order page's "continue payment" button. No new payment
 * is created and nothing is charged twice.
 */
export async function resumePayment(
  userId: string,
  orderId: string,
  locale = "fa",
): Promise<{ paymentUrl: string; authority: string } | null> {
  const store = getDataStore();
  const order = await store.getOrderById(orderId);
  if (!order) throw new OrderError("order-not-found");
  if (order.userId !== userId) throw new OrderError("not-your-order");
  if (order.status !== "PENDING" || order.payable <= 0) return null;
  const payment = await store.getPaymentByOrderId(orderId);
  if (!payment || payment.status !== "PENDING" || !payment.authority) return null;
  return {
    paymentUrl: getPaymentPort().paymentUrlFor(payment.authority, locale),
    authority: payment.authority,
  };
}

/** Order detail for its owner; vendors/admins use their own listings. */
export async function getOrderDetail(userId: string, orderId: string): Promise<OrderRecord> {
  const store = getDataStore();
  const order = await store.getOrderById(orderId);
  if (!order) throw new OrderError("order-not-found");
  if (order.userId !== userId) throw new OrderError("not-your-order");
  return order;
}

export async function listMyOrders(userId: string): Promise<OrderRecord[]> {
  return getDataStore().listOrdersByUser(userId);
}

/** Subtotal helper kept for the checkout review step. */
export function cartSubtotal(items: { price: number; qty: number }[]): number {
  return calcSubtotal(items);
}
