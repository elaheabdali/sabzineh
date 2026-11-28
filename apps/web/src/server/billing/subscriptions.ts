import { getCatalogRepository } from "@/features/catalog/repository";
import type { ProductDTO } from "@sabzineh/types";
import { getPaymentPort } from "@/lib/payments/port";
import { getUserStore } from "@/lib/auth/store";
import { getDataStore, type OrderRecord } from "@/server/store";
import { notifyUser } from "@/server/notifications";
import { getVendorRepository } from "@/features/vendor/repository";
import { commissionRateForPlan, getPlanById, type PlanSummary } from "./plans";
import {
  getBillingStore,
  type BoxDeliveryRecord,
  type InvoiceRecord,
  type SubscriptionRecord,
} from "./store";

/**
 * Two-sided subscriptions (Week 6).
 *
 * Buyer box: a customer picks a BOX plan; the first weekly box order
 * is generated immediately (deterministic contents from PUBLISHED
 * products; the plan price is allocated across the contents
 * proportionally to market value, so item prices sum to the plan
 * price) and paid by wallet in full
 * or through the gateway (Mock / Zarinpal sandbox) via the same
 * payment callback as checkout. Later weeks are generated per
 * delivery (generateWeeklyBox, idempotent on the week).
 *
 * Vendor plan: a vendor picks a VENDOR plan (basic / pro). The plan
 * sets the commission rate snapshotted on new orders and the
 * product-count cap. Without an active plan the vendor cannot
 * publish products at all (Phase 2, per the plan document); basic
 * terms (0.12 commission, 20 products) remain only as the fallback
 * for commission/cap lookups on existing data.
 *
 * Payment side effects (finalizePayment / failPaymentByAuthority in
 * server/orders/service.ts) call settleOrderPaymentSideEffects /
 * settleOrderFailureSideEffects here; they are best-effort and never
 * throw, so a billing bookkeeping bug can never fail a payment.
 */

export const DEFAULT_COMMISSION_RATE = 0.12;
export const DEFAULT_PRODUCT_LIMIT = 20;

export class SubscriptionError extends Error {
  constructor(
    public readonly code:
      | "not-found"
      | "invalid-plan"
      | "already-subscribed"
      | "invalid-transition"
      | "insufficient-wallet"
      | "no-address"
      | "empty-box"
      | "forbidden",
  ) {
    super(code);
    this.name = "SubscriptionError";
  }
}

/** FNV-1a hash — deterministic box picks from (subscription, week). */
export function hashString(input: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return Math.abs(hash);
}

const WEEKDAYS: Record<string, number> = {
  sunday: 0,
  monday: 1,
  tuesday: 2,
  wednesday: 3,
  thursday: 4,
  friday: 5,
  saturday: 6,
};

/**
 * Next occurrence of the plan's delivery weekday, at least one day
 * ahead (a same-day delivery is never "next"). Time is start of day.
 *
 * Computed in UTC so the result (and the idempotency key derived
 * from its ISO date) is identical in every timezone — local-time
 * math shifted the date back a day under Asia/Tehran (+03:30).
 */
export function nextDeliveryDate(deliveryDay: string, from: Date = new Date()): Date {
  const wanted = WEEKDAYS[deliveryDay.toLowerCase()] ?? 4; // Thursday default
  const start = new Date(from);
  start.setUTCHours(0, 0, 0, 0);
  let delta = (wanted - start.getUTCDay() + 7) % 7;
  if (delta === 0) delta = 7;
  start.setUTCDate(start.getUTCDate() + delta);
  return start;
}

/**
 * Deterministic pick: `count` products starting at a hash offset,
 * rotating through the id-sorted catalogue. Seed product ids
 * interleave vendors (p001 = v01, p002 = v02, …), so consecutive
 * picks span several vendors. Same (products, count, seed) → same box.
 */
export function pickBoxContents(
  products: ProductDTO[],
  count: number,
  seed: string,
): ProductDTO[] {
  if (products.length === 0 || count <= 0) return [];
  const sorted = [...products].sort((a, b) => a.id.localeCompare(b.id));
  const take = Math.min(count, sorted.length);
  const start = hashString(seed) % sorted.length;
  return Array.from({ length: take }, (_, i) => sorted[(start + i) % sorted.length]);
}

