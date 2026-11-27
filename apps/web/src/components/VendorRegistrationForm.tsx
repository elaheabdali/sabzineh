"use client";

import { useActionState } from "react";
import { useTranslations } from "next-intl";
import { Button, Input } from "@sabzineh/ui";
import { registerVendorAction, type VendorActionState } from "@/server/vendor/actions";

const ERROR_KEY: Record<string, string> = {
  "email-taken": "emailTaken",
  "weak-password": "weakPassword",
  "invalid-phone": "invalidPhone",
  "invalid-input": "invalidInput",
  unknown: "unknownError",
};

/** Vendor registration request (Week 5). The account + PENDING
 *  profile are created immediately; admin approval is Week 6. */
export function VendorRegistrationForm({ locale }: { locale: "fa" | "en" }) {
  const t = useTranslations("auth");
  const [state, action, pending] = useActionState<VendorActionState, FormData>(
    registerVendorAction,
    {},
  );

  return (
    <div className="mx-auto flex w-full max-w-md flex-col gap-6 pt-8">
      <div>
        <h1 className="text-2xl font-black text-ink-900">{t("vendorRegisterTitle")}</h1>
        <p className="mt-1 text-sm text-neutral-600">{t("vendorRegisterSubtitle")}</p>
      </div>
      <form
        action={action}
        data-testid="vendor-register-form"
        className="flex flex-col gap-4 rounded-2xl border border-cream-200 bg-white p-6"
      >
        <input type="hidden" name="locale" value={locale} />
        <Input label={t("name")} name="name" autoComplete="name" placeholder={t("namePlaceholder")} required />
        <Input
          label={t("email")}
          name="email"
          type="email"
          autoComplete="email"
          placeholder={t("emailPlaceholder")}
          required
        />
        <Input
          label={t("phone")}
          name="phone"
          type="tel"
          autoComplete="tel"
          placeholder={t("phonePlaceholder")}
          hint={t("phoneHint")}
          required
        />
        <Input
          label={t("password")}
          name="password"
          type="password"
          autoComplete="new-password"
          placeholder={t("passwordPlaceholder")}
          hint={t("passwordHint")}
          required
        />
        <Input label={t("shopName")} name="shopName" required />
        <Input label={t("city")} name="city" required />
        <label className="flex flex-col gap-1 text-sm font-medium text-ink-900">
          {t("bio")}
          <textarea
            name="bio"
            rows={3}
            className="rounded-xl border border-cream-200 bg-white px-4 py-3 text-sm outline-none focus:border-leaf-600"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm font-medium text-ink-900">
          {t("documentsNote")}
          <textarea
            name="documentsNote"
            rows={3}
            className="rounded-xl border border-cream-200 bg-white px-4 py-3 text-sm outline-none focus:border-leaf-600"
          />
          <span className="text-xs font-normal text-neutral-600">{t("documentsNoteHint")}</span>
        </label>
        {state.error ? (
          <p role="alert" className="text-sm font-bold text-red-700">
            {t(ERROR_KEY[state.error] ?? "unknownError")}
          </p>
        ) : null}
        <Button type="submit" data-testid="vendor-register-submit" disabled={pending}>
          {pending ? "…" : t("submitVendorRegister")}
        </Button>
      </form>
    </div>
  );
}
