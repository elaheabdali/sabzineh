import {
  VendorOrderStatusSchema,
  VendorProductInputSchema,
  VendorProductStatusSchema,
  VendorProfileUpdateSchema,
  VendorRegistrationSchema,
  type VendorOrderStatus,
  type VendorProductStatus,
  type VendorProfileDTO,
} from "@sabzineh/types";
import type { SessionUser } from "@sabzineh/types";
import { getCatalogRepository } from "@/features/catalog/repository";
import { getDataStore, type VendorOrderItemRow } from "@/server/store";
import { notifyUser } from "@/server/notifications";
import { getBillingStore } from "@/server/billing/store";
import { vendorProductLimit } from "@/server/billing/subscriptions";
import {
  AuthError,
  SESSION_TTL_MS,
  toSessionUser,
} from "@/lib/auth/service";
import { hashPassword, validatePasswordStrength } from "@/lib/auth/password";
import { normalizeIranianMobile } from "@/lib/auth/validation";
import { getSessionStore, getUserStore } from "@/lib/auth/store";
import { getVendorRepository } from "./repository";

/**
 * Vendor service — business logic behind the vendor panel (Week 5).
 *
 * Every function takes the resolved session (never a client-supplied
 * vendorId) and re-checks ownership server-side. The repository
 * re-checks too, so a bug in one layer cannot leak another vendor's
 * rows.
 *
 * Money is integer Toman. Order status is a single status per order
 * (the Week 1 schema): when a vendor marks their part SHIPPED the
 * whole order flips — a known limitation of the single-status model,
 * documented in README. Per-item fulfilment is a Week 6+ concern.
 */

export class VendorServiceError extends Error {
  constructor(
    public readonly code:
      | "forbidden"
      | "not-found"
      | "invalid-input"
      | "invalid-transition"
      | "slug-taken"
      | "product-limit",
  ) {
    super(code);
    this.name = "VendorServiceError";
  }
}

/** Fulfilment chain — a vendor may only move one step forward. */
export const VENDOR_ORDER_TRANSITIONS: Record<string, VendorOrderStatus["toStatus"][]> = {
  PAID: ["PREPARING"],
  PREPARING: ["SHIPPED"],
  SHIPPED: ["DELIVERED"],
};

export const FULFILLED_ORDER_STATUSES = ["PAID", "PREPARING", "SHIPPED", "DELIVERED"];

function requireVendorId(session: SessionUser): string {
  if (session.role !== "VENDOR" || !session.vendorId) {
    throw new VendorServiceError("forbidden");
  }
  return session.vendorId;
}

/** URL-safe slug from a title; Persian titles fall back to a prefix. */
export function slugifyTitle(title: string, fallback: string): string {
  const base = title
    .toLowerCase()
    .trim()
    .replace(/[\s_]+/g, "-")
    .replace(/[^a-z0-9-]/g, "")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
  return base || fallback;
}

function uniqueSuffix(): string {
  return crypto.randomUUID().slice(0, 8);
}

export interface VendorDashboardData {
  profile: VendorProfileDTO | null;
  revenue: number;
  orderCount: number;
  productCount: number;
  topProducts: { productId: string; title: string; qty: number; gross: number }[];
  orders: VendorOrderItemRow[];
}

export async function getVendorDashboard(session: SessionUser): Promise<VendorDashboardData> {
  const vendorId = requireVendorId(session);
  const repo = getVendorRepository();
  const [profile, orders, products] = await Promise.all([
    repo.getVendorProfileByUserId(session.id),
    getDataStore().listVendorOrderItems(vendorId),
    repo.listVendorProducts(vendorId),
  ]);
  const fulfilled = orders.filter((o) => FULFILLED_ORDER_STATUSES.includes(o.orderStatus));
  const revenue = fulfilled.reduce((sum, o) => sum + o.gross, 0);
  const orderCount = new Set(fulfilled.map((o) => o.orderId)).size;
  const byProduct = new Map<string, { productId: string; title: string; qty: number; gross: number }>();
  for (const row of fulfilled) {
    const entry = byProduct.get(row.productId) ?? {
      productId: row.productId,
      title: row.title,
      qty: 0,
      gross: 0,
    };
    entry.qty += row.qty;
    entry.gross += row.gross;
    byProduct.set(row.productId, entry);
  }
  const topProducts = [...byProduct.values()]
    .sort((a, b) => b.gross - a.gross)
    .slice(0, 5);
  return { profile, revenue, orderCount, productCount: products.length, topProducts, orders };
}

