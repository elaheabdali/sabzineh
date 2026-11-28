import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { getSession } from "@/lib/auth/guards";
import { getDataStore } from "@/server/store";
import { AddressForm } from "@/components/AddressForm";
import type { Locale } from "@/i18n/routing";

/** Address book — the customer's own addresses only. */
export default async function AddressesPage({ params }: { params: Promise<{ locale: Locale }> }) {
  const { locale } = await params;
  const session = await getSession();
  if (!session) redirect(`/${locale}/auth/login?next=/${locale}/account/addresses`);
  const t = await getTranslations("account");
  const addresses = await getDataStore().listAddresses(session.id);

  return (
    <div className="flex flex-col gap-6 pt-8" data-testid="addresses-page">
      <h1 className="text-2xl font-black text-ink-900">{t("addresses")}</h1>
      {addresses.length === 0 ? (
        <p className="text-sm text-neutral-600">{t("noAddresses")}</p>
      ) : (
        <ul className="flex flex-col gap-3">
          {addresses.map((a) => (
            <li key={a.id} className="rounded-2xl border border-cream-200 bg-white p-4" data-testid="address-row">
              <p className="text-sm font-bold text-ink-900">{a.title} — {a.city}</p>
              <p className="text-xs text-neutral-600">{a.text} · {a.postalCode} · {a.phone}</p>
            </li>
          ))}
        </ul>
      )}
      <AddressForm />
    </div>
  );
}
