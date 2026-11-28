import { getTranslations } from "next-intl/server";
import { adminGuard } from "@/server/admin/page-guard";
import { getAdminReports } from "@/server/admin/service";
import { AdminNav } from "@/components/AdminNav";
import { formatPrice } from "@/lib/format";
import type { Locale } from "@/i18n/routing";

/**
 * Admin reports (Phase 3): revenue, order status breakdown, payout
 * totals and top vendors, with CSV exports for orders and payouts.
 * The export links hit /api/admin/export/<kind>, which re-checks
 * the ADMIN role before streaming the file.
 */
export default async function AdminReportsPage({
  params,
}: {
  params: Promise<{ locale: Locale }>;
}) {
  const { locale } = await params;
  const guard = await adminGuard(locale, `/${locale}/admin/reports`);
  if ("element" in guard) return guard.element;
  const t = await getTranslations("admin");
  const reports = await getAdminReports();

  return (
    <div className="flex flex-col gap-6 pt-8" data-testid="admin-reports">
      <AdminNav />
      <h1 className="text-2xl font-black text-ink-900">{t("reports")}</h1>

      <div className="flex flex-wrap gap-2">
        <a
          href="/api/admin/export/orders"
          className="rounded-full bg-leaf-600 px-4 py-2 text-sm font-bold text-white"
          data-testid="export-orders"
        >
          {t("exportOrders")}
        </a>
        <a
          href="/api/admin/export/payouts"
          className="rounded-full bg-cream-100 px-4 py-2 text-sm font-bold text-ink-900"
          data-testid="export-payouts"
        >
          {t("exportPayouts")}
        </a>
      </div>

      <section className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-2xl border border-cream-200 bg-white p-4">
          <p className="text-xs text-neutral-600">{t("totalRevenue")}</p>
          <p className="mt-1 text-xl font-black text-ink-900">{formatPrice(reports.revenue, locale)}</p>
        </div>
        <div className="rounded-2xl border border-cream-200 bg-white p-4">
          <p className="text-xs text-neutral-600">{t("paidPayouts")}</p>
          <p className="mt-1 text-xl font-black text-ink-900">
            {reports.payouts.paid} — {formatPrice(reports.payouts.paidNet, locale)}
          </p>
        </div>
        <div className="rounded-2xl border border-cream-200 bg-white p-4">
          <p className="text-xs text-neutral-600">{t("pendingPayouts")}</p>
          <p className="mt-1 text-xl font-black text-ink-900">
            {reports.payouts.requested + reports.payouts.approved}
          </p>
        </div>
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="text-lg font-black text-ink-900">{t("ordersByStatus")}</h2>
        <ul className="flex flex-wrap gap-2">
          {Object.entries(reports.ordersByStatus).map(([status, count]) => (
            <li key={status} className="rounded-full bg-cream-100 px-3 py-1 text-sm text-ink-900">
              {status}: {count}
            </li>
          ))}
        </ul>
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="text-lg font-black text-ink-900">{t("topVendors")}</h2>
        <ul className="flex flex-col gap-1">
          {reports.topVendors.map((vendor) => (
            <li key={vendor.vendorId} className="flex justify-between rounded-xl bg-white px-4 py-2 text-sm">
              <span className="font-bold text-ink-900">{vendor.shopName ?? vendor.vendorId}</span>
              <span>{formatPrice(vendor.gross, locale)}</span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
