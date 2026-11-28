import type { Prisma, PrismaClient } from "@prisma/client";
import type { Role } from "@sabzineh/types";
import { getPrismaClient } from "@/lib/prisma";
import { getUserStore } from "@/lib/auth/store";
import { discounts as seedDiscounts } from "@/data/seed";

/**
 * Order data store — one interface, two adapters (same pattern as the
 * catalog repository and the auth stores). Prisma when DATABASE_URL is
 * set, otherwise an in-memory store seeded from seed.json.
 *
 * Money is integer Toman everywhere. The store only persists what the
 * order service computed — it never trusts client-supplied totals.
 */

export type OrderStatus = "PENDING" | "PAID" | "PREPARING" | "SHIPPED" | "DELIVERED" | "CANCELLED" | "REFUNDED";
export type PaymentStatus = "PENDING" | "PAID" | "FAILED" | "REFUNDED";

export interface AddressRecord {
  id: string;
  userId: string;
  title: string;
  city: string;
  text: string;
  postalCode: string;
  phone: string;
}

export interface DiscountRecord {
  id: string;
  code: string;
  type: "PERCENT" | "FIXED";
  value: number;
  minAmount: number;
  usageLimit: number | null;
  usedCount: number;
  expiresAt: Date | null;
}

export interface OrderItemRecord {
  id: string;
  orderId: string;
  productId: string;
  vendorId: string;
  qty: number;
  unitPrice: number;
  commissionRate: number;
}

export interface OrderRecord {
  id: string;
  userId: string;
  status: OrderStatus;
  total: number;
  discountId: string | null;
  discountAmount: number;
  walletApplied: number;
  payable: number;
  addressId: string | null;
  idempotencyKey: string;
  createdAt: Date;
  items: OrderItemRecord[];
}

export interface PaymentRecord {
  id: string;
  orderId: string;
  provider: "MOCK" | "ZARINPAL";
  authority: string | null;
  amount: number;
  status: PaymentStatus;
  refId: string | null;
}

export interface VendorOrderItemRow {
  orderId: string;
  orderStatus: OrderStatus;
  createdAt: Date;
  productId: string;
  title: string;
  qty: number;
  unitPrice: number;
  commissionRate: number;
  gross: number;
}

export interface AdminStats {
  totalUsers: number;
  totalOrders: number;
  totalRevenue: number;
  pendingVendors: number;
}

export interface OrderFilters {
  status?: OrderStatus;
  vendorId?: string;
  from?: Date;
  to?: Date;
}

export interface DiscountInput {
  code: string;
  type: "PERCENT" | "FIXED";
  value: number;
  minAmount: number;
  usageLimit: number | null;
  expiresAt: Date | null;
}

export interface CreateOrderInput {
  userId: string;
  items: { productId: string; vendorId: string; qty: number; unitPrice: number; commissionRate: number }[];
  total: number;
  discountId: string | null;
  discountAmount: number;
  walletApplied: number;
  payable: number;
  /** Null for box/plan orders (Week 6): they ship to the default address on file, not a checkout address. */
  addressId: string | null;
  idempotencyKey: string;
}

export interface UserSummary {
  id: string;
  email: string;
  name: string;
  role: Role;
  status: "ACTIVE" | "SUSPENDED";
  vendorId: string | null;
}

export interface NotificationRecord {
  id: string;
  userId: string;
  type: string;
  payload: Record<string, unknown>;
  readAt: Date | null;
  createdAt: Date;
}

