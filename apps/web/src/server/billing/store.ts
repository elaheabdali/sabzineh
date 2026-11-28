import type { PrismaClient, Prisma } from "@prisma/client";
import { getPrismaClient } from "@/lib/prisma";
import { plans as seedPlans } from "@/data/seed";

/**
 * Billing store (Week 6) — one interface, two adapters (same pattern
 * as the catalog repository and the order store). Prisma when
 * DATABASE_URL is set, otherwise an in-memory store.
 *
 * It owns the Week 6 billing entities: subscriptions (buyer box +
 * vendor plan), box deliveries, invoices, payouts and the admin
 * audit log. Money is integer Toman everywhere.
 */

export type SubscriptionStatus = "ACTIVE" | "PAUSED" | "CANCELLED" | "EXPIRED";
export type BoxDeliveryStatus = "SCHEDULED" | "SKIPPED" | "DELIVERED";
export type InvoiceStatus = "PENDING" | "PAID" | "OVERDUE";
export type PayoutStatus = "PENDING" | "REQUESTED" | "APPROVED" | "PAID";

export interface SubscriptionRecord {
  id: string;
  userId: string;
  planId: string;
  planKind: "BOX" | "VENDOR";
  status: SubscriptionStatus;
  currentPeriodEnd: Date;
  autoRenew: boolean;
  createdAt: Date;
}

export interface BoxDeliveryRecord {
  id: string;
  subscriptionId: string;
  weekStart: Date;
  status: BoxDeliveryStatus;
  orderId: string | null;
}

export interface InvoiceRecord {
  id: string;
  subscriptionId: string;
  amount: number;
  status: InvoiceStatus;
  paidAt: Date | null;
  paymentId: string | null;
  createdAt: Date;
}

export interface PayoutRecord {
  id: string;
  vendorId: string;
  periodStart: Date;
  periodEnd: Date;
  gross: number;
  commission: number;
  net: number;
  status: PayoutStatus;
  createdAt: Date;
}

export interface PlanRecord {
  id: string;
  kind: "BOX" | "VENDOR";
  title: string;
  price: number;
  periodDays: number;
  features: Record<string, unknown>;
}

export interface PlanInput {
  kind: "BOX" | "VENDOR";
  title: string;
  price: number;
  periodDays: number;
  features: Record<string, unknown>;
}

export interface AuditLogRecord {
  id: string;
  actorId: string;
  action: string;
  entity: string;
  entityId: string;
  meta: Record<string, unknown> | null;
  createdAt: Date;
}

export interface BillingStore {
  /** Subscription plans (Phase 4: DB-backed, admin-managed). */
  listPlans(): Promise<PlanRecord[]>;
  getPlan(id: string): Promise<PlanRecord | null>;
  createPlan(input: PlanInput): Promise<PlanRecord>;
  updatePlan(id: string, patch: Partial<PlanInput>): Promise<PlanRecord | null>;
  /** False when subscriptions still reference the plan. */
  deletePlan(id: string): Promise<boolean>;

  createSubscription(input: {
    userId: string;
    planId: string;
    planKind: "BOX" | "VENDOR";
    status: SubscriptionStatus;
    currentPeriodEnd: Date;
    autoRenew: boolean;
  }): Promise<SubscriptionRecord>;
  getSubscriptionById(id: string): Promise<SubscriptionRecord | null>;
  listSubscriptionsByUser(userId: string): Promise<SubscriptionRecord[]>;
  getActiveSubscription(
    userId: string,
    kind: "BOX" | "VENDOR",
  ): Promise<SubscriptionRecord | null>;
  updateSubscription(
    id: string,
    patch: { status?: SubscriptionStatus; currentPeriodEnd?: Date; autoRenew?: boolean },
  ): Promise<SubscriptionRecord | null>;