export async function createVendorProduct(
  session: SessionUser,
  rawInput: unknown,
  publish: boolean,
) {
  const vendorId = requireVendorId(session);
  const parsed = VendorProductInputSchema.safeParse(rawInput);
  if (!parsed.success) throw new VendorServiceError("invalid-input");
  const category = await getCatalogRepository().getCategoryById(parsed.data.categoryId);
  if (!category) throw new VendorServiceError("invalid-input");
  const status: VendorProductStatus = publish ? "PUBLISHED" : "DRAFT";
  if (publish) {
    // A vendor whose registration is still PENDING (or rejected /
    // suspended) may save drafts but cannot publish to the storefront.
    const profile = await getVendorRepository().getVendorProfileByUserId(session.id);
    if (profile?.status !== "APPROVED") throw new VendorServiceError("forbidden");
  }
  // Product-count cap from the vendor's active plan (Week 6): basic
  // 20, pro 200. Seed/demo vendors run on basic terms by default.
  const existing = await getVendorRepository().listVendorProducts(vendorId);
  const limit = await vendorProductLimit(vendorId);
  if (existing.length >= limit) throw new VendorServiceError("product-limit");
  // Slug: latin-safe base + random suffix (unique by construction).
  const base = slugifyTitle(parsed.data.title, "product");
  const slug = `${base}-${uniqueSuffix()}`;
  return getVendorRepository().createVendorProduct(vendorId, parsed.data, status, slug);
}

export async function updateVendorProduct(
  session: SessionUser,
  id: string,
  rawInput: unknown,
) {
  const vendorId = requireVendorId(session);
  const parsed = VendorProductInputSchema.safeParse(rawInput);
  if (!parsed.success) throw new VendorServiceError("invalid-input");
  const category = await getCatalogRepository().getCategoryById(parsed.data.categoryId);
  if (!category) throw new VendorServiceError("invalid-input");
  const updated = await getVendorRepository().updateVendorProduct(vendorId, id, parsed.data);
  if (!updated) throw new VendorServiceError("not-found");
  return updated;
}

export async function setVendorProductStatus(
  session: SessionUser,
  id: string,
  rawStatus: unknown,
) {
  const vendorId = requireVendorId(session);
  const parsed = VendorProductStatusSchema.safeParse(rawStatus);
  if (!parsed.success) throw new VendorServiceError("invalid-input");
  // Ownership first (not-found for another vendor's row), then the
  // publish guard — a PENDING vendor may unpublish/archive, not publish.
  const owned = await getVendorRepository().getVendorProduct(vendorId, id);
  if (!owned) throw new VendorServiceError("not-found");
  if (parsed.data === "PUBLISHED") {
    const profile = await getVendorRepository().getVendorProfileByUserId(session.id);
    if (profile?.status !== "APPROVED") throw new VendorServiceError("forbidden");
  }
  const updated = await getVendorRepository().setVendorProductStatus(vendorId, id, parsed.data);
  if (!updated) throw new VendorServiceError("not-found");
  return updated;
}

export async function adjustVendorProductStock(
  session: SessionUser,
  id: string,
  delta: number,
): Promise<number> {
  const vendorId = requireVendorId(session);
  if (!Number.isInteger(delta) || delta === 0 || Math.abs(delta) > 10_000) {
    throw new VendorServiceError("invalid-input");
  }
  const owned = await getVendorRepository().getVendorProduct(vendorId, id);
  if (!owned) throw new VendorServiceError("not-found");
  return getCatalogRepository().adjustStock(id, delta);
}

