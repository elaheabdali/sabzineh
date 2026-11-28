import { getTranslations } from "next-intl/server";
import { getDataStore } from "@/server/store";
import { formatPrice } from "@/lib/format";
import type { Locale } from "@/i18n/routing";

/**
 * Mock gateway page (Week 3).
 *
 * This is the stand-in for Zarinpal's StartPay page while
 * PAYMENT_PROVIDER is unset (mock default). The order is only marked
 * PAID when the user presses Pay and the callback verifies the
 * authority — pressing Cancel returns to checkout with the cart
 * intact. Lives under [locale] because the root layout renders no
 * <html>/<body>; the locale layout does.
 */
export default async function MockPaymentPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: Locale }>;
  searchParams: Promise<{ authority?: string }>;
}) {
  const { locale } = await params;
  const { authority } = await searchParams;
  const t = await getTranslations("payment");
  const store = getDataStore();

  const payment = authority ? await store.getPaymentByAuthority(authority) : null;
  const order = payment ? await store.getOrderById(payment.orderId) : null;

  if (!payment || !order) {
    return (
      <div className="flex flex-col gap-4 pt-8" data-testid="mock-payment-page">
        <h1 className="text-2xl font-black text-ink-900">{t("mockTitle")}</h1>
        <p className="text-sm text-neutral-600">—</p>
      </div>
    );
  }

  const callbackBase = `/api/payments/callback?authority=${encodeURIComponent(payment.authority ?? "")}&locale=${locale}`;

  return (
    <div className="mx-auto flex w-full max-w-md flex-col gap-6 pt-8" data-testid="mock-payment-page">
      <h1 className="text-2xl font-black text-ink-900">{t("mockTitle")}</h1>
      <p className="rounded-xl bg-cream-50 p-4 text-sm leading-6 text-neutral-600">{t("mockHint")}</p>
      <dl className="flex flex-col gap-2 rounded-2xl border border-cream-200 bg-white p-6 text-sm">
        <div className="flex justify-between">
          <dt className="text-neutral-600">{t("order")}</dt>
          <dd className="font-bold text-ink-900" data-testid="mock-order-id">#{order.id.slice(0, 8)}</dd>
        </div>
        <div className="flex justify-between">
          <dt className="text-neutral-600">{t("amount")}</dt>
          <dd className="font-black text-ink-900" data-testid="mock-amount">
            {formatPrice(payment.amount, locale)}
          </dd>
        </div>
      </dl>
      <div className="flex gap-2">
        {/* Plain anchors: the callback is a route handler, not a
            localised page — a full navigation is correct here. */}
        <a
          href={`${callbackBase}&Status=OK`}
          data-testid="mock-pay"
          className="flex-1 rounded-xl bg-leaf-700 px-6 py-3 text-center text-sm font-bold text-white"
        >
          {t("pay")}
        </a>
        <a
          href={`${callbackBase}&Status=NOK`}
          data-testid="mock-cancel"
          className="flex-1 rounded-xl border border-cream-200 bg-white px-6 py-3 text-center text-sm font-bold text-ink-900"
        >
          {t("cancel")}
        </a>
      </div>
    </div>
  );
}