export interface DataStore {
  listAddresses(userId: string): Promise<AddressRecord[]>;
  createAddress(
    userId: string,
    input: { title: string; city: string; text: string; postalCode: string; phone: string },
  ): Promise<AddressRecord>;
  getAddressById(id: string): Promise<AddressRecord | null>;
  getDiscountByCode(code: string): Promise<DiscountRecord | null>;
  countDiscountUseByUser(discountId: string, userId: string): Promise<number>;
  incrementDiscountUsed(discountId: string): Promise<void>;
  /** Phase 1: give a consumed discount back when its order is cancelled/failed. Never goes below zero. */
  decrementDiscountUsed(discountId: string): Promise<void>;
  getWalletBalance(userId: string): Promise<number>;
  /** Applies a signed wallet movement; throws on insufficient funds for a debit. Returns the new balance. */
  applyWalletTransaction(userId: string, amount: number, refType: string, refId: string): Promise<number>;
  getOrderByIdempotencyKey(key: string): Promise<OrderRecord | null>;
  getOrderById(id: string): Promise<OrderRecord | null>;
  listOrdersByUser(userId: string): Promise<OrderRecord[]>;
  listVendorOrderItems(vendorId: string): Promise<VendorOrderItemRow[]>;
  createOrder(input: CreateOrderInput): Promise<OrderRecord>;
  updateOrderStatus(id: string, status: OrderStatus): Promise<void>;
  createPayment(input: {
    orderId: string;
    provider: "MOCK" | "ZARINPAL";
    authority: string | null;
    amount: number;
    status: PaymentStatus;
    refId: string | null;
  }): Promise<PaymentRecord>;
  getPaymentByAuthority(authority: string): Promise<PaymentRecord | null>;
  getPaymentByOrderId(orderId: string): Promise<PaymentRecord | null>;
  updatePayment(id: string, patch: { status?: PaymentStatus; refId?: string | null }): Promise<void>;
  listUsers(): Promise<UserSummary[]>;
  getAdminStats(): Promise<AdminStats>;
  /** Admin order oversight (Week 6): every order, newest first. */
  listAllOrders(filters?: OrderFilters): Promise<OrderRecord[]>;
  /** Admin discount management (Week 6). */
  listDiscounts(): Promise<DiscountRecord[]>;
  createDiscount(input: DiscountInput): Promise<DiscountRecord>;
  updateDiscount(
    id: string,
    patch: Partial<Omit<DiscountInput, "code">> & { code?: string },
  ): Promise<DiscountRecord | null>;
  /**
   * Deletes a discount only when no order ever used it (returns false
   * when it is in use — the caller shows "in use" instead of failing
   * on a foreign-key error).
   */
  deleteDiscount(id: string): Promise<boolean>;
  // --- Notifications (Week 7) -------------------------------------------
  /** Persist a notification (the SSE bus publishes it separately). */
  createNotification(
    userId: string,
    type: string,
    payload: Record<string, unknown>,
  ): Promise<NotificationRecord>;
  /** Newest first. */
  listNotifications(userId: string, limit?: number): Promise<NotificationRecord[]>;
  countUnreadNotifications(userId: string): Promise<number>;
  /** Marks one notification read; returns false when it is not theirs. */
  markNotificationRead(userId: string, id: string): Promise<boolean>;
  /** Marks every unread notification of the user read. */
  markAllNotificationsRead(userId: string): Promise<void>;
}

// ---------------------------------------------------------------------------
// Prisma adapter
// ---------------------------------------------------------------------------

type PrismaOrderWithItems = {
  id: string;
  userId: string;
  status: OrderStatus;
  total: number;
  discountId: string | null;
  discountAmount: number;
  walletApplied: number;
  payable: number;
  addressId: string | null;
  idempotencyKey: string;
  createdAt: Date;
  items: {
    id: string;
    orderId: string;
    productId: string;
    vendorId: string;
    qty: number;
    unitPrice: number;
    commissionRate: number;
  }[];
};

function toOrderRecord(o: PrismaOrderWithItems): OrderRecord {
  return {
    id: o.id,
    userId: o.userId,
    status: o.status,
    total: o.total,
    discountId: o.discountId,
    discountAmount: o.discountAmount,
    walletApplied: o.walletApplied,
    payable: o.payable,
    addressId: o.addressId,
    idempotencyKey: o.idempotencyKey,
    createdAt: o.createdAt,
    items: o.items.map((i) => ({ ...i })),
  };
}