export interface BoxContentsLine {
  productId: string;
  vendorId: string;
  title: string;
  unitPrice: number;
  commissionRate: number;
}

/**
 * Splits `total` across lines proportionally to their market prices.
 * Every line gets floor(total × weight / weightSum); the rounding
 * remainder goes to the largest line, so the parts always sum to
 * exactly `total`. Zero-weight lines get 0 unless all weights are 0,
 * in which case the total is split evenly.
 */
export function allocateBoxPrices(marketPrices: number[], total: number): number[] {
  if (marketPrices.length === 0) return [];
  const weightSum = marketPrices.reduce((a, b) => a + b, 0);
  const weights = weightSum > 0 ? marketPrices : marketPrices.map(() => 1);
  const effectiveSum = weightSum > 0 ? weightSum : marketPrices.length;
  const parts = weights.map((w) => Math.floor((total * w) / effectiveSum));
  const remainder = total - parts.reduce((a, b) => a + b, 0);
  const largest = weights.indexOf(Math.max(...weights));
  parts[largest] += remainder;
  return parts;
}

/** Commission rate for a vendor's active plan (basic terms by default). */
export async function commissionRateForVendor(vendorId: string): Promise<number> {
  const info = await getVendorPlanInfo(vendorId);
  return info ? commissionRateForPlan(info.plan) : DEFAULT_COMMISSION_RATE;
}

/** Product-count cap for a vendor's active plan (basic terms by default). */
export async function vendorProductLimit(vendorId: string): Promise<number> {
  const info = await getVendorPlanInfo(vendorId);
  if (!info) return DEFAULT_PRODUCT_LIMIT;
  const limit = info.plan.features.maxProducts;
  return typeof limit === "number" ? limit : DEFAULT_PRODUCT_LIMIT;
}

export interface VendorPlanInfo {
  plan: PlanSummary;
  subscription: SubscriptionRecord;
}

/** Active vendor plan (null subscription = basic terms by default). */
export async function getVendorPlanInfo(vendorId: string): Promise<VendorPlanInfo | null> {
  const profile = await getVendorRepository().getVendorProfileById(vendorId);
  if (!profile) return null;
  const store = getBillingStore();
  const subscription = await store.getActiveSubscription(profile.userId, "VENDOR");
  if (!subscription) return null;
  const plan = getPlanById(subscription.planId);
  if (!plan) return null;
  return { plan, subscription };
}

export interface SubscriptionDetail {
  subscription: SubscriptionRecord;
  plan: PlanSummary;
  deliveries: BoxDeliveryRecord[];
  invoices: InvoiceRecord[];
}

export async function listMySubscriptions(userId: string): Promise<SubscriptionDetail[]> {
  const store = getBillingStore();
  const subs = await store.listSubscriptionsByUser(userId);
  const details: SubscriptionDetail[] = [];
  for (const subscription of subs) {
    const plan = getPlanById(subscription.planId);
    if (!plan) continue;
    const [deliveries, invoices] = await Promise.all([
      store.listBoxDeliveries(subscription.id),
      store.listInvoicesBySubscription(subscription.id),
    ]);
    details.push({ subscription, plan, deliveries, invoices });
  }
  return details;
}

export async function getSubscriptionDetail(
  userId: string,
  subscriptionId: string,
): Promise<SubscriptionDetail | null> {
  const store = getBillingStore();
  const subscription = await store.getSubscriptionById(subscriptionId);
  if (!subscription || subscription.userId !== userId) return null;
  const plan = getPlanById(subscription.planId);
  if (!plan) return null;
  const [deliveries, invoices] = await Promise.all([
    store.listBoxDeliveries(subscription.id),
    store.listInvoicesBySubscription(subscription.id),
  ]);
  return { subscription, plan, deliveries, invoices };
}

interface GeneratedBox {
  delivery: BoxDeliveryRecord;
  order: OrderRecord;
  invoice: InvoiceRecord;
}

/**
 * Generates one weekly box for an ACTIVE box subscription: the
 * delivery row, the box order (plan price allocated across the
 * contents, so the items sum to the order total) and the invoice.
 * Idempotent per week — a second call
 * for the same week returns the existing rows. Stock is reserved
 * (1 per item); the caller releases it on cancel/failure.
 */
