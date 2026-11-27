import { useTranslations } from "next-intl";

/**
 * Vendor products — Week 1 placeholder.
 * Week 5 wires the multi-step product form + the Uploader component
 * from @sabzineh/ui.
 */
export default function VendorProductsPage() {
  const t = useTranslations("nav");
  return (
    <div className="flex flex-col gap-4 pt-8">
      <h1 className="text-2xl font-black text-ink-900">{t("vendorPanel")}</h1>
      <p className="rounded-2xl border border-cream-200 bg-white p-6 text-sm leading-7 text-neutral-600">
        Week 5 wires the multi-step product form (draft per step, Zod schema per
        step) and the full uploader: drag-and-drop, previews, crop, progress.
      </p>
    </div>
  );
}
