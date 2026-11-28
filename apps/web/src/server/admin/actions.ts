"use server";

import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/auth/guards";
import { AdminError } from "./service";
import {
  approveVendorAsAdmin,
  createCategoryAsAdmin,
  createDiscountAsAdmin,
  deleteCategoryAsAdmin,
  deleteDiscountAsAdmin,
  rejectVendorAsAdmin,
  setUserStatusAsAdmin,
  updateCategoryAsAdmin,
  updateDiscountAsAdmin,
} from "./service";
import { approvePayout, markPayoutPaid, PayoutError } from "@/server/billing/payouts";
import { OrderError, refundOrder } from "@/server/orders/service";
import { getBillingStore } from "@/server/billing/store";
import {
  createBannerAsAdmin,
  deleteBannerAsAdmin,
  setProductStatusAsAdmin,
  updateBannerAsAdmin,
} from "./service";
import type { BannerInput, BannerPlacement } from "@/server/store";

/**
 * Admin server actions (Week 6).
 *
 * Every action re-authenticates server-side (requireRole ADMIN) and
 * the service re-validates its input — the client only displays
 * forms. Sensitive actions are audit-logged in the service layer.
 */

export interface AdminActionState {
  error?: string;
  saved?: boolean;
}

function mapError(error: unknown): string {
  if (error instanceof AdminError) return error.code;
  if (error instanceof PayoutError) return error.code;
  console.error("admin action failed", error);
  return "unknown";
}

function revalidateAdmin(): void {
  for (const locale of ["fa", "en"]) {
    revalidatePath(`/${locale}/admin/dashboard`);
    revalidatePath(`/${locale}/admin/users`);
    revalidatePath(`/${locale}/admin/vendors`);
    revalidatePath(`/${locale}/admin/categories`);
    revalidatePath(`/${locale}/admin/discounts`);
    revalidatePath(`/${locale}/admin/orders`);
    revalidatePath(`/${locale}/admin/payouts`);
    revalidatePath(`/${locale}/admin/audit`);
    revalidatePath(`/${locale}/admin/products`);
    revalidatePath(`/${locale}/admin/banners`);
    revalidatePath(`/${locale}/admin/reports`);
    revalidatePath(`/${locale}`);
  }
}

/** Suspend / activate a user (plain form action). */
export async function setUserStatusAction(formData: FormData): Promise<void> {
  const session = await requireRole(["ADMIN"]);
  const userId = String(formData.get("userId") ?? "");
  const status = String(formData.get("status") ?? "");
  if (status !== "ACTIVE" && status !== "SUSPENDED") return;
  try {
    await setUserStatusAsAdmin(session.id, userId, status);
  } catch (error) {
    console.error("setUserStatusAction failed", error);
    return;
  }
  revalidateAdmin();
}

/** Approve a pending vendor (plain form action). */
export async function approveVendorAction(formData: FormData): Promise<void> {
  const session = await requireRole(["ADMIN"]);
  const vendorId = String(formData.get("vendorId") ?? "");
  try {
    await approveVendorAsAdmin(session.id, vendorId);
  } catch (error) {
    console.error("approveVendorAction failed", error);
    return;
  }
  revalidateAdmin();
}

/** Reject a pending vendor with a reason (useActionState). */
export async function rejectVendorAction(
  _prev: AdminActionState,
  formData: FormData,
): Promise<AdminActionState> {
  const session = await requireRole(["ADMIN"]);
  const vendorId = String(formData.get("vendorId") ?? "");
  const reason = String(formData.get("reason") ?? "");
  try {
    await rejectVendorAsAdmin(session.id, vendorId, reason);
  } catch (error) {
    return { error: mapError(error) };
  }
  revalidateAdmin();
  return { saved: true };
}

/** Create a category (plain form action). */
export async function createCategoryAction(formData: FormData): Promise<void> {
  const session = await requireRole(["ADMIN"]);
  const parentId = String(formData.get("parentId") ?? "");
  try {
    await createCategoryAsAdmin(session.id, {
      parentId: parentId === "" ? null : parentId,
      slug: String(formData.get("slug") ?? ""),
      nameFa: String(formData.get("nameFa") ?? ""),
      nameEn: String(formData.get("nameEn") ?? ""),
    });
  } catch (error) {
    console.error("createCategoryAction failed", error);
    return;
  }
  revalidateAdmin();
}

