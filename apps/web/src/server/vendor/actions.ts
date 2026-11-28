"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireRole, requireSession } from "@/lib/auth/guards";
import { AuthError, SESSION_TTL_MS } from "@/lib/auth/service";
import { setSessionCookie } from "@/lib/auth/cookies";
import {
  VendorServiceError,
  adjustVendorProductStock,
  createVendorProduct,
  getVendorProfile,
  registerVendor,
  setVendorProductStatus,
  transitionVendorOrder,
  updateVendorProduct,
  updateVendorProfile,
} from "@/features/vendor/service";
import type { VendorProductInput } from "@sabzineh/types";

/**
 * Vendor server actions (Week 5).
 *
 * Every action re-authenticates server-side (requireRole) and the
 * service re-validates its input with the shared Zod schemas — the
 * client only ever displays forms. Uploaded images arrive as data:
 * URLs (max 4 × 1 MB, see next.config.ts serverActions bodySizeLimit).
 */

export interface VendorActionState {
  error?: string;
}

export interface VendorProductActionResult {
  ok: boolean;
  productId?: string;
  slug?: string;
  error?: string;
}

function mapError(error: unknown): string {
  if (error instanceof VendorServiceError) return error.code;
  if (error instanceof AuthError) return error.code;
  console.error("vendor action failed", error);
  return "unknown";
}

export async function createVendorProductAction(
  input: VendorProductInput,
  publish: boolean,
): Promise<VendorProductActionResult> {
  const session = await requireRole(["VENDOR"]);
  try {
    const product = await createVendorProduct(session, input, publish);
    revalidatePath("/fa/vendor/products");
    revalidatePath("/en/vendor/products");
    return { ok: true, productId: product.id, slug: product.slug };
  } catch (error) {
    return { ok: false, error: mapError(error) };
  }
}

export async function updateVendorProductAction(
  id: string,
  input: VendorProductInput,
): Promise<VendorProductActionResult> {
  const session = await requireRole(["VENDOR"]);
  try {
    const product = await updateVendorProduct(session, id, input);
    revalidatePath("/fa/vendor/products");
    revalidatePath("/en/vendor/products");
    revalidatePath(`/fa/product/${product.slug}`);
    return { ok: true, productId: product.id, slug: product.slug };
  } catch (error) {
    return { ok: false, error: mapError(error) };
  }
}

/** List buttons: publish / unpublish / archive (plain form action). */
export async function setVendorProductStatusAction(formData: FormData): Promise<void> {
  const session = await requireRole(["VENDOR"]);
  const productId = String(formData.get("productId") ?? "");
  const status = String(formData.get("status") ?? "");
  try {
    await setVendorProductStatus(session, productId, status);
  } catch (error) {
    console.error("setVendorProductStatusAction failed", error);
    return;
  }
  revalidatePath("/fa/vendor/products");
  revalidatePath("/en/vendor/products");
}

/** Quick stock +/- buttons on the product list (plain form action). */
export async function adjustVendorStockAction(formData: FormData): Promise<void> {
  const session = await requireRole(["VENDOR"]);
  const productId = String(formData.get("productId") ?? "");
  const delta = Number(formData.get("delta") ?? 0);
  try {
    await adjustVendorProductStock(session, productId, delta);
  } catch (error) {
    console.error("adjustVendorStockAction failed", error);
    return;
  }
  revalidatePath("/fa/vendor/products");
  revalidatePath("/en/vendor/products");
}

/** Dashboard fulfilment buttons: PREPARING / SHIPPED / DELIVERED (plain form action). */
export async function updateVendorOrderStatusAction(formData: FormData): Promise<void> {
  const session = await requireRole(["VENDOR"]);
  const orderId = String(formData.get("orderId") ?? "");
  const toStatus = String(formData.get("status") ?? "");
  try {
    await transitionVendorOrder(session, { orderId, toStatus });
  } catch (error) {
    console.error("updateVendorOrderStatusAction failed", error);
    return;
  }
  revalidatePath("/fa/vendor/dashboard");
  revalidatePath("/en/vendor/dashboard");
}

/** Shop settings form (useActionState). */
export async function updateVendorProfileAction(
  _prev: VendorActionState,
  formData: FormData,
): Promise<VendorActionState & { saved?: boolean }> {
  const session = await requireRole(["VENDOR"]);
  try {
    await updateVendorProfile(session, {
      shopName: formData.get("shopName"),
      city: formData.get("city"),
      bio: formData.get("bio") || undefined,
      phone: formData.get("phone") || undefined,
      logoUrl: formData.get("logoUrl") || undefined,
      payoutIban: formData.get("payoutIban") || undefined,
      payoutAccountHolder: formData.get("payoutAccountHolder") || undefined,
    });
  } catch (error) {
    return { error: mapError(error) };
  }
  revalidatePath("/fa/vendor/settings");
  revalidatePath("/en/vendor/settings");
  return { saved: true };
}

/** Public vendor registration (useActionState) — PENDING until Week 6. */
export async function registerVendorAction(
  _prev: VendorActionState,
  formData: FormData,
): Promise<VendorActionState> {
  const locale = String(formData.get("locale") ?? "fa");
  const safeLocale = locale === "en" ? "en" : "fa";
  try {
    const { token } = await registerVendor({
      name: formData.get("name"),
      email: formData.get("email"),
      phone: formData.get("phone"),
      password: formData.get("password"),
      shopName: formData.get("shopName"),
      city: formData.get("city"),
      bio: formData.get("bio") || undefined,
      documentsNote: formData.get("documentsNote") || undefined,
    });
    await setSessionCookie(token, SESSION_TTL_MS / 1000);
  } catch (error) {
    return { error: mapError(error) };
  }
  redirect(`/${safeLocale}/vendor/dashboard`);
}

/** Prefill for the settings page (server component). */
export async function getVendorProfileForPage() {
  const session = await requireSession();
  return getVendorProfile(session);
}

/**
 * Phase 4: description draft generation. Uses the real AI client
 * when AI_API_KEY is configured and transparently falls back to
 * the template generator otherwise (or on any AI failure) — the
 * vendor always reviews and edits the draft before saving.
 */
export async function generateProductDraftAction(input: {
  title: string;
  categoryName: string;
  organic?: boolean;
  glutenFree?: boolean;
  local?: boolean;
  price?: number;
  locale?: "fa" | "en";
}): Promise<{ description: string; tags: string[]; source: "ai" | "template" } | null> {
  await requireRole(["VENDOR", "ADMIN"]);
  const { generateProductDraftSmart } = await import("@/server/ai/client");
  const { draft, source } = await generateProductDraftSmart(input);
  return { ...draft, source };
}
