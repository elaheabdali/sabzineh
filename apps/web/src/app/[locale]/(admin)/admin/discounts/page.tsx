import { getTranslations } from "next-intl/server";
import { adminGuard } from "@/server/admin/page-guard";
import { listAdminDiscounts } from "@/server/admin/service";
import { AdminNav } from "@/components/AdminNav";
import {
  createDiscountAction,
  deleteDiscountAction,
  updateDiscountAction,
} from "@/server/admin/actions";
import type { Locale } from "@/i18n/routing";

/**
 * Admin discount codes (Week 6): CRUD. Server-side validation from
 * Week 3 is reused (usage cap, min amount, expiry, once per user).
 * A code that was ever used cannot be deleted.
 */
export default async function AdminDiscountsPage({
  params,
}: {
  params: Promise<{ locale: Locale }>;
}) {
  const { locale } = await params;
  const guard = await adminGuard(locale, `/${locale}/admin/discounts`);
  if ("element" in guard) return guard.element;
  const t = await getTranslations("admin");
  const discounts = await listAdminDiscounts();
  const toDateInput = (d: Date | null): string => (d ? d.toISOString().slice(0, 10) : "");

  return (
    <div className="flex flex-col gap-6 pt-8" data-testid="admin-discounts">
      <AdminNav />
      <h1 className="text-2xl font-black text-ink-900">{t("discounts")}</h1>

      <form
        action={createDiscountAction}
        className="flex flex-wrap items-end gap-2 rounded-2xl border border-cream-200 bg-white p-4"
        data-testid="create-discount-form"
      >
        <label className="flex flex-col gap-1 text-xs font-bold text-neutral-600">
          {t("code")}
          <input
            type="text"
            name="code"
            required
            pattern="[A-Z0-9][A-Z0-9-]{2,19}"
            placeholder="SABZ20"
            className="rounded-xl border border-cream-200 px-3 py-2 text-sm font-normal uppercase"
          />
        </label>
        <label className="flex flex-col gap-1 text-xs font-bold text-neutral-600">
          {t("type")}
          <select name="type" className="rounded-xl border border-cream-200 px-3 py-2 text-sm font-normal">
            <option value="PERCENT">{t("percent")}</option>
            <option value="FIXED">{t("fixed")}</option>
          </select>
        </label>
        <label className="flex flex-col gap-1 text-xs font-bold text-neutral-600">
          {t("value")}
          <input
            type="number"
            name="value"
            required
            min={1}
            className="w-24 rounded-xl border border-cream-200 px-3 py-2 text-sm font-normal"
          />
        </label>
        <label className="flex flex-col gap-1 text-xs font-bold text-neutral-600">
          {t("minAmount")}
          <input
            type="number"
            name="minAmount"
            defaultValue={0}
            min={0}
            className="w-28 rounded-xl border border-cream-200 px-3 py-2 text-sm font-normal"
          />
        </label>
        <label className="flex flex-col gap-1 text-xs font-bold text-neutral-600">
          {t("usageLimit")}
          <input
            type="number"
            name="usageLimit"
            min={1}
            placeholder={t("noExpiry")}
            className="w-24 rounded-xl border border-cream-200 px-3 py-2 text-sm font-normal"
          />
        </label>
        <label className="flex flex-col gap-1 text-xs font-bold text-neutral-600">
          {t("expiresAt")}
          <input
            type="date"
            name="expiresAt"
            className="rounded-xl border border-cream-200 px-3 py-2 text-sm font-normal"
          />
        </label>
        <button
          type="submit"
          className="cursor-pointer rounded-xl bg-leaf-600 px-4 py-2 text-sm font-bold text-white"
        >
          {t("createDiscount")}
        </button>
      </form>

      {discounts.length === 0 ? (
        <p className="text-sm text-neutral-600">{t("noDiscounts")}</p>
      ) : (
        <ul className="flex flex-col gap-3">
          {discounts.map((discount) => (
            <li
              key={discount.id}
              className="rounded-2xl border border-cream-200 bg-white p-4"
              data-testid="admin-discount-row"
              data-discount-code={discount.code}
            >
              <form action={updateDiscountAction} className="flex flex-wrap items-center gap-2 text-sm">
                <input type="hidden" name="id" value={discount.id} />
                <input
                  type="text"
                  name="code"
                  defaultValue={discount.code}
                  aria-label={t("code")}
                  className="w-28 rounded-xl border border-cream-200 px-2 py-1 text-sm font-bold"
                />
                <select
                  name="type"
                  defaultValue={discount.type}
                  aria-label={t("type")}
                  className="rounded-xl border border-cream-200 px-2 py-1 text-sm"
                >
                  <option value="PERCENT">{t("percent")}</option>
                  <option value="FIXED">{t("fixed")}</option>
                </select>
                <input
                  type="number"
                  name="value"
                  defaultValue={discount.value}
                  aria-label={t("value")}
                  className="w-20 rounded-xl border border-cream-200 px-2 py-1 text-sm"
                />
                <input
                  type="number"
                  name="minAmount"
                  defaultValue={discount.minAmount}
                  aria-label={t("minAmount")}
                  className="w-24 rounded-xl border border-cream-200 px-2 py-1 text-sm"
                />
                <input
                  type="number"
                  name="usageLimit"
                  defaultValue={discount.usageLimit ?? ""}
                  aria-label={t("usageLimit")}
                  className="w-20 rounded-xl border border-cream-200 px-2 py-1 text-sm"
                />
                <input
                  type="date"
                  name="expiresAt"
                  defaultValue={toDateInput(discount.expiresAt)}
                  aria-label={t("expiresAt")}
                  className="rounded-xl border border-cream-200 px-2 py-1 text-sm"
                />
                <span className="text-xs text-neutral-500">
                  {t("usedCount")}: {discount.usedCount}
                </span>
                <button
                  type="submit"
                  data-testid={`save-discount-${discount.code}`}
                  className="cursor-pointer rounded-full bg-leaf-600 px-3 py-1 text-xs font-bold text-white"
                >
                  {t("save")}
                </button>
              </form>
              <form action={deleteDiscountAction} className="mt-2">
                <input type="hidden" name="id" value={discount.id} />
                <button
                  type="submit"
                  data-testid={`delete-discount-${discount.code}`}
                  className="cursor-pointer rounded-full bg-red-600 px-3 py-1 text-xs font-bold text-white"
                >
                  {t("deleteDiscount")}
                </button>
              </form>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