const orderWithItems = { items: true } as const;

export class PrismaDataStore implements DataStore {
  constructor(private readonly prisma: PrismaClient) {}

  async listAddresses(userId: string): Promise<AddressRecord[]> {
    const rows = await this.prisma.address.findMany({
      where: { userId },
      orderBy: { createdAt: "asc" },
    });
    return rows.map((a) => ({ ...a }));
  }

  async createAddress(
    userId: string,
    input: { title: string; city: string; text: string; postalCode: string; phone: string },
  ): Promise<AddressRecord> {
    const row = await this.prisma.address.create({ data: { userId, ...input } });
    return { ...row };
  }

  async getAddressById(id: string): Promise<AddressRecord | null> {
    const row = await this.prisma.address.findUnique({ where: { id } });
    return row ? { ...row } : null;
  }

  async getDiscountByCode(code: string): Promise<DiscountRecord | null> {
    const row = await this.prisma.discount.findUnique({ where: { code } });
    if (!row) return null;
    return {
      id: row.id,
      code: row.code,
      type: row.type,
      value: row.value,
      minAmount: row.minAmount,
      usageLimit: row.usageLimit,
      usedCount: row.usedCount,
      expiresAt: row.expiresAt,
    };
  }

  async countDiscountUseByUser(discountId: string, userId: string): Promise<number> {
    // Cancelled orders do not count as a use (Phase 1): a failed or
    // cancelled checkout must not burn the customer's one-time code.
    return this.prisma.order.count({
      where: { userId, discountId, status: { not: "CANCELLED" } },
    });
  }

  async incrementDiscountUsed(discountId: string): Promise<void> {
    await this.prisma.discount.update({
      where: { id: discountId },
      data: { usedCount: { increment: 1 } },
    });
  }

  async decrementDiscountUsed(discountId: string): Promise<void> {
    await this.prisma.discount.updateMany({
      where: { id: discountId, usedCount: { gt: 0 } },
      data: { usedCount: { decrement: 1 } },
    });
  }

  async getWalletBalance(userId: string): Promise<number> {
    const wallet = await this.prisma.wallet.findUnique({ where: { userId } });
    return wallet?.balance ?? 0;
  }

  async applyWalletTransaction(
    userId: string,
    amount: number,
    refType: string,
    refId: string,
  ): Promise<number> {
    return this.prisma.$transaction(async (tx) => {
      const wallet = await tx.wallet.upsert({
        where: { userId },
        update: {},
        create: { userId, balance: 0 },
      });
      const next = wallet.balance + amount;
      if (next < 0) throw new Error("Insufficient wallet balance");
      await tx.wallet.update({ where: { id: wallet.id }, data: { balance: next } });
      await tx.walletTransaction.create({
        data: {
          walletId: wallet.id,
          type: amount >= 0 ? "CREDIT" : "DEBIT",
          amount: Math.abs(amount),
          refType,
          refId,
        },
      });
      return next;
    });
  }

  async getOrderByIdempotencyKey(key: string): Promise<OrderRecord | null> {
    const order = await this.prisma.order.findUnique({
      where: { idempotencyKey: key },
      include: orderWithItems,
    });
    return order ? toOrderRecord(order) : null;
  }

  async getOrderById(id: string): Promise<OrderRecord | null> {
    const order = await this.prisma.order.findUnique({ where: { id }, include: orderWithItems });
    return order ? toOrderRecord(order) : null;
  }

