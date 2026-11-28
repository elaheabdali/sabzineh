import type { CategoryDTO, Role, VendorProfileDTO } from "@sabzineh/types";
import { getCatalogRepository } from "@/features/catalog/repository";
import { getVendorRepository } from "@/features/vendor/repository";
import { getUserStore, getSessionStore } from "@/lib/auth/store";
import {
  getDataStore,
  type AdminStats,
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
