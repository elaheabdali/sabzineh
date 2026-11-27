import { getTranslations } from "next-intl/server";
import { adminGuard } from "@/server/admin/page-guard";
import { listAdminOrders } from "@/server/admin/service";
import { AdminNav } from "@/components/AdminNav";
import { formatPrice } from "@/lib/format";
import { Link } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";
import type { OrderStatus } from "@/server/store";

/** Admin order oversight (Week 6): every order with status/vendor/date filters. */
export default async function AdminOrdersPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: Locale }>;
  searchParams: Promise<{ status?: string; vendorId?: string }>;
}) {
  const { locale } = await params;
  const { status, vendorId } = await searchParams;
  const guard = await adminGuard(locale, `/${locale}/admin/orders`);
  if ("element" in guard) return guard.element;
  const t = await getTranslations("admin");
  const validStatuses: OrderStatus[] = [
    "PENDING",
    "PAID",
    "PREPARING",
    "SHIPPED",
    "DELIVERED",
    "CANCELLED",
    "REFUNDED",
  ];
  const rows = await listAdminOrders({
    status: validStatuses.includes(status as OrderStatus) ? (status as OrderStatus) : undefined,
    vendorId: vendorId && vendorId !== "" ? vendorId : undefined,
  });

  return (
    <div className="flex flex-col gap-6 pt-8" data-testid="admin-orders">
      <AdminNav />
      <h1 className="text-2xl font-black text-ink-900">{t("orders")}</h1>
      <form method="get" className="flex flex-wrap gap-2" data-testid="admin-orders-filter">
        <select
          name="status"
          defaultValue={status ?? ""}
          aria-label={t("status")}
          className="rounded-xl border border-cream-200 bg-white px-3 py-2 text-sm"
        >
          <option value="">{t("allRoles")}</option>
          {validStatuses.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
        <input
          type="text"
          name="vendorId"
          defaultValue={vendorId ?? ""}
          placeholder="vendorId"
          aria-label="vendorId"
          className="rounded-xl border border-cream-200 bg-white px-3 py-2 text-sm"
        />
        <button
          type="submit"
          className="cursor-pointer rounded-xl bg-leaf-600 px-4 py-2 text-sm font-bold text-white"
        >
          {t("search")}
        </button>
      </form>
      {rows.length === 0 ? (
        <p className="text-sm text-neutral-600">{t("noRecentOrders")}</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {rows.map(({ order, userEmail }) => (
            <li
              key={order.id}
              className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-cream-200 bg-white p-4 text-sm"
              data-testid="admin-order-row"
              data-order-id={order.id}
            >
              <span className="font-bold text-ink-900">#{order.id.slice(0, 8)}</span>
              <span className="text-neutral-600">{userEmail ?? "—"}</span>
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
    </div>
  );
}
