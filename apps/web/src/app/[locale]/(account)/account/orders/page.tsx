import { useTranslations } from "next-intl";

/**
 * Orders — Week 1 placeholder.
 * Real auth lands in Week 3: this page will start with
 * `await requireRole(["CUSTOMER"])` from lib/auth/guards. Until then
 * it renders the panel shell so the route group structure is real.
 */
export default function OrdersPage() {
  const t = useTranslations("nav");
  return (
    <div className="flex flex-col gap-4 pt-8">
      <h1 className="text-2xl font-black text-ink-900">{t("orders")}</h1>
      <p className="rounded-2xl border border-cream-200 bg-white p-6 text-sm leading-7 text-neutral-600">
        Week 3 wires real orders from the database, with live status tracking over SSE.
      </p>
    </div>
  );
}