  createBoxDelivery(input: {
    subscriptionId: string;
    weekStart: Date;
    orderId?: string | null;
  }): Promise<BoxDeliveryRecord>;
  listBoxDeliveries(subscriptionId: string): Promise<BoxDeliveryRecord[]>;
  getBoxDeliveryByOrderId(orderId: string): Promise<BoxDeliveryRecord | null>;
  updateBoxDelivery(
    id: string,
    patch: { status?: BoxDeliveryStatus; orderId?: string | null },
  ): Promise<BoxDeliveryRecord | null>;

  createInvoice(input: { subscriptionId: string; amount: number }): Promise<InvoiceRecord>;
  listInvoicesBySubscription(subscriptionId: string): Promise<InvoiceRecord[]>;
  getPendingInvoice(subscriptionId: string): Promise<InvoiceRecord | null>;
  markInvoicePaid(id: string, paymentId?: string | null): Promise<InvoiceRecord | null>;

  createPayout(input: {
    vendorId: string;
    periodStart: Date;
    periodEnd: Date;
    gross: number;
    commission: number;
    net: number;
  }): Promise<PayoutRecord>;
  getPayoutById(id: string): Promise<PayoutRecord | null>;
  listPayouts(vendorId?: string): Promise<PayoutRecord[]>;
  findPayoutByVendorPeriod(
    vendorId: string,
    periodStart: Date,
    periodEnd: Date,
  ): Promise<PayoutRecord | null>;
  updatePayoutStatus(id: string, status: PayoutStatus): Promise<PayoutRecord | null>;

  createAuditLog(input: {
    actorId: string;
    action: string;
    entity: string;
    entityId: string;
    meta?: Record<string, unknown>;
  }): Promise<AuditLogRecord>;
  listAuditLogs(limit?: number): Promise<AuditLogRecord[]>;
}

// ---------------------------------------------------------------------------
// Prisma adapter
// ---------------------------------------------------------------------------

type PrismaSubscriptionWithPlan = {
  id: string;
  userId: string;
  planId: string;
  plan: { kind: "BOX" | "VENDOR" };
  status: SubscriptionStatus;
  currentPeriodEnd: Date;
  autoRenew: boolean;
  createdAt: Date;
};

function toSubscriptionRecord(s: PrismaSubscriptionWithPlan): SubscriptionRecord {
  return {
    id: s.id,
    userId: s.userId,
    planId: s.planId,
    planKind: s.plan.kind,
    status: s.status,
    currentPeriodEnd: s.currentPeriodEnd,
    autoRenew: s.autoRenew,
    createdAt: s.createdAt,
  };
}

const subscriptionWithPlan = { plan: true } as const;

export class PrismaBillingStore implements BillingStore {
  constructor(private readonly prisma: PrismaClient) {}

  async listPlans(): Promise<PlanRecord[]> {
    const rows = await this.prisma.plan.findMany({ orderBy: { createdAt: "asc" } });
    return rows.map((r) => ({
      id: r.id,
      kind: r.kind as "BOX" | "VENDOR",
      title: r.title,
      price: r.price,
      periodDays: r.periodDays,
      features: (r.features ?? {}) as Record<string, unknown>,
    }));
  }

  async getPlan(id: string): Promise<PlanRecord | null> {
    const row = await this.prisma.plan.findUnique({ where: { id } });
    if (!row) return null;
    return {
      id: row.id,
      kind: row.kind as "BOX" | "VENDOR",
      title: row.title,
      price: row.price,
      periodDays: row.periodDays,
      features: (row.features ?? {}) as Record<string, unknown>,
    };
  }

  async createPlan(input: PlanInput): Promise<PlanRecord> {
    const row = await this.prisma.plan.create({
      data: {
        kind: input.kind,
        title: input.title,
        price: input.price,
        periodDays: input.periodDays,
        features: input.features as Prisma.InputJsonValue,
      },
    });
    return {
      id: row.id,
      kind: row.kind as "BOX" | "VENDOR",
      title: row.title,
      price: row.price,
      periodDays: row.periodDays,
      features: (row.features ?? {}) as Record<string, unknown>,
    };
  }