  async listOrdersByUser(userId: string): Promise<OrderRecord[]> {
    const orders = await this.prisma.order.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      include: orderWithItems,
    });
    return orders.map(toOrderRecord);
  }

  async listVendorOrderItems(vendorId: string): Promise<VendorOrderItemRow[]> {
    const items = await this.prisma.orderItem.findMany({
      where: { vendorId },
      include: {
        order: { select: { status: true, createdAt: true } },
        product: { select: { title: true } },
      },
      orderBy: { order: { createdAt: "desc" } },
    });
    return items.map((i) => ({
      orderId: i.orderId,
      orderStatus: i.order.status,
      createdAt: i.order.createdAt,
      productId: i.productId,
      title: i.product.title,
      qty: i.qty,
      unitPrice: i.unitPrice,
      commissionRate: i.commissionRate,
      gross: i.unitPrice * i.qty,
    }));
  }

  async createOrder(input: CreateOrderInput): Promise<OrderRecord> {
    const order = await this.prisma.$transaction(async (tx) => {
      const created = await tx.order.create({
        data: {
          userId: input.userId,
          status: input.payable === 0 ? "PAID" : "PENDING",
          total: input.total,
          discountId: input.discountId,
          discountAmount: input.discountAmount,
          walletApplied: input.walletApplied,
          payable: input.payable,
          addressId: input.addressId,
          idempotencyKey: input.idempotencyKey,
          items: {
            create: input.items.map((i) => ({
              productId: i.productId,
              vendorId: i.vendorId,
              qty: i.qty,
              unitPrice: i.unitPrice,
              commissionRate: i.commissionRate,
            })),
          },
        },
        include: orderWithItems,
      });
      if (input.discountId) {
        await tx.discount.update({
          where: { id: input.discountId },
          data: { usedCount: { increment: 1 } },
        });
      }
      if (input.walletApplied > 0) {
        const wallet = await tx.wallet.upsert({
          where: { userId: input.userId },
          update: {},
          create: { userId: input.userId, balance: 0 },
        });
        if (wallet.balance < input.walletApplied) {
          throw new Error("Insufficient wallet balance");
        }
        await tx.wallet.update({
          where: { id: wallet.id },
          data: { balance: wallet.balance - input.walletApplied },
        });
        await tx.walletTransaction.create({
          data: {
            walletId: wallet.id,
            type: "DEBIT",
            amount: input.walletApplied,
            refType: "ORDER",
            refId: created.id,
          },
        });
      }
      return created;
    });
    return toOrderRecord(order);
  }

  async updateOrderStatus(id: string, status: OrderStatus): Promise<void> {
    await this.prisma.order.update({ where: { id }, data: { status } });
  }

  async createPayment(input: {
    orderId: string;
    provider: "MOCK" | "ZARINPAL";
    authority: string | null;
    amount: number;
    status: PaymentStatus;
    refId: string | null;
  }): Promise<PaymentRecord> {
    const row = await this.prisma.payment.create({
      data: {
        orderId: input.orderId,
        provider: input.provider,
        authority: input.authority,
        amount: input.amount,
        status: input.status,
        refId: input.refId,
      },
    });
    return { ...row };
  }

  async getPaymentByAuthority(authority: string): Promise<PaymentRecord | null> {
    const row = await this.prisma.payment.findUnique({ where: { authority } });
    return row ? { ...row } : null;
  }

  async getPaymentByOrderId(orderId: string): Promise<PaymentRecord | null> {
    const row = await this.prisma.payment.findFirst({
      where: { orderId },
      orderBy: { createdAt: "desc" },
    });
    return row ? { ...row } : null;
  }

  async updatePayment(id: string, patch: { status?: PaymentStatus; refId?: string | null }): Promise<void> {
    await this.prisma.payment.update({ where: { id }, data: patch });
  }

  async listUsers(): Promise<UserSummary[]> {
    const users = await getUserStore().listAll();
    return users.map((u) => ({
      id: u.id,
      email: u.email,
      name: u.name,
      role: u.role,
      status: u.status,
      vendorId: u.vendorId,
    }));
  }

  async getAdminStats(): Promise<AdminStats> {
    const [totalUsers, totalOrders, revenue, pendingVendors] = await Promise.all([
      this.prisma.user.count(),
      this.prisma.order.count(),
      this.prisma.order.aggregate({ where: { status: "PAID" }, _sum: { total: true } }),
      this.prisma.vendorProfile.count({ where: { status: "PENDING" } }),
    ]);
    return {
      totalUsers,
      totalOrders,
      totalRevenue: revenue._sum.total ?? 0,
      pendingVendors,
    };
  }

  async listAllOrders(filters?: OrderFilters): Promise<OrderRecord[]> {
    const orders = await this.prisma.order.findMany({
      where: {
        ...(filters?.status ? { status: filters.status } : {}),
        ...(filters?.from || filters?.to
          ? { createdAt: { gte: filters.from, lte: filters.to } }
          : {}),
        ...(filters?.vendorId ? { items: { some: { vendorId: filters.vendorId } } } : {}),
      },
      orderBy: { createdAt: "desc" },
      include: orderWithItems,
    });
    return orders.map(toOrderRecord);
  }

  private toDiscountRecord(row: {
    id: string;
    code: string;
    type: "PERCENT" | "FIXED";
    value: number;
    minAmount: number;
    usageLimit: number | null;
    usedCount: number;
    expiresAt: Date | null;
  }): DiscountRecord {
    return { ...row };
  }

  async listDiscounts(): Promise<DiscountRecord[]> {
    const rows = await this.prisma.discount.findMany({ orderBy: { createdAt: "asc" } });
    return rows.map((r) => this.toDiscountRecord(r));
  }

  async createDiscount(input: DiscountInput): Promise<DiscountRecord> {
    const row = await this.prisma.discount.create({
      data: {
        code: input.code.toUpperCase(),
        type: input.type,
        value: input.value,
        minAmount: input.minAmount,
        usageLimit: input.usageLimit,
        expiresAt: input.expiresAt,
      },
    });
    return this.toDiscountRecord(row);
  }

  async updateDiscount(
    id: string,
    patch: Partial<Omit<DiscountInput, "code">> & { code?: string },
  ): Promise<DiscountRecord | null> {
    const row = await this.prisma.discount
      .update({
        where: { id },
        data: {
          ...(patch.code ? { code: patch.code.toUpperCase() } : {}),
          ...(patch.type ? { type: patch.type } : {}),
          ...(patch.value !== undefined ? { value: patch.value } : {}),
          ...(patch.minAmount !== undefined ? { minAmount: patch.minAmount } : {}),
          ...(patch.usageLimit !== undefined ? { usageLimit: patch.usageLimit } : {}),
          ...(patch.expiresAt !== undefined ? { expiresAt: patch.expiresAt } : {}),
        },
      })
      .catch(() => null);
    return row ? this.toDiscountRecord(row) : null;
  }

  async deleteDiscount(id: string): Promise<boolean> {
    const used = await this.prisma.order.count({ where: { discountId: id } });
    if (used > 0) return false;
    await this.prisma.discount.delete({ where: { id } }).catch(() => null);
    return true;
  }

  // --- Notifications (Week 7) -------------------------------------------

  async createNotification(
    userId: string,
    type: string,
    payload: Record<string, unknown>,
  ): Promise<NotificationRecord> {
    const row = await this.prisma.notification.create({
      data: { userId, type, payload: payload as Prisma.InputJsonValue },
    });
    return { ...row, payload: (row.payload ?? {}) as Record<string, unknown> };
  }

  async listNotifications(userId: string, limit = 50): Promise<NotificationRecord[]> {
    const rows = await this.prisma.notification.findMany({
      where: { userId },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: limit,
    });
    return rows.map((r) => ({ ...r, payload: (r.payload ?? {}) as Record<string, unknown> }));
  }

  async countUnreadNotifications(userId: string): Promise<number> {
    return this.prisma.notification.count({ where: { userId, readAt: null } });
  }

  async markNotificationRead(userId: string, id: string): Promise<boolean> {
    const updated = await this.prisma.notification
      .updateMany({ where: { id, userId, readAt: null }, data: { readAt: new Date() } })
      .catch(() => ({ count: 0 }));
    return updated.count > 0;
  }

  async markAllNotificationsRead(userId: string): Promise<void> {
    await this.prisma.notification.updateMany({
      where: { userId, readAt: null },
      data: { readAt: new Date() },
    });
  }
}

