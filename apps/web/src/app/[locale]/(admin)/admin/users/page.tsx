import { useTranslations } from "next-intl";

/**
 * Admin users — Week 1 placeholder.
 * Week 6 wires the DataTable from @sabzineh/ui with server pagination,
 * search and bulk approve/suspend — every action logged to AuditLog.
 */
export default function AdminUsersPage() {
  const t = useTranslations("nav");
  return (
    <div className="flex flex-col gap-4 pt-8">
      <h1 className="text-2xl font-black text-ink-900">{t("adminPanel")}</h1>
      <p className="rounded-2xl border border-cream-200 bg-white p-6 text-sm leading-7 text-neutral-600">
        Week 6 wires the user data table with server pagination, search, column
        filters and bulk actions.
      </p>
    </div>
  );
}