  async updatePlan(id: string, patch: Partial<PlanInput>): Promise<PlanRecord | null> {
    const row = await this.prisma.plan
      .update({
        where: { id },
        data: {
          ...(patch.kind ? { kind: patch.kind } : {}),
          ...(patch.title !== undefined ? { title: patch.title } : {}),
          ...(patch.price !== undefined ? { price: patch.price } : {}),
          ...(patch.periodDays !== undefined ? { periodDays: patch.periodDays } : {}),
          ...(patch.features !== undefined
            ? { features: patch.features as Prisma.InputJsonValue }
            : {}),
        },
      })
      .catch(() => null);
    if (!row) return null;
    return {
      id: row.id,
      kind: row.kind as "BOX" | "VENDOR",
      title: row.title,
      price: row.price,
      periodDays: row.periodDays,
      features: (row.features ?? {}) as Record<string, unknown>,
    };
  }

  async deletePlan(id: string): Promise<boolean> {
    const used = await this.prisma.subscription.count({ where: { planId: id } });
    if (used > 0) return false;
    const deleted = await this.prisma.plan.delete({ where: { id } }).catch(() => null);
    return deleted !== null;
  }

  async createSubscription(input: {
    userId: string;
    planId: string;
    planKind: "BOX" | "VENDOR";
    status: SubscriptionStatus;
    currentPeriodEnd: Date;
    autoRenew: boolean;
  }): Promise<SubscriptionRecord> {
    const row = await this.prisma.subscription.create({
      data: {
        userId: input.userId,
        planId: input.planId,
        status: input.status,
        currentPeriodEnd: input.currentPeriodEnd,
        autoRenew: input.autoRenew,
      },
      include: subscriptionWithPlan,
    });
    return toSubscriptionRecord(row);
  }

  async getSubscriptionById(id: string): Promise<SubscriptionRecord | null> {
    const row = await this.prisma.subscription.findUnique({
      where: { id },
      include: subscriptionWithPlan,
    });
    return row ? toSubscriptionRecord(row) : null;
  }

