import { getTranslations } from "next-intl/server";

/** Shown when a signed-in user opens a vendor page with the wrong role. */
export async function VendorForbidden() {
  const t = await getTranslations("account");
  return (
    <div className="flex flex-col gap-4 pt-8" data-testid="vendor-forbidden">
      <h1 className="text-2xl font-black text-ink-900">{t("forbidden")}</h1>
      <p className="text-sm text-neutral-600">{t("forbiddenHint")}</p>
    </div>
  );
}
