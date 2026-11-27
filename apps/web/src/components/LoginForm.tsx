"use client";

import { useActionState, useRef, useState } from "react";
import { flushSync } from "react-dom";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { Input, Button } from "@sabzineh/ui";
import { loginAction, type AuthActionState } from "@/server/auth/actions";
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

const DEMO_ACCOUNTS = [
  { email: "customer@sabzineh.ir", labelKey: "demoCustomer" },
  { email: "vendor@sabzineh.ir", labelKey: "demoVendor" },
  { email: "admin@sabzineh.ir", labelKey: "demoAdmin" },
] as const;

/**
 * Login form. The guest cart is device-local (Zustand + persist), so
 * it survives sign-in by construction — on submit the pre-login lines
 * are merged explicitly (dedup, capped) so a login never loses a cart.
 */
export function LoginForm({ next }: { next: string }) {
  const t = useTranslations("auth");
  const [state, action, pending] = useActionState<AuthActionState, FormData>(loginAction, {});
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const formRef = useRef<HTMLFormElement>(null);
  const mergeGuestCart = useCartStore((s) => s.mergeGuestCart);
  const guestLines = useCartStore((s) => s.lines);

  const demoLogin = (demoEmail: string) => {
    // Commit the controlled values synchronously, then submit the
    // form so FormData reads the demo credentials.
    flushSync(() => {
      setEmail(demoEmail);
      setPassword("demo1234");
    });
    formRef.current?.requestSubmit();
  };

  return (
    <div className="mx-auto flex w-full max-w-md flex-col gap-6 pt-8">
      <div>
        <h1 className="text-2xl font-black text-ink-900">{t("loginTitle")}</h1>
        <p className="mt-1 text-sm text-neutral-600">{t("loginSubtitle")}</p>
      </div>

      <form
        ref={formRef}
        action={action}
        onSubmit={() => mergeGuestCart(guestLines)}
        className="flex flex-col gap-4 rounded-2xl border border-cream-200 bg-white p-6"
      >
        <input type="hidden" name="next" value={next} />
        <Input
          label={t("email")}
          type="email"
          name="email"
          autoComplete="email"
          placeholder={t("emailPlaceholder")}
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
        <Input
          label={t("password")}
          type="password"
          name="password"
          autoComplete="current-password"
          placeholder={t("passwordPlaceholder")}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />
        {state.error ? (
          <p role="alert" className="text-sm font-medium text-red-700" data-testid="login-error">
            {t(ERROR_KEY[state.error] ?? "unknownError")}
          </p>
        ) : null}
        <Button type="submit" disabled={pending} data-testid="login-submit">
          {pending ? "…" : t("submitLogin")}
        </Button>
        <p className="text-center text-sm text-neutral-600">
          {t("noAccount")}{" "}
          <Link href={`/auth/register?next=${encodeURIComponent(next)}`} className="font-bold text-leaf-700">
            {t("createAccount")}
          </Link>
        </p>
      </form>

      <div className="rounded-2xl border border-cream-200 bg-white p-6">
        <h2 className="text-sm font-bold text-ink-900">{t("demoAccounts")}</h2>
        <p className="mt-1 text-xs leading-5 text-neutral-500">{t("demoHint")}</p>
        <div className="mt-3 flex flex-wrap gap-2">
          {DEMO_ACCOUNTS.map((demo) => (
            <Button
              key={demo.email}
              type="button"
              variant="outline"
              data-testid={`demo-login-${demo.labelKey}`}
              onClick={() => demoLogin(demo.email)}
            >
              {t(demo.labelKey)}
            </Button>
          ))}
        </div>
      </div>
    </div>
  );
}