export async function generateWeeklyBox(
  subscription: SubscriptionRecord,
  weekStart: Date,
  opts?: { walletApplied?: number },
): Promise<GeneratedBox> {
  const store = getBillingStore();
  const billing = store;
  const plan = getPlanById(subscription.planId);
  if (!plan || plan.kind !== "BOX") throw new SubscriptionError("invalid-plan");

  const existing = (await billing.listBoxDeliveries(subscription.id)).find(
    (d) => d.weekStart.getTime() === weekStart.getTime(),
  );
  if (existing?.orderId) {
    const [order, invoices] = await Promise.all([
      getDataStore().getOrderById(existing.orderId),
      billing.listInvoicesBySubscription(subscription.id),
    ]);
    if (order) {
      return {
        delivery: existing,
        order,
        invoice:
          invoices[0] ??
          (await billing.createInvoice({ subscriptionId: subscription.id, amount: plan.price })),
      };
    }
  }

  const products = await getCatalogRepository().listAllPublishedProducts();
  const count =
    typeof plan.features.items === "number" ? plan.features.items : 8;
  // Pick from in-stock products only; the candidate pool is 4× the box
  // size so a product that just sold out is skipped for the next
  // candidate instead of failing the whole box.
  const inStock = products.filter((p) => p.stock > 0);
  const candidates = pickBoxContents(
    inStock,
    Math.min(inStock.length, count * 4),
    `${subscription.id}:${weekStart.toISOString()}`,
  );

  const addresses = await getDataStore().listAddresses(subscription.userId);
  const addressId = addresses[0]?.id ?? null;
  if (!addressId) throw new SubscriptionError("no-address");

  // Reserve stock first; every failure below releases it again.
  const repo = getCatalogRepository();
  const contents: ProductDTO[] = [];
  const reserved: string[] = [];
  for (const candidate of candidates) {
    if (contents.length >= count) break;
    try {
      await repo.adjustStock(candidate.id, -1);
      reserved.push(candidate.id);
      contents.push(candidate);
    } catch {
      // Sold out since the list was read — try the next candidate.
    }
  }
  if (contents.length < count) {
    for (const id of reserved) await repo.adjustStock(id, 1).catch(() => undefined);
    throw new SubscriptionError("empty-box");
  }

  try {
    // Phase 2 (box totals bug): the order total is the plan price,
    // but items used to carry their full market prices, so the sum
    // of items (what vendors are owed at payout) could exceed what
    // the customer paid. Allocate the plan price across the items
    // proportionally to market price (floor + remainder on the
    // largest line) so sum(items) === order total === plan price.
    const allocated = allocateBoxPrices(
      contents.map((c) => c.price),
      plan.price,
    );
    const lines: BoxContentsLine[] = [];
    for (const [index, item] of contents.entries()) {
      lines.push({
        productId: item.id,
        vendorId: item.vendorId,
        title: item.title,
        unitPrice: allocated[index],
        commissionRate: await commissionRateForVendor(item.vendorId),
      });
    }
    const idempotencyKey = `box:${subscription.id}:${weekStart.toISOString().slice(0, 10)}`;
    const walletApplied = opts?.walletApplied ?? 0;
    const order = await getDataStore().createOrder({
      userId: subscription.userId,
      items: lines.map((l) => ({
        productId: l.productId,
        vendorId: l.vendorId,
        qty: 1,
        unitPrice: l.unitPrice,
        commissionRate: l.commissionRate,
      })),
      total: plan.price,
      discountId: null,
      discountAmount: 0,
      walletApplied,
      payable: plan.price - walletApplied,
      addressId,
      idempotencyKey,
    });
    const delivery = existing
      ? ((await billing.updateBoxDelivery(existing.id, { orderId: order.id })) ?? existing)
      : await billing.createBoxDelivery({
          subscriptionId: subscription.id,
          weekStart,
          orderId: order.id,
        });
    if (!existing) {
      // Week 7: the subscriber hears that this week's box is ready.
      await notifyUser(subscription.userId, "box-generated", {
        subscriptionId: subscription.id,
        weekStart: weekStart.toISOString(),
      });
    }
    const invoice = await billing.createInvoice({
      subscriptionId: subscription.id,
      amount: plan.price,
    });
    return { delivery, order, invoice };
  } catch (error) {
    for (const id of reserved) await repo.adjustStock(id, 1).catch(() => undefined);
    throw error;
  }
}

