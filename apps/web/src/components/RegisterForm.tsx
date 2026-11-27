"use client";

import { useActionState, useRef } from "react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { Input, Button } from "@sabzineh/ui";
import { registerAction, type AuthActionState } from "@/server/auth/actions";
import { useCartStore } from "@/stores/cart";

const ERROR_KEY: Record<string, string> = {
  "invalid-credentials": "invalidCredentials",
  "email-taken": "emailTaken",
  "weak-password": "weakPassword",
  "invalid-phone": "invalidPhone",
  "invalid-input": "invalidInput",
  unknown: "unknownError",
  suspended: "invalidCredentials",
};

/**
 * Customer registration (Week 3). The note below links vendors to
 * the vendor registration page (Week 5).
 */
export function RegisterForm({ next }: { next: string }) {
  const t = useTranslations("auth");
  const [state, action, pending] = useActionState<AuthActionState, FormData>(registerAction, {});
  const formRef = useRef<HTMLFormElement>(null);
  const mergeGuestCart = useCartStore((s) => s.mergeGuestCart);
  const guestLines = useCartStore((s) => s.lines);

  return (
    <div className="mx-auto flex w-full max-w-md flex-col gap-6 pt-8">
      <div>
        <h1 className="text-2xl font-black text-ink-900">{t("registerTitle")}</h1>
        <p className="mt-1 text-sm text-neutral-600">{t("registerSubtitle")}</p>
      </div>

      <form
        ref={formRef}
        action={action}
        onSubmit={() => mergeGuestCart(guestLines)}
        className="flex flex-col gap-4 rounded-2xl border border-cream-200 bg-white p-6"
      >
        <input type="hidden" name="next" value={next} />
        <Input
          label={t("name")}
          type="text"
          name="name"
          autoComplete="name"
          placeholder={t("namePlaceholder")}
          required
        />
        <Input
          label={t("email")}
          type="email"
          name="email"
          autoComplete="email"
          placeholder={t("emailPlaceholder")}
          required
        />
        <Input
          label={t("phone")}
          type="tel"
          name="phone"
          autoComplete="tel"
          placeholder={t("phonePlaceholder")}
          hint={t("phoneHint")}
          required
        />
        <Input
          label={t("password")}
          type="password"
          name="password"
          autoComplete="new-password"
          placeholder={t("passwordPlaceholder")}
          hint={t("passwordHint")}
          required
        />
        {state.error ? (
          <p role="alert" className="text-sm font-medium text-red-700" data-testid="register-error">
            {t(ERROR_KEY[state.error] ?? "unknownError")}
          </p>
        ) : null}
        <Button type="submit" disabled={pending} data-testid="register-submit">
          {pending ? "…" : t("submitRegister")}
        </Button>
        <p className="text-center text-sm text-neutral-600">
          {t("haveAccount")}{" "}
          <Link href={`/auth/login?next=${encodeURIComponent(next)}`} className="font-bold text-leaf-700">
            {t("signInInstead")}
          </Link>
        </p>
        <p className="text-center text-xs leading-5 text-neutral-500">
          {t("vendorRegistrationNote")}{" "}
          <Link href="/auth/vendor-register" className="font-bold text-leaf-700">
            {t("vendorRegisterLink")}
          </Link>
        </p>
      </form>
    </div>
  );
}