// ---------------------------------------------------------------------------
// Memory adapter (no database — demo + tests)
// ---------------------------------------------------------------------------

export class MemoryDataStore implements DataStore {
  private addresses: AddressRecord[] = [];
  private discounts: DiscountRecord[] = seedDiscounts.map((d) => ({
    id: `discount-${d.code}`,
    code: d.code,
    type: d.type as "PERCENT" | "FIXED",
    value: d.value,
    minAmount: d.minAmount,
    usageLimit: d.usageLimit,
    usedCount: 0,
    expiresAt: null,
  }));
  private orders: OrderRecord[] = [];
  private payments: PaymentRecord[] = [];
  private notifications: NotificationRecord[] = [];
  private wallets = new Map<string, number>([["u-customer", 150000]]);

  async listAddresses(userId: string): Promise<AddressRecord[]> {
    return this.addresses.filter((a) => a.userId === userId).map((a) => ({ ...a }));
  }

  async createAddress(
    userId: string,
    input: { title: string; city: string; text: string; postalCode: string; phone: string },
  ): Promise<AddressRecord> {
    const record: AddressRecord = { id: `addr-${crypto.randomUUID()}`, userId, ...input };
    this.addresses.push(record);
    return { ...record };
  }

  async getAddressById(id: string): Promise<AddressRecord | null> {
    const found = this.addresses.find((a) => a.id === id);
    return found ? { ...found } : null;
  }

