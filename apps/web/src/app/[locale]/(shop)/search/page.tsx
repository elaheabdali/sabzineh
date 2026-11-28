import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { getCatalogRepository } from "@/features/catalog/repository";
import { parseFilterParams } from "@/features/catalog/filter";
import { parseSmartQuery } from "@/features/catalog/smart-search";
import { FilterPanel } from "@/components/FilterPanel";
import { ActiveFilterChips } from "@/components/ActiveFilterChips";
import { ProductGrid } from "@/components/ProductGrid";
import { SortSelect } from "@/components/SortSelect";
import { SmartSearchForm } from "@/components/SearchForm";
import type { FilterParams } from "@sabzineh/types";
import type { Locale } from "@/i18n/routing";

interface SearchPageProps {
  params: Promise<{ locale: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export async function generateMetadata({ params }: SearchPageProps): Promise<Metadata> {
  const { locale } = await params;
  return { title: locale === "fa" ? "جستجو | سبزینه" : "Search | Sabzineh" };
}

/**
 * Search page: plain text search (`q`, title + vendor name) and the
 * smart-search mode (`smart=`, natural language → structured filters
 * via parseSmartQuery — deterministic heuristics, no AI call).
 * Facets, sort and pagination are the same components as the category
 * page — one catalog, one URL shape. When the parser corrects a typo,
 * the correction is shown, never silently hidden.
 *
 * NOTE: once a user removes a chip, the `smart` phrase drops out of
 * the URL and the smart note disappears — the filters themselves
 * stay, because they are already in the URL.
 */
export default async function SearchPage({ params, searchParams }: SearchPageProps) {
  const { locale } = await params;
  const loc = (locale === "en" ? "en" : "fa") as Locale;
  const t = await getTranslations("category");
  const raw = await searchParams;
  const smart = typeof raw.smart === "string" && raw.smart.trim() !== "" ? raw.smart : undefined;

  let filter: FilterParams;
  let matched: string[] = [];
  let corrected: { from: string; to: string }[] = [];
  if (smart) {
    const parsed = parseSmartQuery(smart);
    filter = parsed.params;
    matched = parsed.matched;
    corrected = parsed.corrected;
  } else {
    filter = parseFilterParams(raw);
  }

  const repo = getCatalogRepository();
  const [result, facets, vendors] = await Promise.all([
    repo.listProducts(filter),
    repo.getFacets(filter),
    repo.getVendors(),
  ]);
  const basePath = "/search";

  return (
    <div className="flex flex-col gap-6 pt-8">
      <header>
        <h1 className="text-2xl font-black text-ink-900">
          {filter.q ? `${t("searchResults")}: «${filter.q}»` : t("searchResults")}
        </h1>
      </header>

      <SmartSearchForm />

      {smart && matched.length > 0 ? (
        <p className="rounded-2xl border border-dashed border-leaf-600 bg-leaf-100/50 px-4 py-3 text-sm text-ink-900" data-testid="smart-matched">
          {t("smartMatched")}: {matched.join("، ")}
        </p>
      ) : null}

      {smart && corrected.length > 0 ? (
        <p className="rounded-2xl border border-cream-200 bg-cream-100 px-4 py-3 text-sm text-ink-900" data-testid="smart-corrected">
          {t("smartCorrected")} «{corrected[0].from}»؟ {t("searchResults")}: «{corrected[0].to}»
        </p>
      ) : null}

      <div className="flex flex-col gap-6 lg:flex-row lg:items-start">
        <FilterPanel basePath={basePath} params={filter} facets={facets} vendors={vendors} locale={loc} />
        <div className="flex min-w-0 flex-1 flex-col gap-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <ActiveFilterChips basePath={basePath} params={filter} vendors={vendors} locale={loc} />
            <SortSelect basePath={basePath} params={filter} locale={loc} />
          </div>
          <ProductGrid result={result} basePath={basePath} params={filter} locale={loc} clearHref="/search" />
        </div>
      </div>
    </div>
  );
}
