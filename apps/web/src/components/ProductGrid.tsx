import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import type { CatalogListResult, FilterParams } from "@sabzineh/types";
import { buildFilterSearchParams, updateFilterParams } from "@/features/catalog/filter";
import { ProductCard } from "./ProductCard";
import type { Locale } from "@/i18n/routing";

interface ProductGridProps {
  result: CatalogListResult;
  basePath: string;
  params: FilterParams;
  locale: Locale;
  clearHref?: string;
}

/**
 * Catalog result grid: count, product tiles, server-side pagination.
 * Page links are plain links — the URL carries the page, so a copied
 * link reproduces the exact page.
 */
export async function ProductGrid({ result, basePath, params, locale, clearHref }: ProductGridProps) {
  const t = await getTranslations("category");
  const { items, total, page, totalPages } = result;
  const pageHref = (p: number) =>
    `${basePath}${buildFilterSearchParams(updateFilterParams(params, { page: p === 1 ? undefined : p }))}`;
  const pages = Array.from({ length: totalPages }, (_, i) => i + 1);

  return (
    <div className="flex min-w-0 flex-1 flex-col gap-4">
      <p className="text-sm text-neutral-600" data-testid="result-count" aria-live="polite">
        {total.toLocaleString(locale === "fa" ? "fa-IR" : "en-US")} {t("products")}
        {totalPages > 1
          ? ` — ${t("page")} ${page.toLocaleString(locale === "fa" ? "fa-IR" : "en-US")} ${t("of")} ${totalPages.toLocaleString(locale === "fa" ? "fa-IR" : "en-US")}`
          : ""}
      </p>

      {items.length === 0 ? (
        <div className="rounded-2xl border border-cream-200 bg-white p-8 text-center" data-testid="empty-state">
          <p className="font-bold text-ink-900">{t("noResults")}</p>
          <p className="mt-1 text-sm text-neutral-600">{t("noResultsHint")}</p>
          {clearHref ? (
            <Link href={clearHref} className="mt-4 inline-block rounded-lg bg-leaf-700 px-4 py-2 text-sm font-bold text-white">
              {t("clearAll")}
            </Link>
          ) : null}
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-4 xl:grid-cols-3">
          {items.map((product) => (
            <ProductCard key={product.id} product={product} locale={locale} />
          ))}
        </div>
      )}

      {totalPages > 1 ? (
        <nav aria-label={t("pagination")} data-testid="pagination" className="mt-2 flex flex-wrap items-center justify-center gap-1">
          <Link
            href={pageHref(page - 1)}
            aria-disabled={page <= 1}
            aria-label={t("previous")}
            className={
              page <= 1
                ? "pointer-events-none rounded-lg border border-cream-200 px-3 py-2 text-sm text-neutral-300"
                : "rounded-lg border border-cream-200 bg-white px-3 py-2 text-sm text-ink-900 hover:border-leaf-600"
            }
          >
            {locale === "fa" ? "→" : "←"}
          </Link>
          {pages.map((p) => (
            <Link
              key={p}
              href={pageHref(p)}
              aria-current={p === page ? "page" : undefined}
              className={
                p === page
                  ? "rounded-lg bg-leaf-700 px-3 py-2 text-sm font-bold text-white"
                  : "rounded-lg border border-cream-200 bg-white px-3 py-2 text-sm text-ink-900 hover:border-leaf-600"
              }
            >
              {p.toLocaleString(locale === "fa" ? "fa-IR" : "en-US")}
            </Link>
          ))}
          <Link
            href={pageHref(page + 1)}
            aria-disabled={page >= totalPages}
            aria-label={t("next")}
            className={
              page >= totalPages
                ? "pointer-events-none rounded-lg border border-cream-200 px-3 py-2 text-sm text-neutral-300"
                : "rounded-lg border border-cream-200 bg-white px-3 py-2 text-sm text-ink-900 hover:border-leaf-600"
            }
          >
            {locale === "fa" ? "←" : "→"}
          </Link>
        </nav>
      ) : null}
    </div>
  );
}
