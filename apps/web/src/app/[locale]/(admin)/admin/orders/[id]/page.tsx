import { getTranslations } from "next-intl/server";
import { adminGuard } from "@/server/admin/page-guard";
import { getAdminOrderDetail } from "@/server/admin/service";
import { AdminNav } from "@/components/AdminNav";
import { formatPrice } from "@/lib/format";
import { Link } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";

/** Admin order detail (Week 6): read-only. */
export default async function AdminOrderDetailPage({
  params,
}: {
  params: Promise<{ locale: Locale; id: string }>;
}) {
  const { locale, id } = await params;
  const guard = await adminGuard(locale, `/${locale}/admin/orders/${id}`);
  if ("element" in guard) return guard.element;
  const t = await getTranslations("admin");
  const detail = await getAdminOrderDetail(id);
  if (!detail) {
    return (
      <div className="flex flex-col gap-6 pt-8" data-testid="admin-order-detail">
        <AdminNav />
        <p className="text-sm text-neutral-600">{t("noRecentOrders")}</p>
      </div>
    );
  }
  const { order } = detail;

  return (
    <div className="flex flex-col gap-6 pt-8" data-testid="admin-order-detail">
      <AdminNav />
      <h1 className="text-2xl font-black text-ink-900">{t("orderDetail")}</h1>
      <dl className="flex flex-col gap-2 rounded-2xl border border-cream-200 bg-white p-6 text-sm">
        <div className="flex justify-between">
          <dt className="text-neutral-500">{t("customer")}</dt>
          <dd className="font-bold text-ink-900">
            {detail.userName ?? "—"} ({detail.userEmail ?? "—"})
          </dd>
        </div>
        <div className="flex justify-between">
          <dt className="text-neutral-500">{t("status")}</dt>
          <dd className="font-bold text-ink-900" data-testid="admin-order-status">
            {order.status}
          </dd>
        </div>
        <div className="flex justify-between">
          <dt className="text-neutral-500">{t("total")}</dt>
          <dd className="font-bold text-ink-900">{formatPrice(order.total, locale)}</dd>
        </div>
      </dl>
      <ul className="flex flex-col gap-2">
        {detail.items.map((item) => (
          <li
            key={`${item.productId}-${item.vendorId}`}
            className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-cream-200 bg-white p-4 text-sm"
          >
            <span className="font-bold text-ink-900">{item.title}</span>
            <span className="text-neutral-600">
              ×{item.qty} · {formatPrice(item.unitPrice, locale)}
            </span>
            <span className="text-xs text-neutral-500">{item.vendorId}</span>
          </li>
        ))}
      </ul>
      <Link href="/admin/orders" className="w-fit rounded-xl bg-cream-100 px-4 py-2 text-sm font-bold text-ink-900">
        {t("back")}
      </Link>
    </div>
  );
}
