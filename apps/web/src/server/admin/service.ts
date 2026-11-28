import type { CategoryDTO, Role, VendorProfileDTO } from "@sabzineh/types";
import { getCatalogRepository } from "@/features/catalog/repository";
import { getVendorRepository } from "@/features/vendor/repository";
import { getUserStore, getSessionStore } from "@/lib/auth/store";
import {
  getDataStore,
  type AdminStats,
  type BannerInput,
  type DiscountInput,
  type DiscountRecord,
  type OrderFilters,
  type OrderRecord,
  type UserSummary,
} from "@/server/store";
import { getBillingStore } from "@/server/billing/store";
import { notifyUser } from "@/server/notifications";
import {
  validateCategoryCreate,
  validateCategoryMove,
  type CategoryRuleError,
} from "./category-rules";

/**
 * Admin service (Week 6) — the business logic behind the admin
 * panel. Every function takes an explicit admin id / session and
 * re-checks its preconditions server-side; pages and actions only
 * display forms. Sensitive actions (vendor approve/reject, user
 * suspend/activate, payout steps) are written to the audit log.
 */

export class AdminError extends Error {
  constructor(
    public readonly code:
      | "not-found"
      | "forbidden"
      | "invalid-input"
      | "invalid-transition"
      | "in-use"
      | "has-products"
      | "has-children"
      | "code-taken"
      | "last-admin"
      | CategoryRuleError,
  ) {
    super(code);
    this.name = "AdminError";
  }
}

export interface AdminDashboardData {
  stats: AdminStats;
  vendorCount: number;
  recentOrders: OrderRecord[];
  lowStock: { id: string; title: string; stock: number; vendorId: string }[];
}

export async function getAdminDashboardData(): Promise<AdminDashboardData> {
  const [stats, vendors, orders, lowStock] = await Promise.all([
    getDataStore().getAdminStats(),
    getCatalogRepository().getVendors(),
    getDataStore().listAllOrders(),
    getCatalogRepository().listLowStockProducts(5),
  ]);
  return {
    stats,
    vendorCount: vendors.length,
    recentOrders: orders.slice(0, 5),
    lowStock: lowStock.slice(0, 10),
  };
}

// ---------------------------------------------------------------------------
// Users
// ---------------------------------------------------------------------------

export async function listAdminUsers(params?: {
  q?: string;
  role?: Role;
}): Promise<UserSummary[]> {
  let users = await getDataStore().listUsers();
  if (params?.role) users = users.filter((u) => u.role === params.role);
  if (params?.q) {
    const query = params.q.trim().toLowerCase();
    users = users.filter(
      (u) => u.name.toLowerCase().includes(query) || u.email.toLowerCase().includes(query),
    );
  }
  return users;
}

export interface AdminUserDetail extends UserSummary {
  orderCount: number;
  vendor: VendorProfileDTO | null;
}

export async function getAdminUserDetail(id: string): Promise<AdminUserDetail | null> {
  const users = await getDataStore().listUsers();
  const user = users.find((u) => u.id === id);
  if (!user) return null;
  const [orders, vendor] = await Promise.all([
    getDataStore().listOrdersByUser(id),
    user.vendorId
      ? getVendorRepository().getVendorProfileById(user.vendorId)
      : Promise.resolve(null),
  ]);
  return { ...user, orderCount: orders.length, vendor };
}