export interface SubscribeBoxResult {
  subscription: SubscriptionRecord;
  order: OrderRecord;
  invoice: InvoiceRecord;
  /** Gateway redirect when a payment is still due (null = paid by wallet). */
  paymentUrl: string | null;
  authority: string | null;
}

/**
 * Subscribes a customer to a BOX plan and generates + charges the
 * first weekly box. Wallet pays in full; gateway (Mock / Zarinpal
 * sandbox) leaves the order PENDING until the callback verifies.
 */
export async function subscribeToBox(
  userId: string,
  planId: string,
  payWith: "wallet" | "gateway",
  opts?: { locale?: string },
): Promise<SubscribeBoxResult> {
  const plan = getPlanById(planId);
  if (!plan || plan.kind !== "BOX") throw new SubscriptionError("invalid-plan");
  const store = getBillingStore();
  const existing = await store.getActiveSubscription(userId, "BOX");
  if (existing) throw new SubscriptionError("already-subscribed");
  if (payWith === "wallet") {
    const balance = await getDataStore().getWalletBalance(userId);
    if (balance < plan.price) throw new SubscriptionError("insufficient-wallet");
  }

  const now = new Date();
  const subscription = await store.createSubscription({
    userId,
    planId: plan.id,
    planKind: "BOX",
    status: "ACTIVE",
    currentPeriodEnd: new Date(now.getTime() + plan.periodDays * 24 * 60 * 60 * 1000),
    autoRenew: true,
  });

  let generated: GeneratedBox;
  try {
    const deliveryDay =
      typeof plan.features.deliveryDay === "string" ? plan.features.deliveryDay : "Thursday";
    generated = await generateWeeklyBox(
      subscription,
      nextDeliveryDate(deliveryDay, now),
      payWith === "wallet" ? { walletApplied: plan.price } : undefined,
    );
  } catch (error) {
    // Roll back the subscription when the first box cannot be built
    // (no address, no products) — the customer subscribed to nothing.
    await store.updateSubscription(subscription.id, { status: "CANCELLED" });
    throw error;
  }

  const { order, invoice } = generated;
  const dataStore = getDataStore();

  if (payWith === "wallet") {
    // The wallet debit already happened inside generateWeeklyBox
    // (createOrder debits walletApplied); the order is PAID.
    await dataStore.createPayment({
      orderId: order.id,
      provider: "MOCK",
      authority: null,
      amount: plan.price,
      status: "PAID",
      refId: "WALLET",
    });
    await store.markInvoicePaid(invoice.id, "WALLET");
    return { subscription, order, invoice, paymentUrl: null, authority: null };
  }

  const port = getPaymentPort();
  const provider = port.provider === "zarinpal" ? "ZARINPAL" : "MOCK";
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  let payment: Awaited<ReturnType<typeof port.createPayment>>;
  try {
    payment = await port.createPayment({
      orderId: order.id,
      amount: plan.price,
      description: `Sabzineh box subscription ${subscription.id}`,
      callbackUrl: `${baseUrl}/api/payments/callback`,
      locale: opts?.locale ?? "fa",
    });
  } catch (error) {
    // Phase 1: same orphan rule as checkout — if the gateway cannot
    // create the payment, cancel the box order and the subscription
    // instead of leaving an ACTIVE subscription with a stuck order.
    await dataStore.updateOrderStatus(order.id, "CANCELLED").catch(() => undefined);
    await settleOrderFailureSideEffects(order);
    await store.updateSubscription(subscription.id, { status: "CANCELLED" }).catch(() => undefined);
    throw error;
  }
  await dataStore.createPayment({
    orderId: order.id,
    provider,
    authority: payment.authority,
    amount: plan.price,
    status: "PENDING",
    refId: null,
  });
  return { subscription, order, invoice, paymentUrl: payment.paymentUrl, authority: payment.authority };
}

export interface SubscribeVendorPlanResult {
  subscription: SubscriptionRecord | null;
  paymentUrl: string | null;
  authority: string | null;
}

/**
 * Subscribes a vendor to a VENDOR plan. Wallet activates immediately;
 * gateway creates a plan order and the subscription activates when
 * the payment callback verifies (see settleOrderPaymentSideEffects).
 */
