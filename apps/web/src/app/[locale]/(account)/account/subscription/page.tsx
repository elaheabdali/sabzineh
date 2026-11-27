import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { getSession } from "@/lib/auth/guards";
import { getDataStore } from "@/server/store";
import { listPlans } from "@/server/billing/plans";
import { listMySubscriptions } from "@/server/billing/subscriptions";
import { SubscribeBoxForm } from "@/components/SubscribeBoxForm";
import {
  cancelSubscriptionAction,
  pauseSubscriptionAction,
  resumeSubscriptionAction,
  skipWeekAction,
} from "@/server/billing/actions";
import { formatJalali, formatPrice } from "@/lib/format";
import { Link } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";

/**
 * My subscription (Week 6): weekly box plans, the current
 * subscription with pause / skip-a-week / resume / cancel, the
 * upcoming deliveries and the invoices.
 */
export default async function AccountSubscriptionPage({
  params,
}: {
  params: Promise<{ locale: Locale }>;
}) {
  const { locale } = await params;
  const session = await getSession();
  if (!session) redirect(`/${locale}/auth/login?next=/${locale}/account/subscription`);
  const t = await getTranslations("subscription");
  const tAccount = await getTranslations("account");
  const [plans, subscriptions, addresses, walletBalance] = await Promise.all([
    Promise.resolve(listPlans("BOX")),
    listMySubscriptions(session.id),
    getDataStore().listAddresses(session.id),
    getDataStore().getWalletBalance(session.id),
  ]);
  const activeBox = subscriptions.find((s) => s.subscription.status === "ACTIVE");
  const pausedBox = subscriptions.find((s) => s.subscription.status === "PAUSED");

  return (
    <div className="flex flex-col gap-6 pt-8" data-testid="subscription-page">
      <h1 className="text-2xl font-black text-ink-900">{t("title")}</h1>
      <p className="text-sm text-neutral-600">{t("subscribeHint")}</p>
      <p className="text-sm text-neutral-600">
        {tAccount("walletBalance")}: {formatPrice(walletBalance, locale)}
      </p>

      {activeBox || pausedBox ? (
        <section className="flex flex-col gap-3 rounded-2xl border border-cream-200 bg-white p-6">
          <h2 className="text-lg font-black text-ink-900">{t("currentSubscription")}</h2>
          {(() => {
            const current = activeBox ?? pausedBox!;
            const nextDelivery = current.deliveries
              .filter((d) => d.status === "SCHEDULED")
              .sort((a, b) => a.weekStart.getTime() - b.weekStart.getTime())[0];
            return (
              <div className="flex flex-col gap-2 text-sm" data-testid="current-subscription">
                <p className="font-bold text-ink-900">{current.plan.title}</p>
                <p className="text-neutral-600">
                  {t("status")}:{" "}
                  <span data-testid="subscription-status">{current.subscription.status}</span>
                </p>
                <p className="text-neutral-600">
                  {t("currentPeriodEnd")}: {formatJalali(current.subscription.currentPeriodEnd, locale)}
                </p>
                {nextDelivery ? (
                  <p className="text-neutral-600">
                    {t("nextDelivery")}: {formatJalali(nextDelivery.weekStart, locale)}
                  </p>
                ) : null}
                <div className="flex flex-wrap gap-2">
                  {current.subscription.status === "ACTIVE" ? (
                    <>
                      <form action={pauseSubscriptionAction}>
                        <input type="hidden" name="subscriptionId" value={current.subscription.id} />
                        <button
                          type="submit"
                          data-testid="pause-subscription"
                          className="cursor-pointer rounded-full bg-cream-100 px-4 py-2 text-xs font-bold text-ink-900"
                        >
                          {t("pause")}
                        </button>
                      </form>
                      <form action={skipWeekAction}>
                        <input type="hidden" name="subscriptionId" value={current.subscription.id} />
                        <button
                          type="submit"
                          data-testid="skip-week"
                          className="cursor-pointer rounded-full bg-cream-100 px-4 py-2 text-xs font-bold text-ink-900"
                        >
                          {t("skipWeek")}
                        </button>
                      </form>
                    </>
                  ) : null}
                  {current.subscription.status === "PAUSED" ? (
                    <form action={resumeSubscriptionAction}>
                      <input type="hidden" name="subscriptionId" value={current.subscription.id} />
                      <button
                        type="submit"
                        data-testid="resume-subscription"
                        className="cursor-pointer rounded-full bg-leaf-600 px-4 py-2 text-xs font-bold text-white"
                      >
                        {t("resume")}
                      </button>
                    </form>
                  ) : null}
                  <form action={cancelSubscriptionAction}>
                    <input type="hidden" name="subscriptionId" value={current.subscription.id} />
                    <button
                      type="submit"
                      data-testid="cancel-subscription"
                      className="cursor-pointer rounded-full bg-red-600 px-4 py-2 text-xs font-bold text-white"
                    >
                      {t("cancel")}
                    </button>
                  </form>
                </div>
                <h3 className="mt-2 font-black text-ink-900">{t("deliveries")}</h3>
                {current.deliveries.length === 0 ? (
                  <p className="text-neutral-600">{t("noDeliveries")}</p>
                ) : (
                  <ul className="flex flex-col gap-1">
                    {current.deliveries.map((d) => (
                      <li
                        key={d.id}
                        className="flex justify-between"
                        data-testid="box-delivery"
                        data-delivery-status={d.status}
                      >
                        <span>{formatJalali(d.weekStart, locale)}</span>
                        <span>{t(d.status.toLowerCase() as "scheduled" | "skipped" | "delivered")}</span>
                      </li>
                    ))}
                  </ul>
                )}
                <h3 className="mt-2 font-black text-ink-900">{t("invoices")}</h3>
                {current.invoices.length === 0 ? (
                  <p className="text-neutral-600">{t("noInvoices")}</p>
                ) : (
                  <ul className="flex flex-col gap-1">
                    {current.invoices.map((invoice) => (
                      <li key={invoice.id} className="flex justify-between">
                        <span>{formatPrice(invoice.amount, locale)}</span>
                        <span>{invoice.status === "PAID" ? t("paid") : t("pending")}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            );
          })()}
        </section>
      ) : (
        <p className="text-sm text-neutral-600">{t("noSubscription")}</p>
      )}

      {!activeBox && !pausedBox ? (
        <section className="flex flex-col gap-3">
          <h2 className="text-lg font-black text-ink-900">{t("boxPlans")}</h2>
          {addresses.length === 0 ? (
            <p className="text-sm text-amber-800">
              {t("noAddressHint")}{" "}
              <Link href="/account/addresses" className="font-bold text-leaf-700">
                {t("addAddress")}
              </Link>
            </p>
          ) : null}
          <div className="grid gap-3 md:grid-cols-2">
            {plans.map((plan) => (
              <div
                key={plan.id}
                className="flex flex-col gap-3 rounded-2xl border border-cream-200 bg-white p-6"
                data-testid="box-plan"
                data-plan-id={plan.id}
              >
                <h3 className="font-black text-ink-900">{plan.title}</h3>
                <p className="text-sm text-neutral-600">
                  {formatPrice(plan.price, locale)} · {plan.periodDays} {t("periodDays")}
                </p>
                <SubscribeBoxForm
                  planId={plan.id}
                  priceLabel={formatPrice(plan.price, locale)}
                  locale={locale}
                />
              </div>
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}
