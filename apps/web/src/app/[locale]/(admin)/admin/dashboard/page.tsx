import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { ForbiddenError, UnauthorizedError, requireRole } from "@/lib/auth/guards";
import { getDataStore } from "@/server/store";
import { formatPrice } from "@/lib/format";
import type { Locale } from "@/i18n/routing";

/** Admin dashboard — real stats from the store (Week 3 scope). */
export default async function AdminDashboardPage({
  params,
}: {
  params: Promise<{ locale: Locale }>;
}) {
  const { locale } = await params;
  try {
    await requireRole(["ADMIN"]);
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      redirect(`/${locale}/auth/login?next=/${locale}/admin/dashboard`);
    }
    if (error instanceof ForbiddenError) {
      const t = await getTranslations("account");
      return (
        <div className="flex flex-col gap-4 pt-8" data-testid="admin-dashboard">
          <h1 className="text-2xl font-black text-ink-900">{t("forbidden")}</h1>
          <p className="text-sm text-neutral-600">{t("forbiddenHint")}</p>
        </div>
      );
    }
    throw error;
  }
  const t = await getTranslations("admin");
  const stats = await getDataStore().getAdminStats();

  return (
    <div className="flex flex-col gap-6 pt-8" data-testid="admin-dashboard">
      <h1 className="text-2xl font-black text-ink-900">{t("dashboard")}</h1>
      <dl className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {(
          [
            ["totalUsers", stats.totalUsers],
            ["totalOrders", stats.totalOrders],
            ["totalRevenue", formatPrice(stats.totalRevenue, locale)],
            ["pendingVendors", stats.pendingVendors],
          ] as const
        ).map(([key, value]) => (
          <div key={key} className="rounded-2xl border border-cream-200 bg-white p-4">
            <dt className="text-xs text-neutral-500">{t(key)}</dt>
            <dd className="text-xl font-black text-ink-900" data-testid={`admin-stat-${key}`}>{value}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