  async listSubscriptionsByUser(userId: string): Promise<SubscriptionRecord[]> {
    const rows = await this.prisma.subscription.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      include: subscriptionWithPlan,
    });
    return rows.map(toSubscriptionRecord);
  }

  async getActiveSubscription(
    userId: string,
    kind: "BOX" | "VENDOR",
  ): Promise<SubscriptionRecord | null> {
    const row = await this.prisma.subscription.findFirst({
      where: { userId, status: "ACTIVE", plan: { kind } },
      orderBy: { createdAt: "desc" },
      include: subscriptionWithPlan,
    });
    if (!row) return null;
    // Phase 2 (expiry bug): an ACTIVE subscription past its
    // currentPeriodEnd is not active. Expire it lazily on read —
    // previously nothing ever checked the date, so expired vendor
    // plans kept their pro rate and product cap forever.
    if (row.currentPeriodEnd.getTime() <= Date.now()) {
      await this.prisma.subscription
        .update({ where: { id: row.id }, data: { status: "EXPIRED" } })
        .catch(() => undefined);
      return null;
    }
    return toSubscriptionRecord(row);
  }

  async updateSubscription(
    id: string,
    patch: { status?: SubscriptionStatus; currentPeriodEnd?: Date; autoRenew?: boolean },
  ): Promise<SubscriptionRecord | null> {
    const row = await this.prisma.subscription
      .update({ where: { id }, data: patch, include: subscriptionWithPlan })
      .catch(() => null);
    return row ? toSubscriptionRecord(row) : null;
  }

  async createBoxDelivery(input: {
    subscriptionId: string;
    weekStart: Date;
    orderId?: string | null;
  }): Promise<BoxDeliveryRecord> {
    const row = await this.prisma.boxDelivery.create({
      data: {
        subscriptionId: input.subscriptionId,
        weekStart: input.weekStart,
        orderId: input.orderId ?? null,
      },
    });
    return { ...row };
  }

  async listBoxDeliveries(subscriptionId: string): Promise<BoxDeliveryRecord[]> {
    const rows = await this.prisma.boxDelivery.findMany({
      where: { subscriptionId },
      orderBy: { weekStart: "asc" },
    });
    return rows.map((r) => ({ ...r }));
  }

  async getBoxDeliveryByOrderId(orderId: string): Promise<BoxDeliveryRecord | null> {
    const row = await this.prisma.boxDelivery.findFirst({ where: { orderId } });
    return row ? { ...row } : null;
  }

  async updateBoxDelivery(
    id: string,
    patch: { status?: BoxDeliveryStatus; orderId?: string | null },
  ): Promise<BoxDeliveryRecord | null> {
    const row = await this.prisma.boxDelivery
      .update({ where: { id }, data: patch })
      .catch(() => null);
    return row ? { ...row } : null;
  }

  async createInvoice(input: { subscriptionId: string; amount: number }): Promise<InvoiceRecord> {
    const row = await this.prisma.invoice.create({
      data: { subscriptionId: input.subscriptionId, amount: input.amount },
    });
    return { ...row };
  }

  async listInvoicesBySubscription(subscriptionId: string): Promise<InvoiceRecord[]> {
    const rows = await this.prisma.invoice.findMany({
      where: { subscriptionId },
      orderBy: { createdAt: "desc" },
    });
    return rows.map((r) => ({ ...r }));
  }

  async getPendingInvoice(subscriptionId: string): Promise<InvoiceRecord | null> {
    const row = await this.prisma.invoice.findFirst({
      where: { subscriptionId, status: "PENDING" },
      orderBy: { createdAt: "desc" },
    });
    return row ? { ...row } : null;
  }

  async markInvoicePaid(id: string, paymentId?: string | null): Promise<InvoiceRecord | null> {
    const row = await this.prisma.invoice
      .update({
        where: { id },
        data: { status: "PAID", paidAt: new Date(), paymentId: paymentId ?? null },
      })
      .catch(() => null);
    return row ? { ...row } : null;
  }

  async createPayout(input: {
    vendorId: string;
    periodStart: Date;
    periodEnd: Date;
    gross: number;
    commission: number;
    net: number;
  }): Promise<PayoutRecord> {
    const row = await this.prisma.payout.create({ data: { ...input, status: "REQUESTED" } });
    return { ...row };
  }

  async getPayoutById(id: string): Promise<PayoutRecord | null> {
    const row = await this.prisma.payout.findUnique({ where: { id } });
    return row ? { ...row } : null;
  }

  async listPayouts(vendorId?: string): Promise<PayoutRecord[]> {
    const rows = await this.prisma.payout.findMany({
      where: vendorId ? { vendorId } : {},
      orderBy: { createdAt: "desc" },
    });
    return rows.map((r) => ({ ...r }));
  }

  async findPayoutByVendorPeriod(
    vendorId: string,
    periodStart: Date,
    periodEnd: Date,
  ): Promise<PayoutRecord | null> {
    const row = await this.prisma.payout.findFirst({
      where: { vendorId, periodStart, periodEnd },
      orderBy: { createdAt: "desc" },
    });
    return row ? { ...row } : null;
  }

  async updatePayoutStatus(id: string, status: PayoutStatus): Promise<PayoutRecord | null> {
    const row = await this.prisma.payout
      .update({ where: { id }, data: { status } })
      .catch(() => null);
    return row ? { ...row } : null;
  }

  async createAuditLog(input: {
    actorId: string;
    action: string;
    entity: string;
    entityId: string;
    meta?: Record<string, unknown>;
  }): Promise<AuditLogRecord> {
    const row = await this.prisma.auditLog.create({
      data: {
        actorId: input.actorId,
        action: input.action,
        entity: input.entity,
        entityId: input.entityId,
        meta: (input.meta ?? undefined) as Prisma.InputJsonValue | undefined,
      },
    });
    return { ...row, meta: (row.meta as Record<string, unknown> | null) ?? null };
  }

  async listAuditLogs(limit = 50): Promise<AuditLogRecord[]> {
    const rows = await this.prisma.auditLog.findMany({
      orderBy: { createdAt: "desc" },
      take: limit,
    });
    return rows.map((r) => ({ ...r, meta: (r.meta as Record<string, unknown> | null) ?? null }));
  }
}

