import { getTranslations } from "next-intl/server";
import { adminGuard } from "@/server/admin/page-guard";
import { getAdminDashboardData, listAdminUsers } from "@/server/admin/service";
import { AdminNav } from "@/components/AdminNav";
import { formatPrice } from "@/lib/format";
import { Link } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";

/**
 * Admin dashboard (Week 6): real stats (users, vendors, orders,
 * revenue), recent orders and low-stock alerts.
 */
export default async function AdminDashboardPage({
  params,
}: {
  params: Promise<{ locale: Locale }>;
}) {
  const { locale } = await params;
  const guard = await adminGuard(locale, `/${locale}/admin/dashboard`);
  if ("element" in guard) return guard.element;
  const t = await getTranslations("admin");
  const data = await getAdminDashboardData();
  const users = await listAdminUsers();
  const userById = new Map(users.map((u) => [u.id, u]));

  return (
    <div className="flex flex-col gap-6 pt-8" data-testid="admin-dashboard">
      <AdminNav />
      <h1 className="text-2xl font-black text-ink-900">{t("dashboard")}</h1>
      <dl className="grid grid-cols-2 gap-3 md:grid-cols-5">
        {(
          [
            ["totalUsers", data.stats.totalUsers],
            ["totalVendors", data.vendorCount],
            ["totalOrders", data.stats.totalOrders],
            ["totalRevenue", formatPrice(data.stats.totalRevenue, locale)],
            ["pendingVendors", data.stats.pendingVendors],
          ] as const
        ).map(([key, value]) => (
          <div key={key} className="rounded-2xl border border-cream-200 bg-white p-4">
            <dt className="text-xs text-neutral-500">{t(key)}</dt>
            <dd className="text-xl font-black text-ink-900" data-testid={`admin-stat-${key}`}>
              {value}
            </dd>
          </div>
        ))}
      </dl>

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-black text-ink-900">{t("recentOrders")}</h2>
        {data.recentOrders.length === 0 ? (
          <p className="text-sm text-neutral-600">{t("noRecentOrders")}</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {data.recentOrders.map((order) => (
              <li
                key={order.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-cream-200 bg-white p-4 text-sm"
                data-testid="admin-recent-order"
              >
                <span className="font-bold text-ink-900">#{order.id.slice(0, 8)}</span>
                <span className="text-neutral-600">{userById.get(order.userId)?.email ?? "—"}</span>
                <span className="rounded-full bg-cream-100 px-3 py-1 text-xs font-bold">
                  {order.status}
                </span>
                <span className="font-bold text-ink-900">{formatPrice(order.total, locale)}</span>
                <Link href={`/admin/orders/${order.id}`} className="font-bold text-leaf-700">
                  {t("viewDetail")}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-black text-ink-900">{t("lowStock")}</h2>
        {data.lowStock.length === 0 ? (
          <p className="text-sm text-neutral-600">{t("noLowStock")}</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {data.lowStock.map((product) => (
              <li
                key={product.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm"
                data-testid="admin-low-stock"
              >
                <span className="font-bold text-ink-900">{product.title}</span>
                <span className="text-amber-800">
                  {t("stock")}: {product.stock.toLocaleString(locale === "fa" ? "fa-IR" : "en-US")}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
