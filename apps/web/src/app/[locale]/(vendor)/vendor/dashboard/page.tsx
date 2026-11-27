import { useTranslations } from "next-intl";

/**
 * Vendor dashboard — Week 1 placeholder.
 * Real auth lands in Week 3: this page will start with
 * `await requireRole(["VENDOR"])` from lib/auth/guards.
 */
export default function VendorDashboardPage() {
  const t = useTranslations("nav");
  return (
    <div className="flex flex-col gap-4 pt-8">
      <h1 className="text-2xl font-black text-ink-900">{t("vendorPanel")}</h1>
      <p className="rounded-2xl border border-cream-200 bg-white p-6 text-sm leading-7 text-neutral-600">
        Week 5 wires sales charts, incoming orders and payouts — scoped to the
        signed-in vendor only, filtered server-side by vendorId.
      </p>
    </div>
  );
}