// ---------------------------------------------------------------------------
// Memory adapter (no database — demo + tests)
// ---------------------------------------------------------------------------

export class MemoryBillingStore implements BillingStore {
  private plans: PlanRecord[] = seedPlans.map((p) => ({
    id: p.id,
    kind: p.kind as "BOX" | "VENDOR",
    title: p.title,
    price: p.price,
    periodDays: p.periodDays,
    features: p.features as Record<string, unknown>,
  }));
  private subscriptions: SubscriptionRecord[] = [];
  private boxDeliveries: BoxDeliveryRecord[] = [];
  private invoices: InvoiceRecord[] = [];
  private payouts: PayoutRecord[] = [];
  private auditLogs: AuditLogRecord[] = [];
  private seeded = false;

  async listPlans(): Promise<PlanRecord[]> {
    return this.plans.map((p) => ({ ...p, features: { ...p.features } }));
  }

  async getPlan(id: string): Promise<PlanRecord | null> {
    const found = this.plans.find((p) => p.id === id);
    return found ? { ...found, features: { ...found.features } } : null;
  }

  async createPlan(input: PlanInput): Promise<PlanRecord> {
    const record: PlanRecord = { id: `plan-${crypto.randomUUID().slice(0, 8)}`, ...input };
    this.plans.push(record);
    return { ...record };
  }

  async updatePlan(id: string, patch: Partial<PlanInput>): Promise<PlanRecord | null> {
    const found = this.plans.find((p) => p.id === id);
    if (!found) return null;
    Object.assign(found, patch);
    return { ...found };
  }

  async deletePlan(id: string): Promise<boolean> {
    if (this.subscriptions.some((s) => s.planId === id)) return false;
    const index = this.plans.findIndex((p) => p.id === id);
    if (index === -1) return false;
    this.plans.splice(index, 1);
    return true;
  }

  /**
   * Mirrors prisma/seed.ts: the demo customer has an ACTIVE weekly
   * box subscription. Seeded lazily so unit tests that construct a
   * fresh store see the same demo state as the app.
   */
  private ensureSeeded(): void {
    if (this.seeded) return;
    this.seeded = true;
    this.subscriptions.push({
      id: "seed-customer-box",
      userId: "u-customer",
      planId: "plan-box-weekly",
      planKind: "BOX",
      status: "ACTIVE",
      currentPeriodEnd: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      autoRenew: true,
      createdAt: new Date(),
    });
    // The demo vendor (u-vendor) is a subscribed seller, mirroring the
    // demo customer's box above: since Phase 2 a vendor without an
    // active subscription cannot publish, and the seeded catalog this
    // vendor "sells" from presupposes one.
    this.subscriptions.push({
      id: "seed-vendor-plan",
      userId: "u-vendor",
      planId: "plan-vendor-basic",
      planKind: "VENDOR",
      status: "ACTIVE",
      currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      autoRenew: true,
      createdAt: new Date(),
    });
  }

