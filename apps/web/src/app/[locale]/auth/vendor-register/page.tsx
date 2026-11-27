import { VendorRegistrationForm } from "@/components/VendorRegistrationForm";
import type { Locale } from "@/i18n/routing";

/** Public vendor registration — creates a VENDOR user + PENDING profile. */
export default async function VendorRegisterPage({
  params,
}: {
  params: Promise<{ locale: Locale }>;
}) {
  const { locale } = await params;
  return <VendorRegistrationForm locale={locale} />;
}
