import { useTranslations } from "next-intl";

/**
 * Profile — Week 1 placeholder.
 * Real auth lands in Week 3: this page will start with
 * `await requireRole(["CUSTOMER"])` from lib/auth/guards.
 */
export default function ProfilePage() {
  const t = useTranslations("nav");
  return (
    <div className="flex flex-col gap-4 pt-8">
      <h1 className="text-2xl font-black text-ink-900">{t("account")}</h1>
      <p className="rounded-2xl border border-cream-200 bg-white p-6 text-sm leading-7 text-neutral-600">
        Week 3 wires the real profile form (React Hook Form + Zod, shared schema in
        @sabzineh/types) and the address book.
      </p>
    </div>
  );
}
