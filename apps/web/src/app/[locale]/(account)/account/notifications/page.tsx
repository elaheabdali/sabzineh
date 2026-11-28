import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { getSession } from "@/lib/auth/guards";
import { getDataStore } from "@/server/store";
import { formatJalali } from "@/lib/format";
import { MarkAllReadButton } from "@/components/MarkAllReadButton";
import type { Locale } from "@/i18n/routing";

const TYPE_LABEL: Record<string, string> = {
  "order-status": "orderStatus",
  "order-paid": "orderPaid",
  "box-generated": "boxGenerated",
  "vendor-approved": "vendorApproved",
  "vendor-rejected": "vendorRejected",
  "payout-status": "payoutStatus",
};

/**
 * Notifications center (Week 7): the logged-in user's own
 * notifications, newest first, with a mark-all-read action. The same
 * rows feed the header bell and the SSE stream.
 */
export default async function NotificationsPage({
  params,
}: {
  params: Promise<{ locale: Locale }>;
}) {
  const { locale } = await params;
  const session = await getSession();
  if (!session) redirect(`/${locale}/auth/login?next=/${locale}/account/notifications`);
  const t = await getTranslations("notifications");
  const store = getDataStore();
  const [notifications, unread] = await Promise.all([
    store.listNotifications(session.id),
    store.countUnreadNotifications(session.id),
  ]);

  return (
    <div className="flex flex-col gap-6 pt-8" data-testid="notifications-page">
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-2xl font-black text-ink-900">{t("title")}</h1>
        {unread > 0 ? <MarkAllReadButton /> : null}
      </div>
      {notifications.length === 0 ? (
        <p className="text-sm text-neutral-600">{t("empty")}</p>
      ) : (
        <ul className="flex flex-col gap-3">
          {notifications.map((item) => (
            <li
              key={item.id}
              data-testid="notification-item"
              data-type={item.type}
              data-read={item.readAt !== null}
              className={`rounded-2xl border p-4 ${
                item.readAt ? "border-cream-200 bg-white" : "border-leaf-200 bg-leaf-100/50"
              }`}
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-sm font-bold text-ink-900">
                  {t(TYPE_LABEL[item.type] ?? "title")}
                </span>
                <span className="text-xs text-neutral-600">{formatJalali(item.createdAt, locale)}</span>
              </div>
              <p className="mt-2 text-sm leading-7 text-neutral-600">
                {typeof item.payload.orderId === "string" ? (
                  <Link
                    href={`/account/orders/${item.payload.orderId}`}
                    className="font-medium text-leaf-700 hover:underline"
                  >
                    #{item.payload.orderId.slice(0, 8)}
                  </Link>
                ) : typeof item.payload.shopName === "string" ? (
                  item.payload.shopName
                ) : null}
                {typeof item.payload.status === "string" ? ` — ${item.payload.status}` : ""}
                {typeof item.payload.reason === "string" ? ` — ${item.payload.reason}` : ""}
              </p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