  async getDiscountByCode(code: string): Promise<DiscountRecord | null> {
    const found = this.discounts.find((d) => d.code === code.toUpperCase());
    return found ? { ...found } : null;
  }

  async countDiscountUseByUser(discountId: string, userId: string): Promise<number> {
    // Cancelled orders do not count as a use (Phase 1, mirrors Prisma).
    return this.orders.filter(
      (o) => o.userId === userId && o.discountId === discountId && o.status !== "CANCELLED",
    ).length;
  }

  async incrementDiscountUsed(discountId: string): Promise<void> {
    const found = this.discounts.find((d) => d.id === discountId);
    if (found) found.usedCount += 1;
  }

  async decrementDiscountUsed(discountId: string): Promise<void> {
    const found = this.discounts.find((d) => d.id === discountId);
    if (found && found.usedCount > 0) found.usedCount -= 1;
  }

  async getWalletBalance(userId: string): Promise<number> {
    return this.wallets.get(userId) ?? 0;
  }

  async applyWalletTransaction(
    userId: string,
    amount: number,
    _refType: string,
    _refId: string,
  ): Promise<number> {
    void _refType;
    void _refId;
    const next = (this.wallets.get(userId) ?? 0) + amount;
    if (next < 0) throw new Error("Insufficient wallet balance");
    this.wallets.set(userId, next);
    return next;
  }

  async getOrderByIdempotencyKey(key: string): Promise<OrderRecord | null> {
    const found = this.orders.find((o) => o.idempotencyKey === key);
    return found ? structuredClone(found) : null;
  }

  async getOrderById(id: string): Promise<OrderRecord | null> {
    const found = this.orders.find((o) => o.id === id);
    return found ? structuredClone(found) : null;
  }

  async listOrdersByUser(userId: string): Promise<OrderRecord[]> {
    return this.orders
      .filter((o) => o.userId === userId)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
      .map((o) => structuredClone(o));
  }

  async listVendorOrderItems(vendorId: string): Promise<VendorOrderItemRow[]> {
    const { products } = await import("@/data/seed");
    const rows: VendorOrderItemRow[] = [];
    for (const order of this.orders) {
      for (const item of order.items) {
        if (item.vendorId !== vendorId) continue;
        const product = products.find((p) => p.id === item.productId);
        rows.push({
          orderId: order.id,
          orderStatus: order.status,
          createdAt: order.createdAt,
          productId: item.productId,
          title: product?.title ?? item.productId,
          qty: item.qty,
          unitPrice: item.unitPrice,
          commissionRate: item.commissionRate,
          gross: item.unitPrice * item.qty,
        });
      }
    }
    return rows.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }

