import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { getSession } from "@/lib/auth/guards";
import { OrderError, getOrderDetail } from "@/server/orders/service";
import { getDataStore } from "@/server/store";
import { getCatalogRepository } from "@/features/catalog/repository";
import { formatJalali, formatPrice } from "@/lib/format";
import { ClearCartOnPaid } from "@/components/ClearCartOnPaid";
import { OrderActions } from "@/components/OrderActions";
import type { Locale } from "@/i18n/routing";

/**
 * Order detail / confirmation page.
 *
 * The status shown here is read back from the server — never trusted
 * from the query string. `payment=success` in the URL is only a
 * banner hint; the PAID status below is the source of truth, and it
 * is what clears the cart (ClearCartOnPaid).
 */
export default async function OrderDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: Locale; id: string }>;
  searchParams: Promise<{ payment?: string }>;
}) {
  const { locale, id } = await params;
  const { payment } = await searchParams;
  const session = await getSession();
  if (!session) redirect(`/${locale}/auth/login?next=/${locale}/account/orders/${id}`);
  const t = await getTranslations("orders");
  const store = getDataStore();

  let order;
  try {
    order = await getOrderDetail(session.id, id);
  } catch (error) {
    if (error instanceof OrderError && error.code === "not-your-order") {
      return (
        <div className="flex flex-col gap-4 pt-8" data-testid="order-page">
          <h1 className="text-2xl font-black text-ink-900">{t("orderNotFound")}</h1>
        </div>
      );
    }
    return (
      <div className="flex flex-col gap-4 pt-8" data-testid="order-page">
        <h1 className="text-2xl font-black text-ink-900">{t("orderNotFound")}</h1>
      </div>
    );
  }

  const [address, paymentRecord] = await Promise.all([
    order.addressId ? store.getAddressById(order.addressId) : Promise.resolve(null),
    store.getPaymentByOrderId(order.id),
  ]);
  const repo = getCatalogRepository();
  const titles = new Map<string, string>();
  for (const item of order.items) {
    const product = await repo.getProductById(item.productId);
    titles.set(item.productId, product?.title ?? item.productId);
  }

  return (
    <div className="flex flex-col gap-6 pt-8" data-testid="order-page" data-order-id={order.id}>
      {order.status === "PAID" && <ClearCartOnPaid />}
      <h1 className="text-2xl font-black text-ink-900">
        {t("order")} #{order.id.slice(0, 8)}
      </h1>

      {payment === "success" && order.status === "PAID" ? (
        <p className="rounded-xl bg-leaf-100 p-4 text-sm font-bold text-leaf-800" data-testid="payment-success-banner">
          {t("paymentSuccess")}
        </p>
      ) : null}
      {payment === "cancelled" ? (
        <p className="rounded-xl bg-amber-50 p-4 text-sm font-bold text-amber-800" data-testid="payment-cancelled-banner">
          {t("paymentCancelled")}
        </p>
      ) : null}
      {payment === "error" ? (
        <p className="rounded-xl bg-red-50 p-4 text-sm font-bold text-red-800" data-testid="payment-error-banner">
          {t("paymentError")}
        </p>
      ) : null}

      <div className="flex flex-wrap items-center gap-4 rounded-2xl border border-cream-200 bg-white p-4 text-sm">
        <span>
          {t("date")}: {formatJalali(order.createdAt, locale)}
        </span>
        <span
          className="rounded-full bg-cream-100 px-3 py-1 text-xs font-bold text-ink-900"
          data-testid="order-status"
          data-status={order.status}
        >
          {t(order.status.toLowerCase() as "paid" | "pending" | "cancelled")}
        </span>
      </div>

      <section className="rounded-2xl border border-cream-200 bg-white p-4">
        <h2 className="mb-3 text-sm font-bold text-ink-900">{t("items")}</h2>
        <ul className="flex flex-col divide-y divide-cream-100 text-sm">
          {order.items.map((item) => (
            <li key={item.id} className="flex justify-between py-2" data-testid="order-item">
              <span>
                {titles.get(item.productId)} × {item.qty}
              </span>
              <span className="font-bold">{formatPrice(item.unitPrice * item.qty, locale)}</span>
            </li>
          ))}
        </ul>
        <dl className="flex flex-col gap-1 border-t border-cream-100 pt-3 text-sm">
          <div className="flex justify-between">
            <dt>{t("total")}</dt>
            <dd className="font-bold">{formatPrice(order.total, locale)}</dd>
          </div>
          {order.discountAmount > 0 ? (
            <div className="flex justify-between">
              <dt>−</dt>
              <dd className="font-bold text-leaf-700">{formatPrice(order.discountAmount, locale)}</dd>
            </div>
          ) : null}
          {order.walletApplied > 0 ? (
            <div className="flex justify-between">
              <dt>{t("wallet")}</dt>
              <dd className="font-bold">−{formatPrice(order.walletApplied, locale)}</dd>
            </div>
          ) : null}
          <div className="flex justify-between text-base">
            <dt className="font-bold">{t("total")}</dt>
            <dd className="font-black" data-testid="order-payable">{formatPrice(order.payable, locale)}</dd>
          </div>
        </dl>
      </section>

      {address ? (
        <section className="rounded-2xl border border-cream-200 bg-white p-4 text-sm">
          <h2 className="mb-2 text-sm font-bold text-ink-900">{t("address")}</h2>
          <p className="text-neutral-600">
            {address.title} — {address.city} · {address.text} · {address.postalCode}
          </p>
        </section>
      ) : null}

      {paymentRecord ? (
        <section className="rounded-2xl border border-cream-200 bg-white p-4 text-sm">
          <h2 className="mb-2 text-sm font-bold text-ink-900">{t("payment")}</h2>
          <p className="text-neutral-600">
            {paymentRecord.provider} · {formatPrice(paymentRecord.amount, locale)} · {paymentRecord.status}
            {paymentRecord.refId ? ` · ${paymentRecord.refId}` : ""}
          </p>
        </section>
      ) : null}

      {order.status === "PENDING" ? <OrderActions orderId={order.id} locale={locale} /> : null}
    </div>
  );
}