/** Rename / move a category (plain form action). */
export async function updateCategoryAction(formData: FormData): Promise<void> {
  const session = await requireRole(["ADMIN"]);
  const id = String(formData.get("id") ?? "");
  const parentId = String(formData.get("parentId") ?? "");
  const sortOrder = Number(formData.get("sortOrder") ?? "");
  try {
    await updateCategoryAsAdmin(session.id, id, {
      parentId: parentId === "" ? null : parentId,
      nameFa: String(formData.get("nameFa") ?? ""),
      nameEn: String(formData.get("nameEn") ?? ""),
      ...(Number.isInteger(sortOrder) ? { sortOrder } : {}),
    });
  } catch (error) {
    console.error("updateCategoryAction failed", error);
    return;
  }
  revalidateAdmin();
}

/** Delete a category, optionally reassigning its products (plain form action). */
export async function deleteCategoryAction(formData: FormData): Promise<void> {
  const session = await requireRole(["ADMIN"]);
  const id = String(formData.get("id") ?? "");
  const reassignTo = String(formData.get("reassignTo") ?? "");
  try {
    await deleteCategoryAsAdmin(session.id, id, reassignTo === "" ? null : reassignTo);
  } catch (error) {
    console.error("deleteCategoryAction failed", error);
    return;
  }
  revalidateAdmin();
}

/** Create a discount code (plain form action). */
export async function createDiscountAction(formData: FormData): Promise<void> {
  const session = await requireRole(["ADMIN"]);
  const expiresAtRaw = String(formData.get("expiresAt") ?? "");
  try {
    await createDiscountAsAdmin(session.id, {
      code: String(formData.get("code") ?? ""),
      type: String(formData.get("type") ?? "PERCENT") === "FIXED" ? "FIXED" : "PERCENT",
      value: Number(formData.get("value") ?? 0),
      minAmount: Number(formData.get("minAmount") ?? 0),
      usageLimit:
        String(formData.get("usageLimit") ?? "") === ""
          ? null
          : Number(formData.get("usageLimit")),
      expiresAt: expiresAtRaw === "" ? null : new Date(expiresAtRaw),
    });
  } catch (error) {
    console.error("createDiscountAction failed", error);
    return;
  }
  revalidateAdmin();
}

/** Update a discount code (plain form action). */
export async function updateDiscountAction(formData: FormData): Promise<void> {
  const session = await requireRole(["ADMIN"]);
  const id = String(formData.get("id") ?? "");
  const expiresAtRaw = String(formData.get("expiresAt") ?? "");
  try {
    await updateDiscountAsAdmin(session.id, id, {
      code: String(formData.get("code") ?? ""),
      type: String(formData.get("type") ?? "PERCENT") === "FIXED" ? "FIXED" : "PERCENT",
      value: Number(formData.get("value") ?? 0),
      minAmount: Number(formData.get("minAmount") ?? 0),
      usageLimit:
        String(formData.get("usageLimit") ?? "") === ""
          ? null
          : Number(formData.get("usageLimit")),
      expiresAt: expiresAtRaw === "" ? null : new Date(expiresAtRaw),
    });
  } catch (error) {
    console.error("updateDiscountAction failed", error);
    return;
  }
  revalidateAdmin();
}

/** Delete a discount code (plain form action; blocked while in use). */
export async function deleteDiscountAction(formData: FormData): Promise<void> {
  const session = await requireRole(["ADMIN"]);
  const id = String(formData.get("id") ?? "");
  try {
    await deleteDiscountAsAdmin(session.id, id);
  } catch (error) {
    console.error("deleteDiscountAction failed", error);
    return;
  }
  revalidateAdmin();
}

/** Approve a requested payout (plain form action). */
export async function approvePayoutAction(formData: FormData): Promise<void> {
  const session = await requireRole(["ADMIN"]);
  const payoutId = String(formData.get("payoutId") ?? "");
  try {
    await approvePayout(session.id, payoutId);
  } catch (error) {
    console.error("approvePayoutAction failed", error);
    return;
  }
  revalidateAdmin();
}