  async createOrder(input: CreateOrderInput): Promise<OrderRecord> {
    const record: OrderRecord = {
      id: `order-${crypto.randomUUID()}`,
      userId: input.userId,
      status: input.payable === 0 ? "PAID" : "PENDING",
      total: input.total,
      discountId: input.discountId,
      discountAmount: input.discountAmount,
      walletApplied: input.walletApplied,
      payable: input.payable,
      addressId: input.addressId,
      idempotencyKey: input.idempotencyKey,
      createdAt: new Date(),
      items: input.items.map((i) => ({
        id: `item-${crypto.randomUUID()}`,
        orderId: "",
        productId: i.productId,
        vendorId: i.vendorId,
        qty: i.qty,
        unitPrice: i.unitPrice,
        commissionRate: i.commissionRate,
      })),
    };
    for (const item of record.items) item.orderId = record.id;
    this.orders.push(record);
    if (input.discountId) await this.incrementDiscountUsed(input.discountId);
    if (input.walletApplied > 0) {
      await this.applyWalletTransaction(input.userId, -input.walletApplied, "ORDER", record.id);
    }
    return structuredClone(record);
  }

  async updateOrderStatus(id: string, status: OrderStatus): Promise<void> {
    const found = this.orders.find((o) => o.id === id);
    if (found) found.status = status;
  }

  async createPayment(input: {
    orderId: string;
    provider: "MOCK" | "ZARINPAL";
    authority: string | null;
    amount: number;
    status: PaymentStatus;
    refId: string | null;
  }): Promise<PaymentRecord> {
    const record: PaymentRecord = { id: `pay-${crypto.randomUUID()}`, ...input };
    this.payments.push(record);
    return { ...record };
  }

  async getPaymentByAuthority(authority: string): Promise<PaymentRecord | null> {
    const found = this.payments.find((p) => p.authority === authority);
    return found ? { ...found } : null;
  }

  async getPaymentByOrderId(orderId: string): Promise<PaymentRecord | null> {
    const found = [...this.payments].reverse().find((p) => p.orderId === orderId);
    return found ? { ...found } : null;
  }

  async updatePayment(id: string, patch: { status?: PaymentStatus; refId?: string | null }): Promise<void> {
    const found = this.payments.find((p) => p.id === id);
    if (found) Object.assign(found, patch);
  }

  async listUsers(): Promise<UserSummary[]> {
    const users = await getUserStore().listAll();
    return users.map((u) => ({
      id: u.id,
      email: u.email,
      name: u.name,
      role: u.role,
      status: u.status,
      vendorId: u.vendorId,
    }));
  }

  async getAdminStats(): Promise<AdminStats> {
    const users = await getUserStore().listAll();
    return {
      totalUsers: users.length,
      totalOrders: this.orders.length,
      totalRevenue: this.orders
        .filter((o) => o.status === "PAID")
        .reduce((sum, o) => sum + o.total, 0),
      // Vendor approvals live in Prisma in Week 6; in memory mode the
      // seed vendors are all APPROVED, so nothing is pending.
      pendingVendors: 0,
    };
  }

  async listAllOrders(filters?: OrderFilters): Promise<OrderRecord[]> {
    return this.orders
      .filter((o) => {
        if (filters?.status && o.status !== filters.status) return false;
        if (filters?.from && o.createdAt < filters.from) return false;
        if (filters?.to && o.createdAt > filters.to) return false;
        if (filters?.vendorId && !o.items.some((i) => i.vendorId === filters.vendorId)) {
          return false;
        }
        return true;
      })
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
      .map((o) => structuredClone(o));
  }

  async listDiscounts(): Promise<DiscountRecord[]> {
    return this.discounts.map((d) => ({ ...d }));
  }

