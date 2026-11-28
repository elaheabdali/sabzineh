"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Button } from "@sabzineh/ui";
import { cancelOrderAction, resumePaymentAction } from "@/server/checkout/actions";

/** Pending-order actions: resume the gateway payment or cancel the order. */
export function OrderActions({ orderId, locale }: { orderId: string; locale: string }) {
  const t = useTranslations("checkout");
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);

  const resume = async () => {
    setBusy(true);
    setError(false);
    const result = await resumePaymentAction(orderId, locale);
    if (result.ok && result.paymentUrl) {
      window.location.href = result.paymentUrl;
      return;
    }
    setError(true);
    setBusy(false);
  };

  const cancel = async () => {
    setBusy(true);
    setError(false);
    const result = await cancelOrderAction(orderId);
    if (result.ok) {
      router.refresh();
      return;
    }
    setError(true);
    setBusy(false);
  };

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button type="button" onClick={resume} disabled={busy} data-testid="resume-payment">
        {t("resumePayment")}
      </Button>
      <Button type="button" variant="outline" onClick={cancel} disabled={busy} data-testid="cancel-order">
        {t("cancelOrder")}
      </Button>
      {error ? (
        <p role="alert" className="text-sm font-medium text-red-700">
          {t("unknownError")}
        </p>
      ) : null}
    </div>
  );
}
