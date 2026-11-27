import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { descendantIds, getCatalogRepository } from "@/features/catalog/repository";
import { parseFilterParams } from "@/features/catalog/filter";
import { FilterPanel } from "@/components/FilterPanel";
import { ActiveFilterChips } from "@/components/ActiveFilterChips";
import { ProductGrid } from "@/components/ProductGrid";
import { SortSelect } from "@/components/SortSelect";
import type { Locale } from "@/i18n/routing";

interface CategoryPageProps {
  params: Promise<{ locale: string; slug: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export async function generateStaticParams() {
  const repo = getCatalogRepository();
  const tree = await repo.getCategoryTree();
  const collect = (nodes: Awaited<ReturnType<typeof repo.getCategoryTree>>): { slug: string }[] =>
    nodes.flatMap((node) => [{ slug: node.slug }, ...collect(node.children)]);
  return collect(tree);
}

export async function generateMetadata({ params }: CategoryPageProps): Promise<Metadata> {
  const { locale, slug } = await params;
  const repo = getCatalogRepository();
  const category = await repo.getCategoryBySlug(slug);
  if (!category) return {};
  const name = locale === "fa" ? category.nameFa : category.nameEn;
  return { title: locale === "fa" ? `${name} | سبزینه` : `${name} | Sabzineh` };
}

/**
 * Category page (Week 2, complete): real breadcrumb with ancestors,
 * subcategory chips with counts, faceted sidebar + mobile drawer,
 * active-filter chips, sort, server pagination, loading skeleton.
 *
 * The URL is the only source of truth — copying it reproduces the
 * exact list (the Week 2 acceptance test).
 */
export default async function CategoryPage({ params, searchParams }: CategoryPageProps) {
  const { locale, slug } = await params;
  const loc = (locale === "en" ? "en" : "fa") as Locale;
  const t = await getTranslations("category");
  const repo = getCatalogRepository();

  const category = await repo.getCategoryBySlug(slug);
  if (!category) notFound();
  const tree = await repo.getCategoryTree();
  const ancestors = await repo.getCategoryAncestors(slug);
  const categoryIds = descendantIds(tree, slug);

  const filter = parseFilterParams(await searchParams);
  const [result, facets, vendors] = await Promise.all([
    repo.listProducts(filter, { categoryIds }),
    repo.getFacets(filter, { categoryIds }),
    repo.getVendors(),
  ]);

  const name = loc === "fa" ? category.nameFa : category.nameEn;
  const basePath = `/category/${slug}`;
  const findNode = (nodes: typeof tree): (typeof tree)[number] | undefined => {
    for (const n of nodes) {
      if (n.slug === slug) return n;
      const found = findNode(n.children);
      if (found) return found;
    }
    return undefined;
  };
  const children = findNode(tree)?.children ?? [];

  return (
    <div className="flex flex-col gap-6 pt-8">
      <nav aria-label="Breadcrumb">
        <ol className="flex flex-wrap items-center gap-2 text-sm text-neutral-500">
          <li>
            <Link href="/" className="hover:text-leaf-700 hover:underline">
              {loc === "fa" ? "خانه" : "Home"}
            </Link>
          </li>
          {ancestors.map((ancestor) => (
            <li key={ancestor.id} className="flex items-center gap-2">
              <span aria-hidden="true">/</span>
              {ancestor.slug === slug ? (
                <span aria-current="page" className="font-medium text-ink-900">
                  {loc === "fa" ? ancestor.nameFa : ancestor.nameEn}
                </span>
              ) : (
                <Link href={`/category/${ancestor.slug}`} className="hover:text-leaf-700 hover:underline">
                  {loc === "fa" ? ancestor.nameFa : ancestor.nameEn}
                </Link>
              )}
            </li>
          ))}
        </ol>
      </nav>

      <header>
        <h1 className="text-2xl font-black text-ink-900">{name}</h1>
      </header>

      {children.length > 0 ? (
        <section aria-labelledby="subcategories">
          <h2 id="subcategories" className="text-sm font-bold text-ink-900">
            {t("subcategories")}
          </h2>
          <ul className="mt-2 flex flex-wrap gap-2">
            {children.map((child) => (
              <li key={child.id}>
                <Link
                  href={`/category/${child.slug}`}
                  className="inline-block rounded-full border border-cream-200 bg-white px-4 py-2 text-sm text-ink-900 hover:border-leaf-600"
                >
                  {loc === "fa" ? child.nameFa : child.nameEn} (
                  {child.productCount.toLocaleString(loc === "fa" ? "fa-IR" : "en-US")})
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <div className="flex flex-col gap-6 lg:flex-row lg:items-start">
        <FilterPanel basePath={basePath} params={filter} facets={facets} vendors={vendors} locale={loc} />
        <div className="flex min-w-0 flex-1 flex-col gap-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <ActiveFilterChips basePath={basePath} params={filter} vendors={vendors} locale={loc} />
            <SortSelect basePath={basePath} params={filter} locale={loc} />
          </div>
          <ProductGrid
            result={result}
            basePath={basePath}
            params={filter}
            locale={loc}
            clearHref={basePath}
          />
        </div>
      </div>
    </div>
  );
}
