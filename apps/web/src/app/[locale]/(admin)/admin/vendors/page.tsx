import { getTranslations } from "next-intl/server";
import { adminGuard } from "@/server/admin/page-guard";
import { listPendingVendors } from "@/server/admin/service";
import { AdminNav } from "@/components/AdminNav";
import { approveVendorAction } from "@/server/admin/actions";
import { RejectVendorForm } from "@/components/RejectVendorForm";
import type { Locale } from "@/i18n/routing";

/**
 * Vendor approval queue (Week 6): PENDING registration requests
 * with approve / reject-with-reason. Every action is audit-logged.
 */
export default async function AdminVendorsPage({
  params,
}: {
  params: Promise<{ locale: Locale }>;
}) {
  const { locale } = await params;
  const guard = await adminGuard(locale, `/${locale}/admin/vendors`);
  if ("element" in guard) return guard.element;
  const t = await getTranslations("admin");
  const pending = await listPendingVendors();

  return (
    <div className="flex flex-col gap-6 pt-8" data-testid="admin-vendors">
      <AdminNav />
      <h1 className="text-2xl font-black text-ink-900">{t("vendorQueue")}</h1>
      {pending.length === 0 ? (
        <p className="text-sm text-neutral-600">{t("noPendingVendors")}</p>
      ) : (
        <ul className="flex flex-col gap-3">
          {pending.map((vendor) => (
            <li
              key={vendor.id}
              className="flex flex-col gap-3 rounded-2xl border border-cream-200 bg-white p-4 text-sm"
              data-testid="admin-vendor-row"
              data-vendor-id={vendor.id}
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="font-bold text-ink-900">{vendor.shopName}</span>
                <span className="text-neutral-600">{vendor.city}</span>
                <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-bold text-amber-800">
                  {vendor.status}
                </span>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <form action={approveVendorAction}>
                  <input type="hidden" name="vendorId" value={vendor.id} />
                  <button
                    type="submit"
                    data-testid={`approve-vendor-${vendor.id}`}
                    className="cursor-pointer rounded-full bg-leaf-600 px-4 py-2 text-xs font-bold text-white"
                  >
                    {t("approve")}
                  </button>
                </form>
                <RejectVendorForm vendorId={vendor.id} />
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
