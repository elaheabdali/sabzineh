import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/guards";
import { getDataStore } from "@/server/store";
import { CheckoutForm } from "@/components/CheckoutForm";
import type { Locale } from "@/i18n/routing";

/**
 * Checkout page (server). Guests are sent to login with `next` so
 * they come back here; the cart survives in localStorage.
 */
export default async function CheckoutPage({ params }: { params: Promise<{ locale: Locale }> }) {
  const { locale } = await params;
  const session = await getSession();
  if (!session) redirect(`/${locale}/auth/login?next=/${locale}/checkout`);
  const store = getDataStore();
  const [addresses, walletBalance] = await Promise.all([
    store.listAddresses(session.id),
    store.getWalletBalance(session.id),
  ]);
  return (
    <CheckoutForm
      locale={locale}
      addresses={addresses}
      walletBalance={walletBalance}
    />
  );
}
