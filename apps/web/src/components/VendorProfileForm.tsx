"use client";

import { useActionState } from "react";
import { useTranslations } from "next-intl";
import { Button, Input } from "@sabzineh/ui";
import {
  updateVendorProfileAction,
  type VendorActionState,
} from "@/server/vendor/actions";
import type { VendorProfileDTO } from "@sabzineh/types";

/** Shop settings form (Week 5). Payout fields are stored only — the
 *  public shop page never renders them. */
export function VendorProfileForm({ profile }: { profile: VendorProfileDTO }) {
  const t = useTranslations("vendor");
  const [state, action, pending] = useActionState<
    VendorActionState & { saved?: boolean },
    FormData
  >(updateVendorProfileAction, {});

  return (
    <form
      action={action}
      data-testid="vendor-profile-form"
      className="flex max-w-xl flex-col gap-4 rounded-2xl border border-cream-200 bg-white p-6"
    >
      <Input label={t("shopName")} name="shopName" defaultValue={profile.shopName} required />
      <Input label={t("city")} name="city" defaultValue={profile.city} required />
      <label className="flex flex-col gap-1 text-sm font-medium text-ink-900">
        {t("bio")}
        <textarea
          name="bio"
          defaultValue={profile.bio ?? ""}
          rows={3}
          className="rounded-xl border border-cream-200 bg-white px-4 py-3 text-sm outline-none focus:border-leaf-600"
        />
      </label>
      <Input
        label={t("phone")}
        name="phone"
        type="tel"
        autoComplete="tel"
        defaultValue={profile.phone ?? ""}
      />
      <Input label={t("logoUrl")} name="logoUrl" type="url" defaultValue={profile.logoUrl ?? ""} />
      <p className="text-xs leading-5 text-neutral-500">{t("payoutNote")}</p>
      <Input
        label={t("payoutIban")}
        name="payoutIban"
        defaultValue={profile.payoutIban ?? ""}
        placeholder="IR..."
        dir="ltr"
      />
      <Input
        label={t("payoutAccountHolder")}
        name="payoutAccountHolder"
        defaultValue={profile.payoutAccountHolder ?? ""}
      />
      {state.error ? (
        <p role="alert" className="text-sm font-bold text-red-700">
          {state.error === "invalid-input" ? t("invalidInput") : t("unknownError")}
        </p>
      ) : null}
      {state.saved ? (
        <p role="status" className="text-sm font-bold text-leaf-700">
          {t("saved")}
        </p>
      ) : null}
      <Button type="submit" data-testid="save-profile" disabled={pending}>
        {pending ? "…" : t("saveProfile")}
      </Button>
    </form>
  );
}
