"use client";

import { useRouter } from "@/i18n/navigation";
import { useTranslations } from "next-intl";
import type { FilterParams } from "@sabzineh/types";
import { buildFilterSearchParams, SORT_OPTIONS, updateFilterParams } from "@/features/catalog/filter";
import type { Locale } from "@/i18n/routing";

interface SortSelectProps {
  basePath: string;
  params: FilterParams;
  locale: Locale;
}

/** Sort control: a select that navigates to the sorted URL. */
export function SortSelect({ basePath, params, locale }: SortSelectProps) {
  const t = useTranslations("category");
  const router = useRouter();
  const value = params.sort ?? "newest";
  return (
    <label className="flex items-center gap-2 text-sm">
      <span className="font-medium text-ink-900">{t("sort")}:</span>
      <select
        value={value}
        data-testid="sort-select"
        aria-label={t("sort")}
        onChange={(e) => {
          const sort = e.target.value as FilterParams["sort"];
          router.push(`${basePath}${buildFilterSearchParams(updateFilterParams(params, { sort }))}`);
        }}
        className="cursor-pointer rounded-lg border border-cream-200 bg-white px-3 py-2 text-sm text-ink-900"
      >
        {SORT_OPTIONS.map((option) => (
          <option key={option.value} value={option.value}>
            {locale === "fa" ? option.labelFa : option.labelEn}
          </option>
        ))}
      </select>
    </label>
  );
}