export async function subscribeToVendorPlan(
  userId: string,
  planId: string,
  payWith: "wallet" | "gateway",
  opts?: { locale?: string },
): Promise<SubscribeVendorPlanResult> {
  const plan = getPlanById(planId);
  if (!plan || plan.kind !== "VENDOR") throw new SubscriptionError("invalid-plan");
  const user = await getUserStore().findById(userId);
  if (!user || user.role !== "VENDOR") throw new SubscriptionError("forbidden");
  const store = getBillingStore();
  const existing = await store.getActiveSubscription(userId, "VENDOR");
  if (existing) throw new SubscriptionError("already-subscribed");

  if (payWith === "wallet") {
    const balance = await getDataStore().getWalletBalance(userId);
    if (balance < plan.price) throw new SubscriptionError("insufficient-wallet");
    await getDataStore().applyWalletTransaction(userId, -plan.price, "SUBSCRIPTION", plan.id);
    const subscription = await store.createSubscription({
      userId,
      planId: plan.id,
      planKind: "VENDOR",
      status: "ACTIVE",
      currentPeriodEnd: new Date(Date.now() + plan.periodDays * 24 * 60 * 60 * 1000),
      autoRenew: true,
    });
    return { subscription, paymentUrl: null, authority: null };
  }

  // Gateway: the plan order is the payment anchor (zero items, total
  // = plan price). The subscription is created by the payment
  // callback, keyed by the idempotency key — never before payment.
  const idempotencyKey = `plan:${userId}:${plan.id}:${crypto.randomUUID().slice(0, 8)}`;
  const order = await getDataStore().createOrder({
    userId,
    items: [],
    total: plan.price,
    discountId: null,
    discountAmount: 0,
    walletApplied: 0,
    payable: plan.price,
    addressId: null,
    idempotencyKey,
  });
  const port = getPaymentPort();
  const provider = port.provider === "zarinpal" ? "ZARINPAL" : "MOCK";
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  let payment: Awaited<ReturnType<typeof port.createPayment>>;
  try {
    payment = await port.createPayment({
      orderId: order.id,
      amount: plan.price,
      description: `Sabzineh vendor plan ${plan.title}`,
      callbackUrl: `${baseUrl}/api/payments/callback`,
      locale: opts?.locale ?? "fa",
    });
  } catch (error) {
    // Phase 1: do not orphan the plan order when the gateway fails.
    await getDataStore().updateOrderStatus(order.id, "CANCELLED").catch(() => undefined);
    throw error;
  }
  await getDataStore().createPayment({
    orderId: order.id,
    provider,
    authority: payment.authority,
    amount: plan.price,
    status: "PENDING",
    refId: null,
  });
  return { subscription: null, paymentUrl: payment.paymentUrl, authority: payment.authority };
}

// ---------------------------------------------------------------------------
// Lifecycle transitions — the subscription state machine.
// ---------------------------------------------------------------------------

const TRANSITIONS: Record<string, string[]> = {
  ACTIVE: ["PAUSED", "CANCELLED"],
  PAUSED: ["ACTIVE", "CANCELLED"],
  CANCELLED: [],
  EXPIRED: [],
};

function assertTransition(subscription: SubscriptionRecord, to: "PAUSED" | "ACTIVE" | "CANCELLED"): void {
  const allowed = TRANSITIONS[subscription.status] ?? [];
  if (!allowed.includes(to)) throw new SubscriptionError("invalid-transition");
}

export async function pauseSubscription(
  userId: string,
  subscriptionId: string,
): Promise<SubscriptionRecord> {
  const store = getBillingStore();
  const subscription = await store.getSubscriptionById(subscriptionId);
  if (!subscription || subscription.userId !== userId) throw new SubscriptionError("not-found");
  assertTransition(subscription, "PAUSED");
  const updated = await store.updateSubscription(subscription.id, { status: "PAUSED" });
  if (!updated) throw new SubscriptionError("not-found");
  return updated;
}

export async function resumeSubscription(
  userId: string,
  subscriptionId: string,
): Promise<SubscriptionRecord> {
  const store = getBillingStore();
  const subscription = await store.getSubscriptionById(subscriptionId);
  if (!subscription || subscription.userId !== userId) throw new SubscriptionError("not-found");
  assertTransition(subscription, "ACTIVE");
  const updated = await store.updateSubscription(subscription.id, { status: "ACTIVE" });
  if (!updated) throw new SubscriptionError("not-found");
  return updated;
}

