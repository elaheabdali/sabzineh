import { CartView } from "@/components/CartView";
import type { Locale } from "@/i18n/routing";

/**
 * Cart page (server wrapper — the route params arrive as a Promise
 * in Next 16, so the locale is resolved here and passed to the
 * client view; passing it directly as a prop silently yields
 * `undefined` and Latin digits).
 */
export default async function CartPage({ params }: { params: Promise<{ locale: Locale }> }) {
  const { locale } = await params;
  return <CartView locale={locale} />;
}