export async function transitionVendorOrder(
  session: SessionUser,
  rawInput: unknown,
): Promise<void> {
  const vendorId = requireVendorId(session);
  const parsed = VendorOrderStatusSchema.safeParse(rawInput);
  if (!parsed.success) throw new VendorServiceError("invalid-input");
  const store = getDataStore();
  const order = await store.getOrderById(parsed.data.orderId);
  if (!order) throw new VendorServiceError("not-found");
  if (!order.items.some((item) => item.vendorId === vendorId)) {
    throw new VendorServiceError("forbidden");
  }
  const allowed = VENDOR_ORDER_TRANSITIONS[order.status] ?? [];
  if (!allowed.includes(parsed.data.toStatus)) {
    throw new VendorServiceError("invalid-transition");
  }
  await store.updateOrderStatus(order.id, parsed.data.toStatus);
  // Week 7: the customer hears about the status change live.
  await notifyUser(order.userId, "order-status", {
    orderId: order.id,
    status: parsed.data.toStatus,
  });
  if (parsed.data.toStatus === "DELIVERED") {
    // A delivered box order completes its weekly delivery (Week 6).
    const delivery = await getBillingStore().getBoxDeliveryByOrderId(order.id);
    if (delivery && delivery.status === "SCHEDULED") {
      await getBillingStore().updateBoxDelivery(delivery.id, { status: "DELIVERED" });
    }
  }
}

export async function getVendorProfile(session: SessionUser): Promise<VendorProfileDTO | null> {
  const vendorId = requireVendorId(session);
  return getVendorRepository().getVendorProfileById(vendorId);
}

export async function updateVendorProfile(
  session: SessionUser,
  rawInput: unknown,
): Promise<VendorProfileDTO> {
  const vendorId = requireVendorId(session);
  const parsed = VendorProfileUpdateSchema.safeParse(rawInput);
  if (!parsed.success) throw new VendorServiceError("invalid-input");
  const phone = parsed.data.phone ? normalizeIranianMobile(parsed.data.phone) : undefined;
  if (parsed.data.phone && !phone) throw new VendorServiceError("invalid-input");
  return getVendorRepository().updateVendorProfile(vendorId, {
    ...parsed.data,
    phone: phone ?? undefined,
  });
}

/**
 * Vendor registration request (Week 5): creates a VENDOR user and a
 * PENDING vendor profile. Admin approval is Week 6 — until then the
 * vendor dashboard shows the request as "under review" and the
 * vendor cannot publish products (createVendorProduct still works
 * as a draft; the shop page only lists APPROVED vendors).
 */
export async function registerVendor(
  rawInput: unknown,
): Promise<{ user: SessionUser; token: string; vendorId: string }> {
  const parsed = VendorRegistrationSchema.safeParse(rawInput);
  if (!parsed.success) throw new VendorServiceError("invalid-input");
  const phone = normalizeIranianMobile(parsed.data.phone);
  if (!phone) throw new AuthError("invalid-phone");
  if (validatePasswordStrength(parsed.data.password).length > 0) {
    throw new AuthError("weak-password");
  }
  const store = getUserStore();
  const email = parsed.data.email.trim().toLowerCase();
  const existing = await store.findByEmail(email);
  if (existing) throw new AuthError("email-taken");
  const user = await store.create({
    email,
    name: parsed.data.name.trim(),
    phone,
    role: "VENDOR",
    passwordHash: await hashPassword(parsed.data.password),
  });
  const repo = getVendorRepository();
  const slugBase = slugifyTitle(parsed.data.shopName, "shop");
  let slug = `${slugBase}-${uniqueSuffix()}`;
  // Extremely unlikely collision guard — the random suffix makes the
  // slug unique by construction; regenerate once if it ever hits.
  if (await repo.getVendorProfileBySlug(slug)) slug = `${slugBase}-${uniqueSuffix()}`;
  const profile = await repo.createVendorProfile(user.id, {
    shopName: parsed.data.shopName.trim(),
    slug,
    city: parsed.data.city.trim(),
    bio: parsed.data.bio?.trim() || undefined,
  });
  await store.setVendorId(user.id, profile.id);
  const session = await getSessionStore().create(user.id, SESSION_TTL_MS);
  const fresh = await store.findById(user.id);
  if (!fresh) throw new VendorServiceError("not-found");
  return { user: toSessionUser(fresh), token: session.token, vendorId: profile.id };
}