export async function cancelSubscription(
  userId: string,
  subscriptionId: string,
): Promise<SubscriptionRecord> {
  const store = getBillingStore();
  const subscription = await store.getSubscriptionById(subscriptionId);
  if (!subscription || subscription.userId !== userId) throw new SubscriptionError("not-found");
  assertTransition(subscription, "CANCELLED");
  const updated = await store.updateSubscription(subscription.id, { status: "CANCELLED" });
  if (!updated) throw new SubscriptionError("not-found");
  // Future boxes never ship for a cancelled subscription.
  const deliveries = await store.listBoxDeliveries(subscription.id);
  for (const delivery of deliveries) {
    if (delivery.status === "SCHEDULED") {
      await store.updateBoxDelivery(delivery.id, { status: "SKIPPED" });
    }
  }
  return updated;
}

/** Skips the next scheduled delivery of a box subscription. */
export async function skipNextWeek(
  userId: string,
  subscriptionId: string,
): Promise<BoxDeliveryRecord> {
  const store = getBillingStore();
  const subscription = await store.getSubscriptionById(subscriptionId);
  if (!subscription || subscription.userId !== userId) throw new SubscriptionError("not-found");
  if (subscription.status !== "ACTIVE") throw new SubscriptionError("invalid-transition");
  const now = new Date();
  const next = (await store.listBoxDeliveries(subscription.id))
    .filter((d) => d.status === "SCHEDULED" && d.weekStart.getTime() >= now.getTime())
    .sort((a, b) => a.weekStart.getTime() - b.weekStart.getTime())[0];
  if (!next) throw new SubscriptionError("not-found");
  const updated = await store.updateBoxDelivery(next.id, { status: "SKIPPED" });
  if (!updated) throw new SubscriptionError("not-found");
  return updated;
}

// ---------------------------------------------------------------------------
// Payment side effects — called by the order service, never throwing.
// ---------------------------------------------------------------------------

/** After an order is PAID: settle the box invoice / vendor plan it pays for. */
export async function settleOrderPaymentSideEffects(order: OrderRecord): Promise<void> {
  try {
    const store = getBillingStore();
    const key = order.idempotencyKey;
    if (key.startsWith("topup:")) {
      // Phase 2: a verified wallet top-up credits the wallet once.
      // finalizePayment only calls this on the PENDING → PAID
      // transition, so a replayed callback cannot credit twice.
      await getDataStore().applyWalletTransaction(
        order.userId,
        order.total,
        "TOPUP",
        order.id,
      );
      return;
    }
    if (key.startsWith("box:")) {
      const delivery = await store.getBoxDeliveryByOrderId(order.id);
      if (!delivery) return;
      const invoice = await store.getPendingInvoice(delivery.subscriptionId);
      if (!invoice) return;
      const payment = await getDataStore().getPaymentByOrderId(order.id);
      await store.markInvoicePaid(invoice.id, payment?.refId ?? null);
      return;
    }
    if (key.startsWith("plan:")) {
      const [, userId, planId] = key.split(":");
      if (!userId || !planId) return;
      const plan = getPlanById(planId);
      if (!plan || plan.kind !== "VENDOR") return;
      const existing = await store.getActiveSubscription(userId, "VENDOR");
      if (existing) return;
      await store.createSubscription({
        userId,
        planId: plan.id,
        planKind: "VENDOR",
        status: "ACTIVE",
        currentPeriodEnd: new Date(Date.now() + plan.periodDays * 24 * 60 * 60 * 1000),
        autoRenew: true,
      });
    }
  } catch (error) {
    console.error("settleOrderPaymentSideEffects failed", error);
  }
}

/** After a gateway payment fails / is cancelled: the box week is skipped. */
export async function settleOrderFailureSideEffects(order: OrderRecord): Promise<void> {
  try {
    if (!order.idempotencyKey.startsWith("box:")) return;
    const store = getBillingStore();
    const delivery = await store.getBoxDeliveryByOrderId(order.id);
    if (delivery && delivery.status === "SCHEDULED") {
      await store.updateBoxDelivery(delivery.id, { status: "SKIPPED" });
    }
  } catch (error) {
    console.error("settleOrderFailureSideEffects failed", error);
  }
}
