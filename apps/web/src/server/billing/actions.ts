"use server";

import { revalidatePath } from "next/cache";
import { requireRole, requireSession } from "@/lib/auth/guards";
import {
  cancelSubscription,
  pauseSubscription,
  resumeSubscription,
  skipNextWeek,
  subscribeToBox,
  subscribeToVendorPlan,
  SubscriptionError,
} from "./subscriptions";
import { requestPayout, PayoutError } from "./payouts";

/**
 * Billing server actions (Week 6) — subscriptions + payouts.
 *
 * Every action re-authenticates server-side and the service
 * re-validates ownership and state transitions; the client only
 * displays forms. Subscribe actions return a gateway paymentUrl
 * when a payment is still due — the client redirects to it exactly
 * like the checkout flow does.
 */

export interface BillingActionState {
  error?: string;
  paymentUrl?: string;
  saved?: boolean;
}

function mapError(error: unknown): string {
  if (error instanceof SubscriptionError) return error.code;
  if (error instanceof PayoutError) return error.code;
  console.error("billing action failed", error);
  return "unknown";
}

function revalidateBilling(): void {
  for (const locale of ["fa", "en"]) {
    revalidatePath(`/${locale}/account/subscription`);
    revalidatePath(`/${locale}/vendor/subscription`);
    revalidatePath(`/${locale}/vendor/dashboard`);
    revalidatePath(`/${locale}/admin/payouts`);
  }
}

/** Subscribe to a weekly box (useActionState; redirects to gateway when due). */
export async function subscribeBoxAction(
  _prev: BillingActionState,
  formData: FormData,
): Promise<BillingActionState> {
  const session = await requireSession();
  const planId = String(formData.get("planId") ?? "");
  const payWith = String(formData.get("payWith") ?? "gateway") === "wallet" ? "wallet" : "gateway";
  const locale = String(formData.get("locale") ?? "fa") === "en" ? "en" : "fa";
  try {
    const result = await subscribeToBox(session.id, planId, payWith, { locale });
    if (result.paymentUrl) {
      // No revalidate here: the client redirects away, and revalidating
      // the subscription page would unmount this form (the plan cards
      // hide once a subscription exists) before its redirect effect
      // can fire. The destination pages load fresh data on arrival.
      return { paymentUrl: result.paymentUrl };
    }
    revalidateBilling();
    return { saved: true };
  } catch (error) {
    return { error: mapError(error) };
  }
}

/** Pause a box subscription (plain form action). */
export async function pauseSubscriptionAction(formData: FormData): Promise<void> {
  const session = await requireSession();
  const subscriptionId = String(formData.get("subscriptionId") ?? "");
  try {
    await pauseSubscription(session.id, subscriptionId);
  } catch (error) {
    console.error("pauseSubscriptionAction failed", error);
    return;
  }
  revalidateBilling();
}

/** Resume a paused box subscription (plain form action). */
export async function resumeSubscriptionAction(formData: FormData): Promise<void> {
  const session = await requireSession();
  const subscriptionId = String(formData.get("subscriptionId") ?? "");
  try {
    await resumeSubscription(session.id, subscriptionId);
  } catch (error) {
    console.error("resumeSubscriptionAction failed", error);
    return;
  }
  revalidateBilling();
}

/** Skip the next scheduled box week (plain form action). */
export async function skipWeekAction(formData: FormData): Promise<void> {
  const session = await requireSession();
  const subscriptionId = String(formData.get("subscriptionId") ?? "");
  try {
    await skipNextWeek(session.id, subscriptionId);
  } catch (error) {
    console.error("skipWeekAction failed", error);
    return;
  }
  revalidateBilling();
}

/** Cancel a subscription (plain form action). */
export async function cancelSubscriptionAction(formData: FormData): Promise<void> {
  const session = await requireSession();
  const subscriptionId = String(formData.get("subscriptionId") ?? "");
  try {
    await cancelSubscription(session.id, subscriptionId);
  } catch (error) {
    console.error("cancelSubscriptionAction failed", error);
    return;
  }
  revalidateBilling();
}

/** Subscribe to a vendor selling plan (useActionState; redirects to gateway when due). */
export async function subscribeVendorPlanAction(
  _prev: BillingActionState,
  formData: FormData,
): Promise<BillingActionState> {
  const session = await requireRole(["VENDOR"]);
  const planId = String(formData.get("planId") ?? "");
  const payWith = String(formData.get("payWith") ?? "gateway") === "wallet" ? "wallet" : "gateway";
  const locale = String(formData.get("locale") ?? "fa") === "en" ? "en" : "fa";
  try {
    const result = await subscribeToVendorPlan(session.id, planId, payWith, { locale });
    if (result.paymentUrl) {
      // No revalidate here: same unmount-before-redirect race as the
      // box subscribe (the plan cards hide once a plan is active).
      return { paymentUrl: result.paymentUrl };
    }
    revalidateBilling();
    return { saved: true };
  } catch (error) {
    return { error: mapError(error) };
  }
}

/** Request a payout for delivered items (plain form action; default period = last 30 days). */
export async function requestPayoutAction(formData: FormData): Promise<void> {
  const session = await requireRole(["VENDOR"]);
  const endRaw = String(formData.get("periodEnd") ?? "");
  const startRaw = String(formData.get("periodStart") ?? "");
  const periodEnd = endRaw === "" ? new Date() : new Date(endRaw);
  const periodStart =
    startRaw === "" ? new Date(periodEnd.getTime() - 30 * 24 * 60 * 60 * 1000) : new Date(startRaw);
  try {
    await requestPayout(session, periodStart, periodEnd);
  } catch (error) {
    console.error("requestPayoutAction failed", error);
    return;
  }
  revalidateBilling();
}
