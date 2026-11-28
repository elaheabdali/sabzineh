import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { getSession } from "@/lib/auth/guards";
import { listMyOrders } from "@/server/orders/service";
import { formatJalali, formatPrice } from "@/lib/format";
import type { Locale } from "@/i18n/routing";

/** Customer's own orders, newest first. */
export default async function OrdersPage({ params }: { params: Promise<{ locale: Locale }> }) {
  const { locale } = await params;
  const session = await getSession();
  if (!session) redirect(`/${locale}/auth/login?next=/${locale}/account/orders`);
  const t = await getTranslations("orders");
  const orders = await listMyOrders(session.id);

  return (
    <div className="flex flex-col gap-6 pt-8" data-testid="orders-page">
      <h1 className="text-2xl font-black text-ink-900">{t("title")}</h1>
      {orders.length === 0 ? (
        <div className="flex flex-col items-start gap-2">
          <p className="text-sm text-neutral-600">{t("empty")}</p>
          <p className="text-sm text-neutral-600">{t("emptyHint")}</p>
        </div>
      ) : (
        <ul className="flex flex-col gap-3">
          {orders.map((order) => (
            <li key={order.id} className="rounded-2xl border border-cream-200 bg-white p-4" data-testid="order-row">
              <Link href={`/account/orders/${order.id}`} className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-sm font-bold text-ink-900" data-testid="order-id">
                  {t("order")} #{order.id.slice(0, 8)}
                </span>
                <span className="text-xs text-neutral-600">{formatJalali(order.createdAt, locale)}</span>
                <span className="text-sm font-bold text-ink-900" data-testid="order-total">
                  {formatPrice(order.total, locale)}
                </span>
                <span
                  className="rounded-full bg-cream-100 px-3 py-1 text-xs font-bold text-ink-900"
                  data-testid="order-status"
                  data-status={order.status}
                >
                  {t(order.status.toLowerCase() as "paid" | "pending" | "cancelled")}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
