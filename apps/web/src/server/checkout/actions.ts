"use server";

import { revalidatePath } from "next/cache";
import { requireSession } from "@/lib/auth/guards";
import { normalizeIranianMobile, normalizePostalCode } from "@/lib/auth/validation";
import { getDataStore } from "@/server/store";
import {
  OrderError,
  cancelOrder,
  computeCheckout,
  createOrder,
  createWalletTopUp,
  resumePayment,
} from "@/server/orders/service";
import {
  AddressSchema,
  CartItemSchema,
  OrderCreateSchema,
  type Money,
} from "@sabzineh/types";
import { z } from "zod";

/**
 * Checkout server actions (Week 3).
 *
 * Every action re-authenticates server-side and re-validates its
 * input. Totals are always computed on the server (computeCheckout);
 * the client only displays them.
 */

export interface CheckoutActionState {
  error?: string;
}

const AddressFormSchema = AddressSchema;

export async function createAddressAction(
  _prev: CheckoutActionState,
  formData: FormData,
): Promise<CheckoutActionState & { addressId?: string }> {
  const session = await requireSession();
  const phone = normalizeIranianMobile(String(formData.get("phone") ?? ""));
  const postalCode = normalizePostalCode(String(formData.get("postalCode") ?? ""));
  const parsed = AddressFormSchema.safeParse({
    title: formData.get("title"),
    city: formData.get("city"),
    text: formData.get("text"),
    postalCode: postalCode ?? String(formData.get("postalCode") ?? ""),
    phone: phone ?? String(formData.get("phone") ?? ""),
  });
  if (!parsed.success || !phone || !postalCode) return { error: "invalid-input" };
  const address = await getDataStore().createAddress(session.id, parsed.data);
  revalidatePath("/fa/checkout");
  revalidatePath("/fa/account/addresses");
  return { addressId: address.id };
}

export interface CheckoutPreviewResult {
  ok: boolean;
  money?: Money;
  error?: string;
}

/** Live totals for the checkout review step (discount + wallet). */
export async function previewCheckoutAction(input: {
  items: { productId: string; qty: number }[];
  discountCode?: string;
  useWallet?: boolean;
}): Promise<CheckoutPreviewResult> {
  const session = await requireSession();
  const parsed = z
    .object({ items: z.array(CartItemSchema).min(1).max(50) })
    .safeParse({ items: input.items });
  if (!parsed.success) return { ok: false, error: "invalid-input" };
  try {
    const money = await computeCheckout({
      userId: session.id,
      items: parsed.data.items,
      discountCode: input.discountCode?.trim() || undefined,
      useWallet: input.useWallet,
    });
    return { ok: true, money };
  } catch (error) {
    if (error instanceof OrderError) return { ok: false, error: error.code };
    return { ok: false, error: "unknown" };
  }
}

export interface CreateOrderActionResult {
  ok: boolean;
  orderId?: string;
  paymentUrl?: string | null;
  error?: string;
}

export async function createOrderAction(input: {
  items: { productId: string; qty: number }[];
  addressId: string;
  discountCode?: string;
  useWallet?: boolean;
  idempotencyKey: string;
  locale: string;
}): Promise<CreateOrderActionResult> {
  const session = await requireSession();
  const parsed = OrderCreateSchema.safeParse({
    items: input.items,
    addressId: input.addressId,
    discountCode: input.discountCode?.trim() || undefined,
    useWallet: input.useWallet,
    idempotencyKey: input.idempotencyKey,
  });
  if (!parsed.success) return { ok: false, error: "invalid-input" };
  try {
    const result = await createOrder(session.id, parsed.data, { locale: input.locale });
    return {
      ok: true,
      orderId: result.order.id,
      paymentUrl: result.paymentUrl,
    };
  } catch (error) {
    if (error instanceof OrderError) return { ok: false, error: error.code };
    // Log the real cause server-side: the client only ever sees the
    // generic "unknown" error, which makes gateway failures
    // undebuggable (Week 4).
    console.error("createOrderAction failed", error);
    return { ok: false, error: "unknown" };
  }
}

export async function resumePaymentAction(
  orderId: string,
  locale: string,
): Promise<{ ok: boolean; paymentUrl?: string; error?: string }> {
  const session = await requireSession();
  try {
    const resumed = await resumePayment(session.id, orderId, locale);
    if (!resumed) return { ok: false, error: "not-payable" };
    return { ok: true, paymentUrl: resumed.paymentUrl };
  } catch (error) {
    if (error instanceof OrderError) return { ok: false, error: error.code };
    return { ok: false, error: "unknown" };
  }
}

/** Phase 2: start a wallet top-up through the gateway. */
export async function walletTopUpAction(
  amount: number,
  locale: string,
): Promise<{ ok: boolean; paymentUrl?: string; error?: string }> {
  const session = await requireSession();
  try {
    const topUp = await createWalletTopUp(session.id, amount, { locale });
    return { ok: true, paymentUrl: topUp.paymentUrl };
  } catch (error) {
    if (error instanceof OrderError) return { ok: false, error: error.code };
    return { ok: false, error: "unknown" };
  }
}

export async function cancelOrderAction(orderId: string): Promise<{ ok: boolean; error?: string }> {
  const session = await requireSession();
  try {
    await cancelOrder(session.id, orderId);
    revalidatePath("/fa/account/orders");
    return { ok: true };
  } catch (error) {
    if (error instanceof OrderError) return { ok: false, error: error.code };
    return { ok: false, error: "unknown" };
  }
}
