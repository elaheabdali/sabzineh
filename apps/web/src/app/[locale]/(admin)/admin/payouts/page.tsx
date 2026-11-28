import { getTranslations } from "next-intl/server";
import { adminGuard } from "@/server/admin/page-guard";
import { listPayoutsForAdmin } from "@/server/billing/payouts";
import { AdminNav } from "@/components/AdminNav";
import { approvePayoutAction, markPayoutPaidAction } from "@/server/admin/actions";
import { formatJalali, formatPrice } from "@/lib/format";
import type { Locale } from "@/i18n/routing";

/**
 * Admin payout queue (Week 6): requested payouts with totals and
 * approve / mark-paid actions. Payouts are records — no real bank
 * transfer happens here.
 */
export default async function AdminPayoutsPage({
  params,
}: {
  params: Promise<{ locale: Locale }>;
}) {
  const { locale } = await params;
  const guard = await adminGuard(locale, `/${locale}/admin/payouts`);
  if ("element" in guard) return guard.element;
  const t = await getTranslations("admin");
  const payouts = await listPayoutsForAdmin();

  return (
    <div className="flex flex-col gap-6 pt-8" data-testid="admin-payouts">
      <AdminNav />
      <h1 className="text-2xl font-black text-ink-900">{t("payoutQueue")}</h1>
      {payouts.length === 0 ? (
        <p className="text-sm text-neutral-600">{t("noPayouts")}</p>
      ) : (
        <ul className="flex flex-col gap-3">
          {payouts.map((payout) => (
            <li
              key={payout.id}
              className="flex flex-col gap-2 rounded-2xl border border-cream-200 bg-white p-4 text-sm"
              data-testid="admin-payout-row"
              data-payout-id={payout.id}
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="font-bold text-ink-900">{payout.vendorId}</span>
                <span className="rounded-full bg-cream-100 px-3 py-1 text-xs font-bold" data-testid="payout-status">
                  {payout.status}
                </span>
              </div>
              <p className="text-neutral-600">
                {t("period")}: {formatJalali(payout.periodStart, locale)} —{" "}
                {formatJalali(payout.periodEnd, locale)}
              </p>
              <p className="text-neutral-600">
                {t("gross")}: {formatPrice(payout.gross, locale)} · {t("commission")}:{" "}
                {formatPrice(payout.commission, locale)} · {t("net")}:{" "}
                <strong className="text-ink-900">{formatPrice(payout.net, locale)}</strong>
              </p>
              <div className="flex gap-2">
                {payout.status === "REQUESTED" ? (
                  <form action={approvePayoutAction}>
                    <input type="hidden" name="payoutId" value={payout.id} />
                    <button
                      type="submit"
                      data-testid={`approve-payout-${payout.id}`}
                      className="cursor-pointer rounded-full bg-leaf-600 px-4 py-2 text-xs font-bold text-white"
                    >
                      {t("approvePayout")}
                    </button>
                  </form>
                ) : null}
                {payout.status === "APPROVED" ? (
                  <form action={markPayoutPaidAction}>
                    <input type="hidden" name="payoutId" value={payout.id} />
                    <button
                      type="submit"
                      data-testid={`pay-payout-${payout.id}`}
                      className="cursor-pointer rounded-full bg-leaf-600 px-4 py-2 text-xs font-bold text-white"
                    >
                      {t("markPaid")}
                    </button>
                  </form>
                ) : null}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
