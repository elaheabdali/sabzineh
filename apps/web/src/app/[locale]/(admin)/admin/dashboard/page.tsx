import { useTranslations } from "next-intl";

/**
 * Admin dashboard — Week 1 placeholder.
 * Real auth lands in Week 3: this page will start with
 * `await requireRole(["ADMIN"])` from lib/auth/guards.
 */
export default function AdminDashboardPage() {
  const t = useTranslations("nav");
  return (
    <div className="flex flex-col gap-4 pt-8">
      <h1 className="text-2xl font-black text-ink-900">{t("adminPanel")}</h1>
      <p className="rounded-2xl border border-cream-200 bg-white p-6 text-sm leading-7 text-neutral-600">
        Week 6 wires reports (total sales, commission, top vendors), the approval
        queues and the category tree editor.
      </p>
    </div>
  );
}