/** Suspends / activates a user. Suspended users cannot log in and their sessions are killed. */
export async function setUserStatusAsAdmin(
  adminId: string,
  userId: string,
  status: "ACTIVE" | "SUSPENDED",
): Promise<UserSummary> {
  if (adminId === userId) throw new AdminError("forbidden");
  const store = getUserStore();
  const target = await store.findById(userId);
  if (!target) throw new AdminError("not-found");
  if (status === "SUSPENDED" && target.role === "ADMIN") {
    // Never suspend the last active admin.
    const admins = (await store.listAll()).filter(
      (u) => u.role === "ADMIN" && u.status === "ACTIVE",
    );
    if (admins.length <= 1) throw new AdminError("last-admin");
  }
  const updated = await store.setUserStatus(userId, status);
  if (!updated) throw new AdminError("not-found");
  if (status === "SUSPENDED") {
    await getSessionStore().deleteAllForUser(userId);
  }
  await getBillingStore().createAuditLog({
    actorId: adminId,
    action: status === "SUSPENDED" ? "user.suspend" : "user.activate",
    entity: "User",
    entityId: userId,
    meta: { email: target.email },
  });
  return {
    id: updated.id,
    email: updated.email,
    name: updated.name,
    role: updated.role,
    status: updated.status,
    vendorId: updated.vendorId,
  };
}

// ---------------------------------------------------------------------------
// Vendor approvals
// ---------------------------------------------------------------------------

export async function listPendingVendors(): Promise<VendorProfileDTO[]> {
  return getVendorRepository().listPendingVendorProfiles();
}

export async function approveVendorAsAdmin(
  adminId: string,
  vendorId: string,
): Promise<VendorProfileDTO> {
  const repo = getVendorRepository();
  const profile = await repo.getVendorProfileById(vendorId);
  if (!profile) throw new AdminError("not-found");
  if (profile.status !== "PENDING") throw new AdminError("invalid-transition");
  const updated = await repo.setVendorProfileStatus(vendorId, "APPROVED");
  if (!updated) throw new AdminError("not-found");
  await notifyUser(profile.userId, "vendor-approved", {
    vendorId,
    shopName: profile.shopName,
  });
  await getBillingStore().createAuditLog({
    actorId: adminId,
    action: "vendor.approve",
    entity: "VendorProfile",
    entityId: vendorId,
    meta: { shopName: profile.shopName },
  });
  return updated;
}

export async function rejectVendorAsAdmin(
  adminId: string,
  vendorId: string,
  reason: string,
): Promise<VendorProfileDTO> {
  const cleanReason = reason.trim();
  if (cleanReason.length < 2) throw new AdminError("invalid-input");
  const repo = getVendorRepository();
  const profile = await repo.getVendorProfileById(vendorId);
  if (!profile) throw new AdminError("not-found");
  if (profile.status !== "PENDING") throw new AdminError("invalid-transition");
  const updated = await repo.setVendorProfileStatus(vendorId, "REJECTED", cleanReason);
  if (!updated) throw new AdminError("not-found");
  await notifyUser(profile.userId, "vendor-rejected", {
    vendorId,
    shopName: profile.shopName,
    reason: cleanReason,
  });
  await getBillingStore().createAuditLog({
    actorId: adminId,
    action: "vendor.reject",
    entity: "VendorProfile",
    entityId: vendorId,
    meta: { shopName: profile.shopName, reason: cleanReason },
  });
  return updated;
}

// ---------------------------------------------------------------------------
// Categories
// ---------------------------------------------------------------------------

const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export async function createCategoryAsAdmin(
  adminId: string,
  input: {
    parentId: string | null;
    slug: string;
    nameFa: string;
    nameEn: string;
  },
): Promise<CategoryDTO> {
  const slug = input.slug.trim().toLowerCase();
  const nameFa = input.nameFa.trim();
  const nameEn = input.nameEn.trim();
  if (!SLUG_PATTERN.test(slug) || nameFa.length < 2 || nameEn.length < 2) {
    throw new AdminError("invalid-input");
  }
  const repo = getCatalogRepository();
  const all = await repo.listAllCategories();
  const rule = validateCategoryCreate(all, input.parentId);
  if (!rule.ok) throw new AdminError(rule.error);
  if (all.some((c) => c.slug === slug)) throw new AdminError("code-taken");
  const siblings = all.filter((c) => c.parentId === input.parentId);
  const sortOrder = siblings.reduce((max, c) => Math.max(max, c.sortOrder), 0) + 1;
  const created = await repo.createCategory({
    parentId: input.parentId,
    slug,
    nameFa,
    nameEn,
    sortOrder,
  });
  await getBillingStore().createAuditLog({
    actorId: adminId,
    action: "category.create",
    entity: "Category",
    entityId: created.id,
    meta: { slug, nameFa },
  });
  return created;
}

