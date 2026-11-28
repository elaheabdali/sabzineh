"use client";

import { useActionState } from "react";
import { useTranslations } from "next-intl";
import { Input, Button } from "@sabzineh/ui";
import { createAddressAction, type CheckoutActionState } from "@/server/checkout/actions";

/** Shared add-address form (checkout + address book). */
export function AddressForm() {
  const t = useTranslations("checkout");
  const [state, action, pending] = useActionState<
    CheckoutActionState & { addressId?: string },
    FormData
  >(createAddressAction, {});

  return (
    <form action={action} className="flex flex-col gap-3 rounded-2xl border border-cream-200 bg-white p-6">
      <h2 className="text-sm font-bold text-ink-900">{t("addAddress")}</h2>
      <Input label={t("addressTitle")} name="title" placeholder={t("addressTitlePlaceholder")} required />
      <Input label={t("city")} name="city" required />
      <Input label={t("addressText")} name="text" required />
      <div className="grid grid-cols-2 gap-3">
        <Input label={t("postalCode")} name="postalCode" placeholder={t("postalCodePlaceholder")} inputMode="numeric" required />
        <Input label={t("phone")} name="phone" type="tel" required />
      </div>
      {state.error ? (
        <p role="alert" className="text-sm font-medium text-red-700">{t("invalidInput")}</p>
      ) : null}
      {state.addressId ? (
        <p className="text-sm font-medium text-leaf-700" data-testid="address-saved">
          ✓
        </p>
      ) : null}
      <Button type="submit" disabled={pending} data-testid="save-address">
        {t("saveAddress")}
      </Button>
    </form>
  );
}
