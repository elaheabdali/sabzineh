"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "@/i18n/navigation";
import { Link } from "@/i18n/navigation";
import { useTranslations } from "next-intl";
import type { FacetCounts, FilterParams, VendorDTO } from "@sabzineh/types";
import { buildFilterSearchParams, updateFilterParams } from "@/features/catalog/filter";
import { formatPrice } from "@/lib/format";
import type { Locale } from "@/i18n/routing";

interface FilterPanelProps {
  /** Path without locale prefix, e.g. `/category/fruits-vegetables` or `/search`. */
  basePath: string;
  params: FilterParams;
  facets: FacetCounts;
  vendors: VendorDTO[];
  locale: Locale;
}

/**
 * Faceted filter sidebar (desktop) + drawer (mobile).
 *
 * Every toggle is a plain link, so the URL stays the only source of
 * truth: back/forward and copy-paste work with zero client state.
 * Only the price inputs keep local state and sync to the URL with a
 * 500 ms debounce (router.replace, no scroll jump).
 */
export function FilterPanel({ basePath, params, facets, vendors, locale }: FilterPanelProps) {
  const t = useTranslations("category");
  const [open, setOpen] = useState(false);

  const hrefFor = (patch: FilterParams) =>
    `${basePath}${buildFilterSearchParams(updateFilterParams(params, patch))}`;
  const clearHref = `${basePath}${buildFilterSearchParams({ q: params.q, sort: params.sort })}`;
  const hasActiveFilter =
    params.vendor !== undefined ||
    params.minPrice !== undefined ||
    params.maxPrice !== undefined ||
    params.inStock === true ||
    params.organic === true ||
    params.glutenFree === true ||
    params.local === true ||
    params.minRating !== undefined;

  const attributeToggle = (
    key: "inStock" | "organic" | "glutenFree" | "local",
    label: string,
    count: number,
  ) => {
    const active = params[key] === true;
    return (
      <li key={key}>
        <Link
          href={hrefFor({ [key]: active ? undefined : true })}
          data-testid={`filter-${key}`}
          aria-pressed={active}
          className="flex w-full items-center justify-between rounded-lg px-2 py-1.5 text-sm text-ink-900 hover:bg-cream-100"
        >
          <span className="flex items-center gap-2">
            <span
              aria-hidden="true"
              className={
                active
                  ? "flex size-4 items-center justify-center rounded border border-leaf-700 bg-leaf-700 text-[10px] text-white"
                  : "flex size-4 items-center justify-center rounded border border-neutral-300 bg-white"
              }
            >
              {active ? "✓" : ""}
            </span>
            {label}
          </span>
          <span className="text-xs text-neutral-500">{count.toLocaleString(locale === "fa" ? "fa-IR" : "en-US")}</span>
        </Link>
      </li>
    );
  };

  const panel = (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h2 className="text-base font-black text-ink-900">{t("filters")}</h2>
        {hasActiveFilter ? (
          <Link href={clearHref} className="text-sm font-medium text-leaf-700 hover:underline">
            {t("clearAll")}
          </Link>
        ) : null}
      </div>

      <section aria-labelledby="filter-vendor">
        <h3 id="filter-vendor" className="text-sm font-bold text-ink-900">
          {t("vendor")}
        </h3>
        <ul className="mt-2 flex flex-col">
          {vendors.map((vendor) => {
            const count = facets.vendors.find((v) => v.id === vendor.id)?.count ?? 0;
            const active = params.vendor === vendor.id;
            return (
              <li key={vendor.id}>
                <Link
                  href={hrefFor({ vendor: active ? undefined : vendor.id })}
                  data-testid="vendor-filter"
                  aria-pressed={active}
                  className={
                    active
                      ? "flex w-full items-center justify-between rounded-lg bg-leaf-100 px-2 py-1.5 text-sm font-medium text-leaf-700"
                      : "flex w-full items-center justify-between rounded-lg px-2 py-1.5 text-sm text-ink-900 hover:bg-cream-100"
                  }
                >
                  <span>{vendor.shopName}</span>
                  <span className="text-xs text-neutral-500">
                    {count.toLocaleString(locale === "fa" ? "fa-IR" : "en-US")}
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      </section>

      <section aria-labelledby="filter-price">
        <h3 id="filter-price" className="text-sm font-bold text-ink-900">
          {t("priceRange")}
        </h3>
        <p className="mt-1 text-xs text-neutral-500">
          {formatPrice(facets.price.min, locale)} — {formatPrice(facets.price.max, locale)}
        </p>
        {/* key remounts the inputs when the URL changes from elsewhere
            (chip removal, back button) — no setState-in-effect needed. */}
        <PriceInputs
          key={`${params.minPrice ?? ""}-${params.maxPrice ?? ""}`}
          basePath={basePath}
          params={params}
        />
      </section>

      <section aria-labelledby="filter-attributes">
        <h3 id="filter-attributes" className="text-sm font-bold text-ink-900">
          {t("attributes")}
        </h3>
        <ul className="mt-2 flex flex-col">
          {attributeToggle("inStock", t("inStockOnly"), facets.attributes.inStock)}
          {attributeToggle("organic", t("organicOnly"), facets.attributes.organic)}
          {attributeToggle("glutenFree", t("glutenFreeOnly"), facets.attributes.glutenFree)}
          {attributeToggle("local", t("localOnly"), facets.attributes.local)}
        </ul>
      </section>

      <section aria-labelledby="filter-rating">
        <h3 id="filter-rating" className="text-sm font-bold text-ink-900">
          {t("rating")}
        </h3>
        <ul className="mt-2 flex flex-col">
          {[
            { value: undefined, label: t("anyRating") },
            { value: 4, label: t("ratingAtLeast", { value: 4 }) },
            { value: 4.5, label: t("ratingAtLeast", { value: 4.5 }) },
          ].map((option) => {
            const active = (params.minRating ?? undefined) === option.value;
            return (
              <li key={String(option.value)}>
                <Link
                  href={hrefFor({ minRating: option.value })}
                  data-testid="rating-filter"
                  aria-pressed={active}
                  className={
                    active
                      ? "block rounded-lg bg-leaf-100 px-2 py-1.5 text-sm font-medium text-leaf-700"
                      : "block rounded-lg px-2 py-1.5 text-sm text-ink-900 hover:bg-cream-100"
                  }
                >
                  {option.label}
                </Link>
              </li>
            );
          })}
        </ul>
      </section>
    </div>
  );

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        data-testid="open-filters"
        className="cursor-pointer rounded-lg border border-cream-200 bg-white px-4 py-2 text-sm font-medium text-ink-900 lg:hidden"
      >
        {t("showFilters")}
      </button>
      <aside className="hidden w-64 shrink-0 lg:block">
        <div className="rounded-2xl border border-cream-200 bg-white p-4">{panel}</div>
      </aside>
      {open ? (
        <div
          className="fixed inset-0 z-50 flex items-end bg-black/40 lg:hidden"
          role="dialog"
          aria-modal="true"
          aria-label={t("filters")}
        >
          <div className="max-h-[85vh] w-full overflow-y-auto rounded-t-3xl bg-white p-4">
            <div className="mb-4 flex items-center justify-between">
              <span className="text-base font-black text-ink-900">{t("filters")}</span>
              <button
                type="button"
                onClick={() => setOpen(false)}
                data-testid="close-filters"
                className="cursor-pointer rounded-lg px-3 py-2 text-sm font-medium text-ink-900 hover:bg-cream-100"
              >
                {t("hideFilters")}
              </button>
            </div>
            {panel}
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="mt-6 w-full cursor-pointer rounded-lg bg-leaf-700 px-4 py-3 text-sm font-bold text-white"
            >
              {t("showResults")}
            </button>
          </div>
        </div>
      ) : null}
    </>
  );
}

/**
 * Price range inputs with debounced URL sync (router.replace, no
 * scroll jump, no history spam). Local state only — the parent
 * remounts this component (via `key`) when the URL changes from
 * elsewhere, so no setState-in-effect is needed.
 */
function PriceInputs({ basePath, params }: { basePath: string; params: FilterParams }) {
  const t = useTranslations("category");
  const router = useRouter();
  const [minPrice, setMinPrice] = useState(params.minPrice === undefined ? "" : String(params.minPrice));
  const [maxPrice, setMaxPrice] = useState(params.maxPrice === undefined ? "" : String(params.maxPrice));
  const firstRender = useRef(true);

  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    const timer = setTimeout(() => {
      const min = minPrice === "" ? undefined : Number(minPrice);
      const max = maxPrice === "" ? undefined : Number(maxPrice);
      if ((min !== undefined && !Number.isFinite(min)) || (max !== undefined && !Number.isFinite(max))) return;
      if (min === params.minPrice && max === params.maxPrice) return;
      router.replace(
        `${basePath}${buildFilterSearchParams(updateFilterParams(params, { minPrice: min, maxPrice: max }))}`,
        { scroll: false },
      );
    }, 500);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [minPrice, maxPrice]);

  return (
    <div className="mt-2 flex items-center gap-2">
      <label className="sr-only" htmlFor="min-price">
        {t("minPrice")}
      </label>
      <input
        id="min-price"
        data-testid="min-price"
        inputMode="numeric"
        type="number"
        min={0}
        value={minPrice}
        onChange={(e) => setMinPrice(e.target.value)}
        placeholder={t("minPrice")}
        className="w-full min-w-0 rounded-lg border border-cream-200 bg-white px-3 py-2 text-sm text-ink-900"
      />
      <span aria-hidden="true" className="text-neutral-400">
        —
      </span>
      <label className="sr-only" htmlFor="max-price">
        {t("maxPrice")}
      </label>
      <input
        id="max-price"
        data-testid="max-price"
        inputMode="numeric"
        type="number"
        min={0}
        value={maxPrice}
        onChange={(e) => setMaxPrice(e.target.value)}
        placeholder={t("maxPrice")}
        className="w-full min-w-0 rounded-lg border border-cream-200 bg-white px-3 py-2 text-sm text-ink-900"
      />
    </div>
  );
}
