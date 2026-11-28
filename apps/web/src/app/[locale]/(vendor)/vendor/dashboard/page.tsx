import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { ForbiddenError, UnauthorizedError, requireRole } from "@/lib/auth/guards";
import {
  VENDOR_ORDER_TRANSITIONS,
  getVendorDashboard,
} from "@/features/vendor/service";
import { updateVendorOrderStatusAction } from "@/server/vendor/actions";
import { formatJalali, formatPrice } from "@/lib/format";
import { VendorNav } from "@/components/VendorNav";
import { VendorSalesChart } from "@/components/VendorSalesChart";
import { VendorForbidden } from "@/components/VendorForbidden";
import type { Locale } from "@/i18n/routing";

/**
 * Vendor dashboard (Week 5): sales overview, top products and the
 * incoming order list with fulfilment actions. vendorId comes from
 * the session, never from the URL — a vendor sees only their own rows.
 */

const NEXT_STATUS_LABEL: Record<string, "markPreparing" | "markShipped" | "markDelivered"> = {
  PREPARING: "markPreparing",
  SHIPPED: "markShipped",
  DELIVERED: "markDelivered",
};

export default async function VendorDashboardPage({
  params,
}: {
  params: Promise<{ locale: Locale }>;
}) {
  const { locale } = await params;
  let session;
  try {
    session = await requireRole(["VENDOR"]);
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      redirect(`/${locale}/auth/login?next=/${locale}/vendor/dashboard`);
    }
    if (error instanceof ForbiddenError) return <VendorForbidden />;
    throw error;
  }
  const t = await getTranslations("vendor");
  const vendorId = session.vendorId;
  if (!vendorId) return <VendorForbidden />;
  const data = await getVendorDashboard(session);

  return (
    <div className="flex flex-col gap-6 pt-8" data-testid="vendor-dashboard" data-vendor-id={vendorId}>
      <VendorNav />
      <h1 className="text-2xl font-black text-ink-900">{t("dashboard")}</h1>

      {data.profile?.status === "PENDING" ? (
        <div
          role="status"
          data-testid="vendor-pending"
          className="rounded-2xl border border-amber-300 bg-amber-50 p-4"
        >
          <p className="text-sm font-bold text-amber-800">{t("pendingReview")}</p>
          <p className="mt-1 text-sm text-amber-700">{t("pendingReviewHint")}</p>
        </div>
      ) : null}

      {data.profile?.status === "REJECTED" ? (
        <div
          role="status"
          data-testid="vendor-rejected"
          className="rounded-2xl border border-red-300 bg-red-50 p-4"
        >
          <p className="text-sm font-bold text-red-800">{t("rejectedReview")}</p>
          {data.profile.rejectionReason ? (
            <p className="mt-1 text-sm text-red-700" data-testid="vendor-rejection-reason">
              {data.profile.rejectionReason}
            </p>
          ) : null}
        </div>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-2xl border border-cream-200 bg-white p-4">
          <p className="text-xs text-neutral-600">{t("revenue")}</p>
          <p className="mt-1 text-xl font-black text-ink-900" data-testid="vendor-stat-revenue">
            {formatPrice(data.revenue, locale)}
          </p>
        </div>
        <div className="rounded-2xl border border-cream-200 bg-white p-4">
          <p className="text-xs text-neutral-600">{t("orderCount")}</p>
          <p className="mt-1 text-xl font-black text-ink-900" data-testid="vendor-stat-orders">
            {data.orderCount.toLocaleString(locale === "fa" ? "fa-IR" : "en-US")}
          </p>
        </div>
        <div className="rounded-2xl border border-cream-200 bg-white p-4">
          <p className="text-xs text-neutral-600">{t("productCount")}</p>
          <p className="mt-1 text-xl font-black text-ink-900" data-testid="vendor-stat-products">
            {data.productCount.toLocaleString(locale === "fa" ? "fa-IR" : "en-US")}
          </p>
        </div>
      </div>

      <VendorSalesChart data={data.dailySales} locale={locale} label={t("dailySales")} />

      <section>
        <h2 className="text-lg font-bold text-ink-900">{t("topProducts")}</h2>
        {data.topProducts.length === 0 ? (
          <p className="mt-2 text-sm text-neutral-600">{t("noTopProducts")}</p>
        ) : (
          <ul className="mt-3 flex flex-col gap-2">
            {data.topProducts.map((product) => (
              <li
                key={product.productId}
                data-testid="vendor-top-product"
                className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-cream-200 bg-white p-4 text-sm"
              >
                <span className="font-bold text-ink-900">{product.title}</span>
                <span className="text-neutral-600">
                  {product.qty.toLocaleString(locale === "fa" ? "fa-IR" : "en-US")} ×{" "}
                  {formatPrice(product.gross, locale)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <h2 className="text-lg font-bold text-ink-900">{t("orders")}</h2>
        {data.orders.length === 0 ? (
          <p className="mt-2 text-sm text-neutral-600">{t("noOrders")}</p>
        ) : (
          <ul className="mt-3 flex flex-col gap-3">
            {data.orders.map((row) => {
              const next = (VENDOR_ORDER_TRANSITIONS[row.orderStatus] ?? [])[0];
              return (
                <li
                  key={`${row.orderId}-${row.productId}`}
                  className="rounded-2xl border border-cream-200 bg-white p-4"
                  data-testid="vendor-order-row"
                  data-order-id={row.orderId}
                >
                  <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
                    <span className="font-bold text-ink-900">
                      {row.title} × {row.qty}
                    </span>
                    <span className="text-xs text-neutral-600">{formatJalali(row.createdAt, locale)}</span>
                    <span className="font-bold">{formatPrice(row.gross, locale)}</span>
                    <span className="text-xs text-neutral-600">
                      {t("commission")}: {formatPrice(Math.round(row.gross * row.commissionRate), locale)}
                    </span>
                    <span
                      className="rounded-full bg-cream-100 px-3 py-1 text-xs font-bold"
                      data-testid="vendor-order-status"
                      data-status={row.orderStatus}
                    >
                      {row.orderStatus}
                    </span>
                    {next ? (
                      <form action={updateVendorOrderStatusAction}>
                        <input type="hidden" name="orderId" value={row.orderId} />
                        <input type="hidden" name="status" value={next} />
                        <button
                          type="submit"
                          data-testid="vendor-order-advance"
                          data-next-status={next}
                          className="cursor-pointer rounded-full bg-leaf-700 px-4 py-2 text-xs font-bold text-white hover:bg-leaf-800"
                        >
                          {t(NEXT_STATUS_LABEL[next])}
                        </button>
                      </form>
                    ) : null}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