/** Mark an approved payout as paid (plain form action). */
export async function markPayoutPaidAction(formData: FormData): Promise<void> {
  const session = await requireRole(["ADMIN"]);
  const payoutId = String(formData.get("payoutId") ?? "");
  try {
    await markPayoutPaid(session.id, payoutId);
  } catch (error) {
    console.error("markPayoutPaidAction failed", error);
    return;
  }
  revalidateAdmin();
}

/**
 * Phase 2: refund a PAID order (plain form action). The refund
 * credits the customer's wallet, releases stock and restores the
 * discount; the admin step is written to the audit log.
 */
export async function refundOrderAction(formData: FormData): Promise<void> {
  const session = await requireRole(["ADMIN"]);
  const orderId = String(formData.get("orderId") ?? "");
  try {
    const order = await refundOrder(orderId);
    await getBillingStore().createAuditLog({
      actorId: session.id,
      action: "order.refund",
      entity: "Order",
      entityId: order.id,
      meta: { userId: order.userId, credited: order.walletApplied + order.payable },
    });
  } catch (error) {
    if (error instanceof OrderError) {
      console.error("refundOrderAction failed", error.code);
    } else {
      console.error("refundOrderAction failed", error);
    }
    return;
  }
  revalidateAdmin();
}

/** Phase 3: set a product's status from the admin products table. */
export async function setProductStatusAction(formData: FormData): Promise<void> {
  const session = await requireRole(["ADMIN"]);
  const productId = String(formData.get("productId") ?? "");
  const status = String(formData.get("status") ?? "");
  if (status !== "DRAFT" && status !== "PUBLISHED" && status !== "ARCHIVED") return;
  try {
    await setProductStatusAsAdmin(session.id, productId, status);
  } catch (error) {
    console.error("setProductStatusAction failed", error);
    return;
  }
  revalidateAdmin();
}

const BANNER_PLACEMENTS: BannerPlacement[] = ["HOME_HERO", "HOME_STRIP", "CATEGORY"];

function bannerInputFromForm(formData: FormData): BannerInput | null {
  const title = String(formData.get("title") ?? "").trim();
  const placement = String(formData.get("placement") ?? "") as BannerPlacement;
  if (!title || !BANNER_PLACEMENTS.includes(placement)) return null;
  const startsAtRaw = String(formData.get("startsAt") ?? "");
  const endsAtRaw = String(formData.get("endsAt") ?? "");
  return {
    title,
    imageUrl: String(formData.get("imageUrl") ?? ""),
    linkUrl: String(formData.get("linkUrl") ?? "") || null,
    placement,
    startsAt: startsAtRaw ? new Date(startsAtRaw) : null,
    endsAt: endsAtRaw ? new Date(endsAtRaw) : null,
    active: formData.get("active") === "on",
  };
}

/** Phase 3: create a banner from the admin banners page. */
export async function createBannerAction(formData: FormData): Promise<void> {
  const session = await requireRole(["ADMIN"]);
  const input = bannerInputFromForm(formData);
  if (!input) return;
  try {
    await createBannerAsAdmin(session.id, input);
  } catch (error) {
    console.error("createBannerAction failed", error);
    return;
  }
  revalidateAdmin();
}

/** Phase 3: update a banner (the edit form posts every field). */
export async function updateBannerAction(formData: FormData): Promise<void> {
  const session = await requireRole(["ADMIN"]);
  const bannerId = String(formData.get("bannerId") ?? "");
  const input = bannerInputFromForm(formData);
  if (!bannerId || !input) return;
  try {
    await updateBannerAsAdmin(session.id, bannerId, input);
  } catch (error) {
    console.error("updateBannerAction failed", error);
    return;
  }
  revalidateAdmin();
}

/** Phase 3: delete a banner. */
export async function deleteBannerAction(formData: FormData): Promise<void> {
  const session = await requireRole(["ADMIN"]);
  const bannerId = String(formData.get("bannerId") ?? "");
  if (!bannerId) return;
  try {
    await deleteBannerAsAdmin(session.id, bannerId);
  } catch (error) {
    console.error("deleteBannerAction failed", error);
    return;
  }
  revalidateAdmin();
}
