import { getTranslations } from "next-intl/server";
import { adminGuard } from "@/server/admin/page-guard";
import { getAdminUserDetail } from "@/server/admin/service";
import { AdminNav } from "@/components/AdminNav";
import { setUserStatusAction } from "@/server/admin/actions";
import { Link } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";

/** Admin user detail (Week 6): profile, role/status, orders, vendor profile. */
export default async function AdminUserDetailPage({
  params,
}: {
  params: Promise<{ locale: Locale; id: string }>;
}) {
  const { locale, id } = await params;
  const guard = await adminGuard(locale, `/${locale}/admin/users/${id}`);
  if ("element" in guard) return guard.element;
  const t = await getTranslations("admin");
  const detail = await getAdminUserDetail(id);
  if (!detail) {
    return (
      <div className="flex flex-col gap-6 pt-8" data-testid="admin-user-detail">
        <AdminNav />
        <p className="text-sm text-neutral-600">{t("noUsers")}</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6 pt-8" data-testid="admin-user-detail">
      <AdminNav />
      <h1 className="text-2xl font-black text-ink-900">{t("userDetail")}</h1>
      <dl className="flex flex-col gap-2 rounded-2xl border border-cream-200 bg-white p-6 text-sm">
        <div className="flex justify-between">
          <dt className="text-neutral-600">{t("name")}</dt>
          <dd className="font-bold text-ink-900">{detail.name}</dd>
        </div>
        <div className="flex justify-between">
          <dt className="text-neutral-600">{t("email")}</dt>
          <dd className="font-bold text-ink-900">{detail.email}</dd>
        </div>
        <div className="flex justify-between">
          <dt className="text-neutral-600">{t("role")}</dt>
          <dd className="font-bold text-ink-900">{detail.role}</dd>
        </div>
        <div className="flex justify-between">
          <dt className="text-neutral-600">{t("status")}</dt>
          <dd className="font-bold text-ink-900" data-testid="admin-user-status">
            {detail.status}
          </dd>
        </div>
        <div className="flex justify-between">
          <dt className="text-neutral-600">{t("ordersCount")}</dt>
          <dd className="font-bold text-ink-900">{detail.orderCount}</dd>
        </div>
      </dl>
      {detail.vendor ? (
        <div className="rounded-2xl border border-cream-200 bg-white p-6 text-sm">
          <h2 className="font-black text-ink-900">{t("vendorProfile")}</h2>
          <p className="mt-2 text-neutral-600">
            {detail.vendor.shopName} — {detail.vendor.city} — {detail.vendor.status}
          </p>
        </div>
      ) : (
        <p className="text-sm text-neutral-600">{t("noVendorProfile")}</p>
      )}
      <div className="flex gap-2">
        <form action={setUserStatusAction}>
          <input type="hidden" name="userId" value={detail.id} />
          <input
            type="hidden"
            name="status"
            value={detail.status === "SUSPENDED" ? "ACTIVE" : "SUSPENDED"}
          />
          <button
            type="submit"
            className="cursor-pointer rounded-xl bg-leaf-600 px-4 py-2 text-sm font-bold text-white"
          >
            {detail.status === "SUSPENDED" ? t("activate") : t("suspend")}
          </button>
        </form>
        <Link href="/admin/users" className="rounded-xl bg-cream-100 px-4 py-2 text-sm font-bold text-ink-900">
          {t("back")}
        </Link>
      </div>
    </div>
  );
}
