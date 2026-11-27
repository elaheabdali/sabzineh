import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { ForbiddenError, UnauthorizedError, requireRole } from "@/lib/auth/guards";
import { getDataStore } from "@/server/store";
import { formatJalali, formatPrice } from "@/lib/format";
import type { Locale } from "@/i18n/routing";

/**
 * Vendor dashboard — incoming order items for the signed-in vendor
 * only. vendorId comes from the session, never from the URL, so a
 * vendor cannot see another vendor's rows by changing a parameter.
 */
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
    if (error instanceof ForbiddenError) {
      const t = await getTranslations("account");
      return (
        <div className="flex flex-col gap-4 pt-8" data-testid="vendor-dashboard">
          <h1 className="text-2xl font-black text-ink-900">{t("forbidden")}</h1>
          <p className="text-sm text-neutral-600">{t("forbiddenHint")}</p>
        </div>
      );
    }
    throw error;
  }
  const t = await getTranslations("vendor");
  const vendorId = session.vendorId;
  if (!vendorId) {
    const tAccount = await getTranslations("account");
    return (
      <div className="flex flex-col gap-4 pt-8" data-testid="vendor-dashboard">
        <h1 className="text-2xl font-black text-ink-900">{tAccount("forbidden")}</h1>
      </div>
    );
  }
  const rows = await getDataStore().listVendorOrderItems(vendorId);

  return (
    <div className="flex flex-col gap-6 pt-8" data-testid="vendor-dashboard" data-vendor-id={vendorId}>
      <h1 className="text-2xl font-black text-ink-900">{t("dashboard")}</h1>
      <h2 className="text-lg font-bold text-ink-900">{t("orders")}</h2>
      {rows.length === 0 ? (
        <p className="text-sm text-neutral-600">{t("noOrders")}</p>
      ) : (
        <ul className="flex flex-col gap-3">
          {rows.map((row) => (
            <li
              key={`${row.orderId}-${row.productId}`}
              className="rounded-2xl border border-cream-200 bg-white p-4"
              data-testid="vendor-order-row"
              data-order-id={row.orderId}
            >
              <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
                <span className="font-bold text-ink-900">{row.title} × {row.qty}</span>
                <span className="text-xs text-neutral-500">{formatJalali(row.createdAt, locale)}</span>
                <span className="font-bold">{formatPrice(row.gross, locale)}</span>
                <span className="text-xs text-neutral-500">
                  {t("commission")}: {formatPrice(Math.round(row.gross * row.commissionRate), locale)}
                </span>
                <span className="rounded-full bg-cream-100 px-3 py-1 text-xs font-bold" data-testid="vendor-order-status">
                  {row.orderStatus}
                </span>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