export async function updateCategoryAsAdmin(
  adminId: string,
  id: string,
  patch: { parentId?: string | null; nameFa?: string; nameEn?: string; sortOrder?: number },
): Promise<CategoryDTO> {
  const repo = getCatalogRepository();
  const all = await repo.listAllCategories();
  const current = all.find((c) => c.id === id);
  if (!current) throw new AdminError("not-found");
  if (patch.nameFa !== undefined && patch.nameFa.trim().length < 2) {
    throw new AdminError("invalid-input");
  }
  if (patch.nameEn !== undefined && patch.nameEn.trim().length < 2) {
    throw new AdminError("invalid-input");
  }
  if (patch.parentId !== undefined && patch.parentId !== current.parentId) {
    const rule = validateCategoryMove(all, id, patch.parentId);
    if (!rule.ok) throw new AdminError(rule.error);
  }
  const updated = await repo.updateCategory(id, {
    ...(patch.parentId !== undefined ? { parentId: patch.parentId } : {}),
    ...(patch.nameFa !== undefined ? { nameFa: patch.nameFa.trim() } : {}),
    ...(patch.nameEn !== undefined ? { nameEn: patch.nameEn.trim() } : {}),
    ...(patch.sortOrder !== undefined ? { sortOrder: patch.sortOrder } : {}),
  });
  if (!updated) throw new AdminError("not-found");
  await getBillingStore().createAuditLog({
    actorId: adminId,
    action: "category.update",
    entity: "Category",
    entityId: id,
    meta: { slug: current.slug },
  });
  return updated;
}

export async function deleteCategoryAsAdmin(
  adminId: string,
  id: string,
  reassignTo?: string | null,
): Promise<{ deleted: boolean; movedProducts: number }> {
  const repo = getCatalogRepository();
  const all = await repo.listAllCategories();
  const current = all.find((c) => c.id === id);
  if (!current) throw new AdminError("not-found");
  if (all.some((c) => c.parentId === id)) throw new AdminError("has-children");
  const productCount = await repo.countProductsByCategory(id);
  let movedProducts = 0;
  if (productCount > 0) {
    if (!reassignTo) throw new AdminError("has-products");
    const target = all.find((c) => c.id === reassignTo);
    if (!target || target.id === id) throw new AdminError("invalid-input");
    movedProducts = await repo.reassignProducts(id, reassignTo);
  }
  const deleted = await repo.deleteCategory(id);
  if (!deleted) throw new AdminError("not-found");
  await getBillingStore().createAuditLog({
    actorId: adminId,
    action: "category.delete",
    entity: "Category",
    entityId: id,
    meta: { slug: current.slug, movedProducts },
  });
  return { deleted, movedProducts };
}

// ---------------------------------------------------------------------------
// Discounts
// ---------------------------------------------------------------------------

export type DiscountInputError =
  | "invalid-code"
  | "invalid-value"
  | "invalid-min-amount"
  | "invalid-usage-limit"
  | "invalid-expiry";

/** Pure discount-shape rules, shared by create/update (Week 3 rules reused for usage). */
export function validateDiscountInput(input: DiscountInput): DiscountInputError | null {
  if (!/^[A-Z0-9][A-Z0-9-]{2,19}$/.test(input.code.trim().toUpperCase())) {
    return "invalid-code";
  }
  if (input.type === "PERCENT" && (input.value < 1 || input.value > 100)) {
    return "invalid-value";
  }
  if (input.type === "FIXED" && input.value < 1000) return "invalid-value";
  if (input.minAmount < 0) return "invalid-min-amount";
  if (input.usageLimit !== null && input.usageLimit < 1) return "invalid-usage-limit";
  if (input.expiresAt && input.expiresAt.getTime() <= Date.now()) return "invalid-expiry";
  return null;
}

