"use client";

import { useActionState, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { Input, Button } from "@sabzineh/ui";
import { useCartStore } from "@/stores/cart";
import { useCartProducts } from "@/hooks/useCartProducts";
import { formatPrice } from "@/lib/format";
import type { Locale } from "@/i18n/routing";
import type { AddressDTO, Money } from "@sabzineh/types";
import {
  createAddressAction,
  createOrderAction,
  previewCheckoutAction,
  type CheckoutActionState,
} from "@/server/checkout/actions";

const ORDER_ERROR_KEY: Record<string, string> = {
  "insufficient-stock": "insufficientStock",
  "address-not-found": "addressNotFound",
  "product-unavailable": "productUnavailable",
  "invalid-input": "invalidInput",
  unknown: "unknownError",
};

/**
 * Multi-step checkout: address → payment (discount + wallet) →
 * review → place order. Every total is computed server-side
 * (previewCheckoutAction); the client only displays it.
 */
export function CheckoutForm({
  locale,
  addresses,
  walletBalance,
}: {
  locale: Locale;
  addresses: AddressDTO[];
  walletBalance: number;
}) {
  const t = useTranslations("checkout");
  const tCommon = useTranslations("common");
  const router = useRouter();
  const details = useCartProducts();
  const lines = useCartStore((s) => s.lines);
  const clearCart = useCartStore((s) => s.clear);

  const [step, setStep] = useState(1);
  const [addressId, setAddressId] = useState<string | null>(addresses[0]?.id ?? null);
  const [discountCode, setDiscountCode] = useState("");
  const [appliedCode, setAppliedCode] = useState<string | undefined>(undefined);
  const [discountError, setDiscountError] = useState(false);
  const [useWallet, setUseWallet] = useState(false);
  const [money, setMoney] = useState<Money | null>(null);
  const [placing, setPlacing] = useState(false);
  const [orderError, setOrderError] = useState<string | undefined>(undefined);
  const idempotencyKey = useRef<string>(crypto.randomUUID());

  // The wrapper (event-handler context, not an effect) selects the
  // newly saved address as soon as the server action returns it.
  const [addrState, addrAction, addrPending] = useActionState<
    CheckoutActionState & { addressId?: string },
    FormData
  >(
    async (_prev, formData) => {
      const result = await createAddressAction(_prev, formData);
      if (result.addressId) {
        setAddressId(result.addressId);
        router.refresh();
      }
      return result;
    },
    {},
  );

  const refreshPreview = async (code?: string, wallet?: boolean) => {
    const result = await previewCheckoutAction({
      items: lines,
      discountCode: code,
      useWallet: wallet,
    });
    if (result.ok && result.money) {
      setMoney(result.money);
      return true;
    }
    return false;
  };

  // Totals are (re)computed when the user moves to the payment or
  // review step — the cart cannot change while on this page, so no
  // effect is needed.
  const goToPayment = async () => {
    await refreshPreview(appliedCode, useWallet);
    setStep(2);
  };

  const goToReview = async () => {
    await refreshPreview(appliedCode, useWallet);
    setStep(3);
  };

  const applyDiscount = async () => {
    const code = discountCode.trim().toUpperCase();
    if (!code) return;
    const ok = await refreshPreview(code, useWallet);
    if (ok) {
      setAppliedCode(code);
      setDiscountError(false);
    } else {
      setDiscountError(true);
    }
  };

  const toggleWallet = async (checked: boolean) => {
    setUseWallet(checked);
    await refreshPreview(appliedCode, checked);
  };

  const placeOrder = async () => {
    if (!addressId || lines.length === 0) return;
    setPlacing(true);
    setOrderError(undefined);
    const result = await createOrderAction({
      items: lines,
      addressId,
      discountCode: appliedCode,
      useWallet,
      idempotencyKey: idempotencyKey.current,
      locale,
    });
    if (!result.ok) {
      setOrderError(ORDER_ERROR_KEY[result.error ?? "unknown"] ?? "unknownError");
      setPlacing(false);
      return;
    }
    if (result.paymentUrl) {
      // Gateway path: the cart is cleared on the order page once the
      // order is seen as PAID (ela-coffee pattern) — a cancelled
      // payment must find the cart intact.
      window.location.href = result.paymentUrl;
      return;
    }
    // Wallet-only: already PAID, so the cart can be cleared now.
    clearCart();
    router.push(`/${locale}/account/orders/${result.orderId}?payment=success`);
  };

  if (details === null) {
    return (
      <div className="pt-8" data-testid="checkout-page">
        <p className="text-sm text-neutral-600">{tCommon("loading")}</p>
      </div>
    );
  }

  if (details.length === 0) {
    return (
      <div className="flex flex-col items-start gap-4 pt-8" data-testid="checkout-page">
        <h1 className="text-2xl font-black text-ink-900">{t("title")}</h1>
        <p className="text-sm text-neutral-600">{t("emptyCart")}</p>
        <Link href="/" className="rounded-xl bg-leaf-700 px-4 py-2 text-sm font-bold text-white">
          {tCommon("back")}
        </Link>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6 pt-8" data-testid="checkout-page">
      <h1 className="text-2xl font-black text-ink-900">{t("title")}</h1>

      {/* Stepper */}
      <ol className="flex gap-2 text-sm font-bold" data-testid="checkout-steps">
        {[1, 2, 3].map((n) => (
          <li
            key={n}
            className={`rounded-full px-3 py-1 ${step === n ? "bg-leaf-700 text-white" : "bg-cream-100 text-ink-900"}`}
          >
            {n}. {t(n === 1 ? "stepAddress" : n === 2 ? "stepPayment" : "stepReview")}
          </li>
        ))}
      </ol>

      {step === 1 && (
        <section className="flex flex-col gap-4 rounded-2xl border border-cream-200 bg-white p-6" data-testid="checkout-step-address">
          <h2 className="text-lg font-bold text-ink-900">{t("selectAddress")}</h2>
          {addresses.length === 0 ? (
            <p className="text-sm text-neutral-600">{t("noAddress")}</p>
          ) : (
            <ul className="flex flex-col gap-2">
              {addresses.map((a) => (
                <li key={a.id}>
                  <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-cream-200 p-3">
                    <input
                      type="radio"
                      name="address"
                      value={a.id}
                      checked={addressId === a.id}
                      onChange={() => setAddressId(a.id)}
                      data-testid="address-option"
                    />
                    <span>
                      <span className="block text-sm font-bold text-ink-900">{a.title} — {a.city}</span>
                      <span className="block text-xs text-neutral-600">{a.text} · {a.postalCode}</span>
                    </span>
                  </label>
                </li>
              ))}
            </ul>
          )}

          <form action={addrAction} className="flex flex-col gap-3 border-t border-cream-100 pt-4">
            <h3 className="text-sm font-bold text-ink-900">{t("addAddress")}</h3>
            <Input label={t("addressTitle")} name="title" placeholder={t("addressTitlePlaceholder")} required />
            <Input label={t("city")} name="city" required />
            <Input label={t("addressText")} name="text" required />
            <div className="grid grid-cols-2 gap-3">
              <Input label={t("postalCode")} name="postalCode" placeholder={t("postalCodePlaceholder")} inputMode="numeric" required />
              <Input label={t("phone")} name="phone" type="tel" required />
            </div>
            {addrState.error ? (
              <p role="alert" className="text-sm font-medium text-red-700">{t("invalidInput")}</p>
            ) : null}
            <Button type="submit" variant="outline" disabled={addrPending} data-testid="save-address">
              {t("saveAddress")}
            </Button>
          </form>

          <Button onClick={goToPayment} disabled={!addressId} data-testid="to-payment-step">
            {t("stepPayment")}
          </Button>
        </section>
      )}

      {step === 2 && (
        <section className="flex flex-col gap-4 rounded-2xl border border-cream-200 bg-white p-6" data-testid="checkout-step-payment">
          <h2 className="text-lg font-bold text-ink-900">{t("paymentMethod")}</h2>

          <div className="flex flex-col gap-2">
            <label htmlFor="discount" className="text-sm font-medium text-ink-900">{t("discountCode")}</label>
            <div className="flex gap-2">
              <input
                id="discount"
                value={discountCode}
                onChange={(e) => setDiscountCode(e.target.value)}
                placeholder={t("discountPlaceholder")}
                data-testid="discount-input"
                className="h-10 flex-1 rounded-lg border border-cream-200 bg-white px-3 text-sm uppercase"
              />
              <Button type="button" variant="outline" onClick={applyDiscount} data-testid="apply-discount">
                {t("applyDiscount")}
              </Button>
            </div>
            {appliedCode ? (
              <p className="text-sm font-medium text-leaf-700" data-testid="discount-applied">
                {t("discountApplied")}: {appliedCode}
              </p>
            ) : null}
            {discountError ? (
              <p role="alert" className="text-sm font-medium text-red-700" data-testid="discount-error">
                {t("discountInvalid")}
              </p>
            ) : null}
          </div>

          <label className="flex cursor-pointer items-center gap-3 rounded-xl border border-cream-200 p-3">
            <input
              type="checkbox"
              checked={useWallet}
              disabled={walletBalance <= 0}
              onChange={(e) => void toggleWallet(e.target.checked)}
              data-testid="use-wallet"
            />
            <span>
              <span className="block text-sm font-bold text-ink-900">{t("payWithWallet")}</span>
              <span className="block text-xs text-neutral-600">
                {t("walletBalance")}: {formatPrice(walletBalance, locale)}
              </span>
            </span>
          </label>

          <p className="rounded-xl bg-cream-50 p-3 text-sm text-neutral-600">{t("payWithGateway")}</p>

          {money ? (
            <dl className="flex flex-col gap-1 border-t border-cream-100 pt-3 text-sm">
              <div className="flex justify-between"><dt>{t("subtotal")}</dt><dd className="font-bold">{formatPrice(money.gross, locale)}</dd></div>
              <div className="flex justify-between"><dt>{t("discount")}</dt><dd className="font-bold text-leaf-700">−{formatPrice(money.discount, locale)}</dd></div>
              <div className="flex justify-between"><dt>{t("walletApplied")}</dt><dd className="font-bold">−{formatPrice(money.walletApplied, locale)}</dd></div>
              <div className="flex justify-between text-base"><dt className="font-bold">{t("payable")}</dt><dd className="font-black" data-testid="checkout-payable">{formatPrice(money.payable, locale)}</dd></div>
            </dl>
          ) : null}

          <div className="flex gap-2">
            <Button type="button" variant="outline" onClick={() => setStep(1)}>{t("stepAddress")}</Button>
            <Button type="button" onClick={goToReview} data-testid="to-review-step">{t("stepReview")}</Button>
          </div>
        </section>
      )}

      {step === 3 && (
        <section className="flex flex-col gap-4 rounded-2xl border border-cream-200 bg-white p-6" data-testid="checkout-step-review">
          <h2 className="text-lg font-bold text-ink-900">{t("reviewItems")}</h2>
          <ul className="flex flex-col divide-y divide-cream-100 text-sm">
            {details.map(({ product, qty }) => (
              <li key={product.id} className="flex justify-between py-2">
                <span>{product.title} × {qty}</span>
                <span className="font-bold">{formatPrice(product.price * qty, locale)}</span>
              </li>
            ))}
          </ul>
          {money ? (
            <dl className="flex flex-col gap-1 border-t border-cream-100 pt-3 text-sm">
              <div className="flex justify-between"><dt>{t("subtotal")}</dt><dd className="font-bold">{formatPrice(money.gross, locale)}</dd></div>
              <div className="flex justify-between"><dt>{t("discount")}</dt><dd className="font-bold text-leaf-700">−{formatPrice(money.discount, locale)}</dd></div>
              <div className="flex justify-between"><dt>{t("walletApplied")}</dt><dd className="font-bold">−{formatPrice(money.walletApplied, locale)}</dd></div>
              <div className="flex justify-between text-base"><dt className="font-bold">{t("payable")}</dt><dd className="font-black" data-testid="checkout-payable">{formatPrice(money.payable, locale)}</dd></div>
            </dl>
          ) : null}
          {orderError ? (
            <p role="alert" className="text-sm font-medium text-red-700" data-testid="order-error">
              {t(orderError as "invalidInput" | "insufficientStock" | "addressNotFound" | "productUnavailable" | "unknownError")}
            </p>
          ) : null}
          <div className="flex gap-2">
            <Button type="button" variant="outline" onClick={() => setStep(2)}>{t("stepPayment")}</Button>
            <Button type="button" onClick={placeOrder} disabled={placing} data-testid="place-order">
              {money && money.payable === 0 ? t("placeOrderWalletOnly") : t("placeOrder")}
            </Button>
          </div>
        </section>
      )}
    </div>
  );
}