  async createSubscription(input: {
    userId: string;
    planId: string;
    planKind: "BOX" | "VENDOR";
    status: SubscriptionStatus;
    currentPeriodEnd: Date;
    autoRenew: boolean;
  }): Promise<SubscriptionRecord> {
    this.ensureSeeded();
    const record: SubscriptionRecord = {
      id: `sub-${crypto.randomUUID()}`,
      ...input,
      createdAt: new Date(),
    };
    this.subscriptions.push(record);
    return { ...record };
  }

  async getSubscriptionById(id: string): Promise<SubscriptionRecord | null> {
    this.ensureSeeded();
    const found = this.subscriptions.find((s) => s.id === id);
    return found ? { ...found } : null;
  }

  async listSubscriptionsByUser(userId: string): Promise<SubscriptionRecord[]> {
    this.ensureSeeded();
    return this.subscriptions
      .filter((s) => s.userId === userId)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
      .map((s) => ({ ...s }));
  }

  async getActiveSubscription(
    userId: string,
    kind: "BOX" | "VENDOR",
  ): Promise<SubscriptionRecord | null> {
    this.ensureSeeded();
    const found = [...this.subscriptions]
      .reverse()
      .find((s) => s.userId === userId && s.planKind === kind && s.status === "ACTIVE");
    if (!found) return null;
    // Phase 2: same lazy expiry as the Prisma adapter.
    if (found.currentPeriodEnd.getTime() <= Date.now()) {
      found.status = "EXPIRED";
      return null;
    }
    return { ...found };
  }

  async updateSubscription(
    id: string,
    patch: { status?: SubscriptionStatus; currentPeriodEnd?: Date; autoRenew?: boolean },
  ): Promise<SubscriptionRecord | null> {
    this.ensureSeeded();
    const found = this.subscriptions.find((s) => s.id === id);
    if (!found) return null;
    Object.assign(found, patch);
    return { ...found };
  }

  async createBoxDelivery(input: {
    subscriptionId: string;
    weekStart: Date;
    orderId?: string | null;
  }): Promise<BoxDeliveryRecord> {
    this.ensureSeeded();
    const record: BoxDeliveryRecord = {
      id: `box-${crypto.randomUUID()}`,
      subscriptionId: input.subscriptionId,
      weekStart: input.weekStart,
      status: "SCHEDULED",
      orderId: input.orderId ?? null,
    };
    this.boxDeliveries.push(record);
    return { ...record };
  }

  async listBoxDeliveries(subscriptionId: string): Promise<BoxDeliveryRecord[]> {
    this.ensureSeeded();
    return this.boxDeliveries
      .filter((b) => b.subscriptionId === subscriptionId)
      .sort((a, b) => a.weekStart.getTime() - b.weekStart.getTime())
      .map((b) => ({ ...b }));
  }

  async getBoxDeliveryByOrderId(orderId: string): Promise<BoxDeliveryRecord | null> {
    this.ensureSeeded();
    const found = this.boxDeliveries.find((b) => b.orderId === orderId);
    return found ? { ...found } : null;
  }

  async updateBoxDelivery(
    id: string,
    patch: { status?: BoxDeliveryStatus; orderId?: string | null },
  ): Promise<BoxDeliveryRecord | null> {
    this.ensureSeeded();
    const found = this.boxDeliveries.find((b) => b.id === id);
    if (!found) return null;
    Object.assign(found, patch);
    return { ...found };
  }

  async createInvoice(input: { subscriptionId: string; amount: number }): Promise<InvoiceRecord> {
    this.ensureSeeded();
    const record: InvoiceRecord = {
      id: `inv-${crypto.randomUUID()}`,
      subscriptionId: input.subscriptionId,
      amount: input.amount,
      status: "PENDING",
      paidAt: null,
      paymentId: null,
      createdAt: new Date(),
    };
    this.invoices.push(record);
    return { ...record };
  }

  async listInvoicesBySubscription(subscriptionId: string): Promise<InvoiceRecord[]> {
    this.ensureSeeded();
    return this.invoices
      .filter((i) => i.subscriptionId === subscriptionId)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
      .map((i) => ({ ...i }));
  }