export async function listAdminDiscounts(): Promise<DiscountRecord[]> {
  return getDataStore().listDiscounts();
}

export async function createDiscountAsAdmin(
  adminId: string,
  input: DiscountInput,
): Promise<DiscountRecord> {
  const problem = validateDiscountInput(input);
  if (problem) throw new AdminError("invalid-input");
  const store = getDataStore();
  const code = input.code.trim().toUpperCase();
  if (await store.getDiscountByCode(code)) throw new AdminError("code-taken");
  const created = await store.createDiscount({ ...input, code });
  await getBillingStore().createAuditLog({
    actorId: adminId,
    action: "discount.create",
    entity: "Discount",
    entityId: created.id,
    meta: { code },
  });
  return created;
}

export async function updateDiscountAsAdmin(
  adminId: string,
  id: string,
  patch: Partial<DiscountInput>,
): Promise<DiscountRecord> {
  const store = getDataStore();
  const current = (await store.listDiscounts()).find((d) => d.id === id);
  if (!current) throw new AdminError("not-found");
  const next: DiscountInput = {
    code: patch.code?.trim().toUpperCase() ?? current.code,
    type: patch.type ?? current.type,
    value: patch.value ?? current.value,
    minAmount: patch.minAmount ?? current.minAmount,
    usageLimit: patch.usageLimit ?? current.usageLimit,
    expiresAt: patch.expiresAt !== undefined ? patch.expiresAt : current.expiresAt,
  };
  const problem = validateDiscountInput(next);
  if (problem) throw new AdminError("invalid-input");
  if (next.code !== current.code && (await store.getDiscountByCode(next.code))) {
    throw new AdminError("code-taken");
  }
  const updated = await store.updateDiscount(id, {
    code: next.code,
    type: next.type,
    value: next.value,
    minAmount: next.minAmount,
    usageLimit: next.usageLimit,
    expiresAt: next.expiresAt,
  });
  if (!updated) throw new AdminError("not-found");
  return updated;
}

export async function deleteDiscountAsAdmin(adminId: string, id: string): Promise<void> {
  const store = getDataStore();
  const current = (await store.listDiscounts()).find((d) => d.id === id);
  if (!current) throw new AdminError("not-found");
  const deleted = await store.deleteDiscount(id);
  if (!deleted) throw new AdminError("in-use");
  await getBillingStore().createAuditLog({
    actorId: adminId,
    action: "discount.delete",
    entity: "Discount",
    entityId: id,
    meta: { code: current.code },
  });
}

// ---------------------------------------------------------------------------
// Order oversight
// ---------------------------------------------------------------------------

export interface AdminOrderRow {
  order: OrderRecord;
  userEmail: string | null;
  userName: string | null;
}

export async function listAdminOrders(filters?: OrderFilters): Promise<AdminOrderRow[]> {
  const orders = await getDataStore().listAllOrders(filters);
  const users = await getUserStore().listAll();
  const byId = new Map(users.map((u) => [u.id, u]));
  return orders.map((order) => {
    const user = byId.get(order.userId);
    return { order, userEmail: user?.email ?? null, userName: user?.name ?? null };
  });
}

export interface AdminOrderDetail {
  order: OrderRecord;
  userEmail: string | null;
  userName: string | null;
  items: { productId: string; title: string; qty: number; unitPrice: number; vendorId: string }[];
}

export async function getAdminOrderDetail(id: string): Promise<AdminOrderDetail | null> {
  const order = await getDataStore().getOrderById(id);
  if (!order) return null;
  const [user, repo] = await Promise.all([
    getUserStore().findById(order.userId),
    Promise.resolve(getCatalogRepository()),
  ]);
  const items = [];
  for (const item of order.items) {
    const product = await repo.getProductById(item.productId);
    items.push({
      productId: item.productId,
      title: product?.title ?? item.productId,
      qty: item.qty,
      unitPrice: item.unitPrice,
      vendorId: item.vendorId,
    });
  }
  return {
    order,
    userEmail: user?.email ?? null,
    userName: user?.name ?? null,
    items,
  };
}

