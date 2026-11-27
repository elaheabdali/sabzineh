import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import type { FilterParams, VendorDTO } from "@sabzineh/types";
import { buildFilterSearchParams, updateFilterParams } from "@/features/catalog/filter";
import { formatPrice } from "@/lib/format";
import type { Locale } from "@/i18n/routing";

interface ActiveFilterChipsProps {
  basePath: string;
  params: FilterParams;
  vendors: VendorDTO[];
  locale: Locale;
}

/**
 * Removable chips for every active filter, plus "clear all".
 * Each chip is a link to the same page without that filter.
 */
export async function ActiveFilterChips({ basePath, params, vendors, locale }: ActiveFilterChipsProps) {
  const t = await getTranslations("category");
  const chips: { key: string; label: string; patch: FilterParams }[] = [];
  if (params.vendor) {
    const vendor = vendors.find((v) => v.id === params.vendor);
    chips.push({ key: "vendor", label: vendor?.shopName ?? params.vendor, patch: { vendor: undefined } });
  }
  if (params.minPrice !== undefined) {
    chips.push({ key: "minPrice", label: `${t("minPrice")}: ${formatPrice(params.minPrice, locale)}`, patch: { minPrice: undefined } });
  }
  if (params.maxPrice !== undefined) {
    chips.push({ key: "maxPrice", label: `${t("maxPrice")}: ${formatPrice(params.maxPrice, locale)}`, patch: { maxPrice: undefined } });
  }
  if (params.inStock) chips.push({ key: "inStock", label: t("inStockOnly"), patch: { inStock: undefined } });
  if (params.organic) chips.push({ key: "organic", label: t("organicOnly"), patch: { organic: undefined } });
  if (params.glutenFree) chips.push({ key: "glutenFree", label: t("glutenFreeOnly"), patch: { glutenFree: undefined } });
  if (params.local) chips.push({ key: "local", label: t("localOnly"), patch: { local: undefined } });
  if (params.minRating !== undefined) {
    chips.push({ key: "minRating", label: t("ratingAtLeast", { value: params.minRating }), patch: { minRating: undefined } });
  }
  if (params.q) chips.push({ key: "q", label: `«${params.q}»`, patch: { q: undefined } });

  if (chips.length === 0) return null;
  const clearHref = `${basePath}${buildFilterSearchParams({ q: undefined, sort: params.sort })}`;
  return (
    <div className="flex flex-wrap items-center gap-2" data-testid="active-filters" aria-label={t("activeFilters")}>
      {chips.map((chip) => (
        <Link
          key={chip.key}
          href={`${basePath}${buildFilterSearchParams(updateFilterParams(params, chip.patch))}`}
          aria-label={`${t("removeFilter")}: ${chip.label}`}
          className="inline-flex items-center gap-1 rounded-full bg-leaf-100 px-3 py-1 text-sm font-medium text-leaf-700 hover:bg-leaf-200"
        >
          {chip.label}
          <span aria-hidden="true">×</span>
        </Link>
      ))}
      <Link href={clearHref} className="text-sm font-medium text-leaf-700 hover:underline">
        {t("clearAll")}
      </Link>
    </div>
  );
}
