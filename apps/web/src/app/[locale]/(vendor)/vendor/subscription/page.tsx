import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { ForbiddenError, UnauthorizedError, requireRole } from "@/lib/auth/guards";
import { getDataStore } from "@/server/store";
import { listPlans } from "@/server/billing/plans";
import { getVendorPlanInfo } from "@/server/billing/subscriptions";
import { listPayoutsForVendor, computePayout } from "@/server/billing/payouts";
import { getVendorDashboard } from "@/features/vendor/service";
import { SubscribeVendorPlanForm } from "@/components/SubscribeVendorPlanForm";
import { requestPayoutAction } from "@/server/billing/actions";
import { VendorNav } from "@/components/VendorNav";
import { VendorForbidden } from "@/components/VendorForbidden";
import { formatJalali, formatPrice } from "@/lib/format";
import type { Locale } from "@/i18n/routing";

/**
 * Vendor subscription + payouts (Week 6): selling plans (basic /
 * pro) with the commission rate and product cap they set, and the
 * payout request flow for delivered items.
 */
export default async function VendorSubscriptionPage({
  params,
}: {
  params: Promise<{ locale: Locale }>;
}) {
  const { locale } = await params;
  let session;
  try {
    session = await requireRole(["VENDOR"]);
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      redirect(`/${locale}/auth/login?next=/${locale}/vendor/subscription`);
    }
    if (error instanceof ForbiddenError) return <VendorForbidden />;
    throw error;
  }
  const t = await getTranslations("subscription");
  const tVendor = await getTranslations("vendor");
  const tAdmin = await getTranslations("admin");
  if (!session.vendorId) return <VendorForbidden />;
  const vendorId = session.vendorId;
  const [plans, planInfo, payouts, dashboard, walletBalance] = await Promise.all([
    listPlans("VENDOR"),
    getVendorPlanInfo(vendorId),
    listPayoutsForVendor(vendorId),
    getVendorDashboard(session),
    getDataStore().getWalletBalance(session.id),
  ]);
  const periodEnd = new Date();
  const periodStart = new Date(periodEnd.getTime() - 30 * 24 * 60 * 60 * 1000);
  const preview = await computePayout(vendorId, periodStart, periodEnd);
  const maxProducts =
    typeof planInfo?.plan.features.maxProducts === "number"
      ? planInfo.plan.features.maxProducts
      : 20;
  const commissionRate =
    typeof planInfo?.plan.features.commissionRate === "number"
      ? planInfo.plan.features.commissionRate
      : 0.12;

  return (
    <div className="flex flex-col gap-6 pt-8" data-testid="vendor-subscription">
      <VendorNav />
      <h1 className="text-2xl font-black text-ink-900">{tVendor("subscription")}</h1>
      <p className="text-sm text-neutral-600">
        {tVendor("walletBalance")}: {formatPrice(walletBalance, locale)}
      </p>

      <section className="flex flex-col gap-3 rounded-2xl border border-cream-200 bg-white p-6">
        <h2 className="text-lg font-black text-ink-900">{t("currentPlan")}</h2>
        {planInfo ? (
          <div className="flex flex-col gap-2 text-sm" data-testid="current-vendor-plan">
            <p className="font-bold text-ink-900">{planInfo.plan.title}</p>
            <p className="text-neutral-600">
              {tVendor("commission")}: {(commissionRate * 100).toLocaleString(locale === "fa" ? "fa-IR" : "en-US")}% ·{" "}
              {tVendor("productLimit")}: {dashboard.productCount}/{maxProducts}
            </p>
            <p className="text-neutral-600">
              {t("currentPeriodEnd")}: {formatJalali(planInfo.subscription.currentPeriodEnd, locale)}
            </p>
          </div>
        ) : (
          <p className="text-sm text-neutral-600" data-testid="current-vendor-plan">
            {tVendor("noPlan")}
          </p>
        )}
      </section>

      {!planInfo ? (
        <section className="flex flex-col gap-3">
          <h2 className="text-lg font-black text-ink-900">{t("vendorPlans")}</h2>
          <div className="grid gap-3 md:grid-cols-2">
            {plans.map((plan) => (
              <div
                key={plan.id}
                className="flex flex-col gap-3 rounded-2xl border border-cream-200 bg-white p-6"
                data-testid="vendor-plan"
                data-plan-id={plan.id}
              >
                <h3 className="font-black text-ink-900">{plan.title}</h3>
                <p className="text-sm text-neutral-600">
                  {formatPrice(plan.price, locale)} · {plan.periodDays} {t("periodDays")}
                </p>
                <p className="text-sm text-neutral-600">
                  {tVendor("commission")}:{" "}
                  {typeof plan.features.commissionRate === "number"
                    ? `${(plan.features.commissionRate * 100).toLocaleString(locale === "fa" ? "fa-IR" : "en-US")}%`
                    : "—"}{" "}
                  · {tVendor("productLimit")}:{" "}
                  {typeof plan.features.maxProducts === "number" ? plan.features.maxProducts : "—"}
                </p>
                <SubscribeVendorPlanForm
                  planId={plan.id}
                  priceLabel={formatPrice(plan.price, locale)}
                  locale={locale}
                />
              </div>
            ))}
          </div>
        </section>
      ) : null}

      <section className="flex flex-col gap-3 rounded-2xl border border-cream-200 bg-white p-6">
        <h2 className="text-lg font-black text-ink-900">{tVendor("payouts")}</h2>
        <p className="text-sm text-neutral-600">{tVendor("payoutHint")}</p>
        <p className="text-sm text-neutral-600" data-testid="payout-preview">
          {tAdmin("net")}: {formatPrice(preview.net, locale)} · {tAdmin("gross")}:{" "}
          {formatPrice(preview.gross, locale)} · {tAdmin("commission")}:{" "}
          {formatPrice(preview.commission, locale)}
        </p>
        {preview.net > 0 ? (
          <form action={requestPayoutAction}>
            <button
              type="submit"
              data-testid="request-payout"
              className="cursor-pointer rounded-full bg-leaf-600 px-4 py-2 text-xs font-bold text-white"
            >
              {tVendor("requestPayout")}
            </button>
          </form>
        ) : null}
        {payouts.length === 0 ? (
          <p className="text-sm text-neutral-600">{tVendor("noPayouts")}</p>
        ) : (
          <ul className="flex flex-col gap-2 text-sm">
            {payouts.map((payout) => (
              <li
                key={payout.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-cream-100 p-3"
                data-testid="vendor-payout-row"
                data-payout-status={payout.status}
              >
                <span className="font-bold text-ink-900">{formatPrice(payout.net, locale)}</span>
                <span className="text-neutral-600">
                  {formatJalali(payout.periodStart, locale)} — {formatJalali(payout.periodEnd, locale)}
                </span>
                <span className="rounded-full bg-cream-100 px-3 py-1 text-xs font-bold">
                  {tVendor(payout.status.toLowerCase() as "requested" | "approved" | "paid" | "pending")}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