export async function listAuditLogs(limit = 50) {
  return getBillingStore().listAuditLogs(limit);
}

// ---------------------------------------------------------------------------
// Product moderation (Phase 3)
// ---------------------------------------------------------------------------

export type AdminProductSort = "title" | "price" | "stock";

export interface AdminProductRow {
  id: string;
  title: string;
  vendorId: string;
  shopName: string | null;
  price: number;
  stock: number;
  status: string;
}

export interface AdminProductList {
  rows: AdminProductRow[];
  total: number;
  page: number;
  pageSize: number;
}

/**
 * Every product in the marketplace with server-side filter, sort
 * and pagination (the admin products table is URL-driven, like the
 * users page). Sorting happens here so the DataTable stays a pure
 * display component.
 */
export async function listAdminProducts(params?: {
  status?: "DRAFT" | "PUBLISHED" | "ARCHIVED";
  q?: string;
  sort?: AdminProductSort;
  dir?: "asc" | "desc";
  page?: number;
  pageSize?: number;
}): Promise<AdminProductList> {
  const repo = getVendorRepository();
  const products = await repo.listAllProducts({ status: params?.status, q: params?.q });
  const profiles = new Map<string, string>();
  for (const p of products) {
    if (!profiles.has(p.vendorId)) {
      const profile = await repo.getVendorProfileById(p.vendorId);
      profiles.set(p.vendorId, profile?.shopName ?? p.vendorId);
    }
  }
  const sort = params?.sort ?? "title";
  const factor = params?.dir === "desc" ? -1 : 1;
  const sorted = [...products].sort((a, b) => {
    if (sort === "price") return (a.price - b.price) * factor;
    if (sort === "stock") return (a.stock - b.stock) * factor;
    return a.title.localeCompare(b.title) * factor;
  });
  const pageSize = Math.min(50, Math.max(1, params?.pageSize ?? 10));
  const total = sorted.length;
  const page = Math.min(Math.max(1, params?.page ?? 1), Math.max(1, Math.ceil(total / pageSize)));
  const rows = sorted.slice((page - 1) * pageSize, page * pageSize).map((p) => ({
    id: p.id,
    title: p.title,
    vendorId: p.vendorId,
    shopName: profiles.get(p.vendorId) ?? null,
    price: p.price,
    stock: p.stock,
    status: p.status,
  }));
  return { rows, total, page, pageSize };
}

/** Admin sets a product's status (approve / archive / restore), audit-logged. */
export async function setProductStatusAsAdmin(
  adminId: string,
  productId: string,
  status: "DRAFT" | "PUBLISHED" | "ARCHIVED",
): Promise<void> {
  const updated = await getVendorRepository().setProductStatusAsAdmin(productId, status);
  if (!updated) throw new AdminError("not-found");
  await getBillingStore().createAuditLog({
    actorId: adminId,
    action: "product.status",
    entity: "Product",
    entityId: productId,
    meta: { status, vendorId: updated.vendorId },
  });
}

// ---------------------------------------------------------------------------
// Banner management (Phase 3)
// ---------------------------------------------------------------------------

export async function listAdminBanners() {
  return getDataStore().listBanners();
}

export async function createBannerAsAdmin(
  adminId: string,
  input: BannerInput,
): Promise<void> {
  if (!input.title.trim()) throw new AdminError("invalid-input");
  const created = await getDataStore().createBanner({ ...input, title: input.title.trim() });
  await getBillingStore().createAuditLog({
    actorId: adminId,
    action: "banner.create",
    entity: "Banner",
    entityId: created.id,
    meta: { placement: created.placement },
  });
}

export async function updateBannerAsAdmin(
  adminId: string,
  id: string,
  patch: Partial<BannerInput>,
): Promise<void> {
  const updated = await getDataStore().updateBanner(id, patch);
  if (!updated) throw new AdminError("not-found");
  await getBillingStore().createAuditLog({
    actorId: adminId,
    action: "banner.update",
    entity: "Banner",
    entityId: id,
    meta: { placement: updated.placement, active: updated.active },
  });
}