  async createDiscount(input: DiscountInput): Promise<DiscountRecord> {
    const code = input.code.toUpperCase();
    if (this.discounts.some((d) => d.code === code)) {
      throw new Error(`Discount code already exists: ${code}`);
    }
    const record: DiscountRecord = {
      id: `discount-${crypto.randomUUID()}`,
      code,
      type: input.type,
      value: input.value,
      minAmount: input.minAmount,
      usageLimit: input.usageLimit,
      usedCount: 0,
      expiresAt: input.expiresAt,
    };
    this.discounts.push(record);
    return { ...record };
  }

  async updateDiscount(
    id: string,
    patch: Partial<Omit<DiscountInput, "code">> & { code?: string },
  ): Promise<DiscountRecord | null> {
    const found = this.discounts.find((d) => d.id === id);
    if (!found) return null;
    if (patch.code) {
      const code = patch.code.toUpperCase();
      if (this.discounts.some((d) => d.id !== id && d.code === code)) return null;
      found.code = code;
    }
    if (patch.type) found.type = patch.type;
    if (patch.value !== undefined) found.value = patch.value;
    if (patch.minAmount !== undefined) found.minAmount = patch.minAmount;
    if (patch.usageLimit !== undefined) found.usageLimit = patch.usageLimit;
    if (patch.expiresAt !== undefined) found.expiresAt = patch.expiresAt;
    return { ...found };
  }

  async deleteDiscount(id: string): Promise<boolean> {
    if (this.orders.some((o) => o.discountId === id)) return false;
    const index = this.discounts.findIndex((d) => d.id === id);
    if (index === -1) return true;
    this.discounts.splice(index, 1);
    return true;
  }

  // --- Notifications (Week 7) -------------------------------------------

  async createNotification(
    userId: string,
    type: string,
    payload: Record<string, unknown>,
  ): Promise<NotificationRecord> {
    const record: NotificationRecord = {
      id: `notif-${crypto.randomUUID()}`,
      userId,
      type,
      payload: { ...payload },
      readAt: null,
      createdAt: new Date(),
    };
    this.notifications.push(record);
    return { ...record, payload: { ...record.payload } };
  }

  async listNotifications(userId: string, limit = 50): Promise<NotificationRecord[]> {
    return this.notifications
      .filter((n) => n.userId === userId)
      .map((n, index) => ({ n, index }))
      .sort(
        (a, b) =>
          b.n.createdAt.getTime() - a.n.createdAt.getTime() || b.index - a.index,
      )
      .slice(0, limit)
      .map(({ n }) => ({ ...n, payload: { ...n.payload } }));
  }

  async countUnreadNotifications(userId: string): Promise<number> {
    return this.notifications.filter((n) => n.userId === userId && n.readAt === null).length;
  }

  async markNotificationRead(userId: string, id: string): Promise<boolean> {
    const found = this.notifications.find((n) => n.id === id && n.userId === userId);
    if (!found || found.readAt !== null) return false;
    found.readAt = new Date();
    return true;
  }

  async markAllNotificationsRead(userId: string): Promise<void> {
    for (const n of this.notifications) {
      if (n.userId === userId && n.readAt === null) n.readAt = new Date();
    }
  }
}

// ---------------------------------------------------------------------------
// Factory — the only entry point the app uses
// ---------------------------------------------------------------------------

const globalForDataStore = globalThis as unknown as { dataStore?: DataStore };

/** Prisma when DATABASE_URL is set, otherwise the memory adapter. */
export function getDataStore(): DataStore {
  const prisma = getPrismaClient();
  if (prisma) return new PrismaDataStore(prisma);
  globalForDataStore.dataStore ??= new MemoryDataStore();
  return globalForDataStore.dataStore;
}

/** Which adapter is active — shown in README/docs, never a secret. */
export function getOrderDataSource(): "prisma" | "memory" {
  return getPrismaClient() ? "prisma" : "memory";
}
