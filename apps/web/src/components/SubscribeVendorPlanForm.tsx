"use client";

import { useActionState, useEffect } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@sabzineh/ui";
import { subscribeVendorPlanAction, type BillingActionState } from "@/server/billing/actions";

/** Vendor selling-plan subscribe form (Week 6). */
export function SubscribeVendorPlanForm({
  planId,
  priceLabel,
  locale,
}: {
  planId: string;
  priceLabel: string;
  locale: string;
}) {
  const t = useTranslations("subscription");
  const [state, action, pending] = useActionState<BillingActionState, FormData>(
    subscribeVendorPlanAction,
    {},
  );

  useEffect(() => {
    if (state.paymentUrl) window.location.href = state.paymentUrl;
  }, [state.paymentUrl]);

  return (
    <form action={action} className="flex flex-col gap-3">
      <input type="hidden" name="planId" value={planId} />
      <input type="hidden" name="locale" value={locale} />
      <div className="flex flex-col gap-2 text-sm">
        <label className="flex cursor-pointer items-center gap-2">
          <input type="radio" name="payWith" value="wallet" defaultChecked />
          {t("payWithWallet")}
        </label>
        <label className="flex cursor-pointer items-center gap-2">
          <input type="radio" name="payWith" value="gateway" />
          {t("payWithGateway")}
        </label>
      </div>
      {state.error ? (
        <p role="alert" className="text-sm font-medium text-red-700" data-testid="subscribe-error">
          {t("subscribeError")}: {state.error}
        </p>
      ) : null}
      {state.saved ? (
        <p role="status" className="text-sm font-medium text-leaf-700" data-testid="subscribe-saved">
          {t("subscribed")}
        </p>
      ) : null}
      <Button type="submit" disabled={pending} data-testid={`subscribe-plan-${planId}`}>
        {t("subscribe")} — {priceLabel}
      </Button>
    </form>
  );
}
