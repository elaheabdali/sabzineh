import { getTranslations } from "next-intl/server";
import { adminGuard } from "@/server/admin/page-guard";
import { listAdminPlans } from "@/server/admin/service";
import { createPlanAction, deletePlanAction, updatePlanAction } from "@/server/admin/actions";
import { AdminNav } from "@/components/AdminNav";
import { formatPrice } from "@/lib/format";
import type { Locale } from "@/i18n/routing";
import type { PlanRecord } from "@/server/billing/store";

/**
 * Admin plans (Phase 4): subscription plans are DB-backed and
 * managed here — create, edit price/period/features, delete when
 * unused. Vendor-plan features carry commissionRate + productLimit.
 */
function PlanForm({ plan, locale }: { plan?: PlanRecord; locale: Locale }) {
  const features = plan?.features ?? {};
  const inputClass = "rounded-xl border border-cream-200 bg-white px-3 py-2 text-sm";
  return (
    <form
      action={plan ? updatePlanAction : createPlanAction}
      className="grid gap-3 sm:grid-cols-3"
      data-testid={plan ? `plan-form-${plan.id}` : "plan-form-new"}
    >
      {plan ? <input type="hidden" name="planId" value={plan.id} /> : null}
      <label className="flex flex-col gap-1 text-sm">
        Kind
        <select name="kind" defaultValue={plan?.kind ?? "BOX"} className={inputClass}>
          <option value="BOX">BOX</option>
          <option value="VENDOR">VENDOR</option>
        </select>
      </label>
      <label className="flex flex-col gap-1 text-sm sm:col-span-2">
        Title
        <input name="title" required defaultValue={plan?.title ?? ""} className={inputClass} />
      </label>
      <label className="flex flex-col gap-1 text-sm">
        Price (Toman)
        <input name="price" type="number" min={0} required defaultValue={plan?.price ?? 0} className={inputClass} dir="ltr" />
      </label>
      <label className="flex flex-col gap-1 text-sm">
        Period (days)
        <input name="periodDays" type="number" min={1} required defaultValue={plan?.periodDays ?? 30} className={inputClass} dir="ltr" />
      </label>
      <label className="flex flex-col gap-1 text-sm">
        Commission rate (vendor)
        <input
          name="commissionRate"
          type="number"
          step="0.01"
          min={0}
          max={1}
          defaultValue={typeof features.commissionRate === "number" ? features.commissionRate : ""}
          className={inputClass}
          dir="ltr"
          placeholder="0.12"
        />
      </label>
      <label className="flex flex-col gap-1 text-sm">
        Max products (vendor)
        <input
          name="maxProducts"
          type="number"
          min={0}
          defaultValue={typeof features.maxProducts === "number" ? features.maxProducts : ""}
          className={inputClass}
          dir="ltr"
          placeholder="20"
        />
      </label>
      <div className="flex items-end gap-2">
        <button type="submit" className="cursor-pointer rounded-xl bg-leaf-600 px-4 py-2 text-sm font-bold text-white">
          {plan ? "Save" : "Create"}
        </button>
        {plan ? <span className="text-xs text-neutral-600">{formatPrice(plan.price, locale)}</span> : null}
      </div>
    </form>
  );
}

export default async function AdminPlansPage({
  params,
}: {
  params: Promise<{ locale: Locale }>;
}) {
  const { locale } = await params;
  const guard = await adminGuard(locale, `/${locale}/admin/plans`);
  if ("element" in guard) return guard.element;
  const t = await getTranslations("admin");
  const plans = await listAdminPlans();

  return (
    <div className="flex flex-col gap-8 pt-8" data-testid="admin-plans">
      <AdminNav />
      <h1 className="text-2xl font-black text-ink-900">{t("plans")}</h1>
      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-black text-ink-900">{t("createPlan")}</h2>
        <PlanForm locale={locale} />
      </section>
      <section className="flex flex-col gap-4">
        {plans.map((plan) => (
          <article key={plan.id} className="flex flex-col gap-3 rounded-2xl border border-cream-200 bg-white p-4">
            <p className="font-bold text-ink-900">
              {plan.title} <span className="text-xs text-neutral-600">({plan.kind})</span>
            </p>
            <PlanForm plan={plan} locale={locale} />
            <form action={deletePlanAction}>
              <input type="hidden" name="planId" value={plan.id} />
              <button
                type="submit"
                data-testid={`plan-delete-${plan.id}`}
                className="cursor-pointer rounded-full bg-red-50 px-3 py-1 text-xs font-bold text-red-700"
              >
                {t("deletePlan")}
              </button>
            </form>
          </article>
        ))}
      </section>
    </div>
  );
}
