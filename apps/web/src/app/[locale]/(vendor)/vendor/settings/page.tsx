import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { ForbiddenError, UnauthorizedError, requireRole } from "@/lib/auth/guards";
import { getVendorRepository } from "@/features/vendor/repository";
import { VendorProfileForm } from "@/components/VendorProfileForm";
import { VendorNav } from "@/components/VendorNav";
import { VendorForbidden } from "@/components/VendorForbidden";
import type { Locale } from "@/i18n/routing";

/** Shop settings — name, city, bio, contact and payout fields. */
export default async function VendorSettingsPage({
  params,
}: {
  params: Promise<{ locale: Locale }>;
}) {
  const { locale } = await params;
  let session;
  try {
    session = await requireRole(["VENDOR"]);
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      redirect(`/${locale}/auth/login?next=/${locale}/vendor/settings`);
    }
    if (error instanceof ForbiddenError) return <VendorForbidden />;
    throw error;
  }
  const t = await getTranslations("vendor");
  const vendorId = session.vendorId;
  if (!vendorId) return <VendorForbidden />;
  const profile = await getVendorRepository().getVendorProfileById(vendorId);
  if (!profile) return <VendorForbidden />;

  return (
    <div className="flex flex-col gap-6 pt-8" data-testid="vendor-settings">
      <VendorNav />
      <h1 className="text-2xl font-black text-ink-900">{t("settings")}</h1>
      <VendorProfileForm profile={profile} />
    </div>
  );
}