  async getPendingInvoice(subscriptionId: string): Promise<InvoiceRecord | null> {
    this.ensureSeeded();
    const found = [...this.invoices]
      .reverse()
      .find((i) => i.subscriptionId === subscriptionId && i.status === "PENDING");
    return found ? { ...found } : null;
  }

  async markInvoicePaid(id: string, paymentId?: string | null): Promise<InvoiceRecord | null> {
    this.ensureSeeded();
    const found = this.invoices.find((i) => i.id === id);
    if (!found) return null;
    found.status = "PAID";
    found.paidAt = new Date();
    found.paymentId = paymentId ?? null;
    return { ...found };
  }

  async createPayout(input: {
    vendorId: string;
    periodStart: Date;
    periodEnd: Date;
    gross: number;
    commission: number;
    net: number;
  }): Promise<PayoutRecord> {
    this.ensureSeeded();
    const record: PayoutRecord = {
      id: `payout-${crypto.randomUUID()}`,
      ...input,
      status: "REQUESTED",
      createdAt: new Date(),
    };
    this.payouts.push(record);
    return { ...record };
  }

  async getPayoutById(id: string): Promise<PayoutRecord | null> {
    this.ensureSeeded();
    const found = this.payouts.find((p) => p.id === id);
    return found ? { ...found } : null;
  }

  async listPayouts(vendorId?: string): Promise<PayoutRecord[]> {
    this.ensureSeeded();
    return this.payouts
      .filter((p) => !vendorId || p.vendorId === vendorId)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
      .map((p) => ({ ...p }));
  }

  async findPayoutByVendorPeriod(
    vendorId: string,
    periodStart: Date,
    periodEnd: Date,
  ): Promise<PayoutRecord | null> {
    this.ensureSeeded();
    const found = [...this.payouts]
      .reverse()
      .find(
        (p) =>
          p.vendorId === vendorId &&
          p.periodStart.getTime() === periodStart.getTime() &&
          p.periodEnd.getTime() === periodEnd.getTime(),
      );
    return found ? { ...found } : null;
  }

  async updatePayoutStatus(id: string, status: PayoutStatus): Promise<PayoutRecord | null> {
    this.ensureSeeded();
    const found = this.payouts.find((p) => p.id === id);
    if (!found) return null;
    found.status = status;
    return { ...found };
  }

  async createAuditLog(input: {
    actorId: string;
    action: string;
    entity: string;
    entityId: string;
    meta?: Record<string, unknown>;
  }): Promise<AuditLogRecord> {
    this.ensureSeeded();
    const record: AuditLogRecord = {
      id: `audit-${crypto.randomUUID()}`,
      actorId: input.actorId,
      action: input.action,
      entity: input.entity,
      entityId: input.entityId,
      meta: input.meta ?? null,
      createdAt: new Date(),
    };
    this.auditLogs.push(record);
    return { ...record };
  }

  async listAuditLogs(limit = 50): Promise<AuditLogRecord[]> {
    this.ensureSeeded();
    return [...this.auditLogs]
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
      .slice(0, limit)
      .map((a) => ({ ...a }));
  }
}

// ---------------------------------------------------------------------------
// Factory — the only entry point the app uses
// ---------------------------------------------------------------------------

const globalForBillingStore = globalThis as unknown as { billingStore?: BillingStore };

/** Prisma when DATABASE_URL is set, otherwise the memory adapter. */
export function getBillingStore(): BillingStore {
  const prisma = getPrismaClient();
  if (prisma) return new PrismaBillingStore(prisma);
  globalForBillingStore.billingStore ??= new MemoryBillingStore();
  return globalForBillingStore.billingStore;
}

/** Which adapter is active — shown in README/docs, never a secret. */
export function getBillingDataSource(): "prisma" | "memory" {
  return getPrismaClient() ? "prisma" : "memory";
}