export async function deleteBannerAsAdmin(adminId: string, id: string): Promise<void> {
  const deleted = await getDataStore().deleteBanner(id);
  if (!deleted) throw new AdminError("not-found");
  await getBillingStore().createAuditLog({
    actorId: adminId,
    action: "banner.delete",
    entity: "Banner",
    entityId: id,
    meta: {},
  });
}

// ---------------------------------------------------------------------------
// Reports + CSV (Phase 3)
// ---------------------------------------------------------------------------

export interface AdminReports {
  revenue: number;
  ordersByStatus: Record<string, number>;
  payouts: { requested: number; approved: number; paid: number; paidNet: number };
  topVendors: { vendorId: string; shopName: string | null; gross: number }[];
}

/** Aggregate money/status report for the admin reports page. */
export async function getAdminReports(): Promise<AdminReports> {
  const store = getDataStore();
  const orders = await store.listAllOrders();
  const ordersByStatus: Record<string, number> = {};
  let revenue = 0;
  for (const order of orders) {
    ordersByStatus[order.status] = (ordersByStatus[order.status] ?? 0) + 1;
    if (order.status === "PAID" || order.status === "PREPARING" || order.status === "SHIPPED" || order.status === "DELIVERED") {
      revenue += order.total - order.discountAmount;
    }
  }
  const payouts = await getBillingStore().listPayouts();
  const payoutSummary = { requested: 0, approved: 0, paid: 0, paidNet: 0 };
  for (const p of payouts) {
    if (p.status === "REQUESTED") payoutSummary.requested += 1;
    if (p.status === "APPROVED") payoutSummary.approved += 1;
    if (p.status === "PAID") {
      payoutSummary.paid += 1;
      payoutSummary.paidNet += p.net;
    }
  }
  const repo = getVendorRepository();
  const grossByVendor = new Map<string, number>();
  for (const order of orders) {
    if (order.status === "CANCELLED" || order.status === "PENDING" || order.status === "REFUNDED") continue;
    for (const item of order.items) {
      grossByVendor.set(item.vendorId, (grossByVendor.get(item.vendorId) ?? 0) + item.unitPrice * item.qty);
    }
  }
  const topVendors: AdminReports["topVendors"] = [];
  for (const [vendorId, gross] of [...grossByVendor.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5)) {
    const profile = await repo.getVendorProfileById(vendorId);
    topVendors.push({ vendorId, shopName: profile?.shopName ?? null, gross });
  }
  return { revenue, ordersByStatus, payouts: payoutSummary, topVendors };
}

function csvCell(value: string | number): string {
  const text = String(value);
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

/** Orders as CSV (one row per order) for the admin export route. */
export async function buildOrdersCsv(): Promise<string> {
  const rows = await listAdminOrders();
  const lines = ["id,user_email,status,total,discount,wallet_applied,payable,items,created_at"];
  for (const { order, userEmail } of rows) {
    lines.push(
      [
        order.id,
        userEmail ?? "",
        order.status,
        order.total,
        order.discountAmount,
        order.walletApplied,
        order.payable,
        order.items.length,
        order.createdAt.toISOString(),
      ]
        .map(csvCell)
        .join(","),
    );
  }
  return lines.join("\n");
}

/** Payouts as CSV for the admin export route. */
export async function buildPayoutsCsv(): Promise<string> {
  const payouts = await getBillingStore().listPayouts();
  const lines = ["id,vendor_id,status,gross,commission,net,period_start,period_end,created_at"];
  for (const p of payouts) {
    lines.push(
      [
        p.id,
        p.vendorId,
        p.status,
        p.gross,
        p.commission,
        p.net,
        p.periodStart.toISOString(),
        p.periodEnd.toISOString(),
        p.createdAt.toISOString(),
      ]
        .map(csvCell)
        .join(","),
    );
  }
  return lines.join("\n");
}
