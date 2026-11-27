import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { buildCategoryTree, getCategoryBySlug, products } from "@/data/seed";
import { ProductCard } from "@/components/ProductCard";
import { applyFilter, buildFilterSearchParams, parseFilterParams, SORT_OPTIONS } from "@/features/catalog/filter";
import type { Locale } from "@/i18n/routing";

interface CategoryPageProps {
  params: Promise<{ locale: string; slug: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export function generateStaticParams() {
  return buildCategoryTree().flatMap(function collect(node): { slug: string }[] {
    return [{ slug: node.slug }, ...node.children.flatMap(collect)];
  });
}

/**
 * Category page: real breadcrumb, subcategory counts, and a working
 * URL-synced filter (sort, in-stock, organic). Copying the URL
 * reproduces the exact list — the Week 2 acceptance test.
 */
export default async function CategoryPage({ params, searchParams }: CategoryPageProps) {
  const { locale, slug } = await params;
  const loc = (locale === "en" ? "en" : "fa") as Locale;
  const t = await getTranslations("category");
  const category = getCategoryBySlug(slug);
  if (!category) notFound();

  const tree = buildCategoryTree();
  const findNode = (nodes: typeof tree, id: string): (typeof tree)[number] | undefined => {
    for (const node of nodes) {
      if (node.id === id) return node;
      const found = findNode(node.children, id);
      if (found) return found;
    }
    return undefined;
  };
  const node = findNode(tree, category.id);
  const descendantIds = (n: typeof node): string[] =>
    n ? [n.id, ...n.children.flatMap(descendantIds)] : [];
  const ids = new Set(descendantIds(node));
  const inCategory = products.filter((p) => ids.has(p.categoryId));

  const filter = parseFilterParams(await searchParams);
  const filtered = applyFilter(inCategory, filter);

  const name = loc === "fa" ? category.nameFa : category.nameEn;
  const toggleLink = (key: "inStock" | "organic") => {
    const next = { ...filter, [key]: filter[key] ? undefined : true };
    return `/category/${slug}${buildFilterSearchParams(next)}`;
  };

  return (
    <div className="flex flex-col gap-6 pt-8">
      <nav aria-label="Breadcrumb">
        <ol className="flex flex-wrap items-center gap-2 text-sm text-neutral-500">
          <li>
            <Link href="/" className="hover:text-leaf-700 hover:underline">
              {loc === "fa" ? "خانه" : "Home"}
            </Link>
          </li>
          <li aria-hidden="true">/</li>
          <li aria-current="page" className="font-medium text-ink-900">
            {name}
          </li>
        </ol>
      </nav>

      <header>
        <h1 className="text-2xl font-black text-ink-900">{name}</h1>
        <p className="mt-1 text-sm text-neutral-500">
          {filtered.length.toLocaleString(loc === "fa" ? "fa-IR" : "en-US")} {t("products")}
        </p>
      </header>

      {node && node.children.length > 0 ? (
        <section aria-labelledby="subcategories">
          <h2 id="subcategories" className="text-sm font-bold text-ink-900">
            {t("subcategories")}
          </h2>
          <ul className="mt-2 flex flex-wrap gap-2">
            {node.children.map((child) => (
              <li key={child.id}>
                <Link
                  href={`/category/${child.slug}`}
                  className="inline-block rounded-full border border-cream-200 bg-white px-4 py-2 text-sm text-ink-900 hover:border-leaf-600"
                >
                  {loc === "fa" ? child.nameFa : child.nameEn} ({child.productCount.toLocaleString(loc === "fa" ? "fa-IR" : "en-US")})
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <div className="flex flex-wrap items-center gap-2" aria-label={t("sort")}>
        <span className="text-sm font-medium text-ink-900">{t("sort")}:</span>
        {SORT_OPTIONS.map((option) => {
          const active = (filter.sort ?? "newest") === option.value;
          return (
            <Link
              key={option.value}
              href={`/category/${slug}${buildFilterSearchParams({ ...filter, sort: option.value })}`}
              aria-current={active ? "true" : undefined}
              className={
                active
                  ? "rounded-full bg-leaf-700 px-3 py-1 text-sm font-medium text-white"
                  : "rounded-full border border-cream-200 bg-white px-3 py-1 text-sm text-ink-900 hover:border-leaf-600"
              }
            >
              {loc === "fa" ? option.labelFa : option.labelEn}
            </Link>
          );
        })}
        <Link
          href={toggleLink("inStock")}
          aria-pressed={filter.inStock === true}
          className={
            filter.inStock
              ? "rounded-full bg-leaf-700 px-3 py-1 text-sm font-medium text-white"
              : "rounded-full border border-cream-200 bg-white px-3 py-1 text-sm text-ink-900 hover:border-leaf-600"
          }
        >
          {t("inStockOnly")}
        </Link>
        <Link
          href={toggleLink("organic")}
          aria-pressed={filter.organic === true}
          className={
            filter.organic
              ? "rounded-full bg-leaf-700 px-3 py-1 text-sm font-medium text-white"
              : "rounded-full border border-cream-200 bg-white px-3 py-1 text-sm text-ink-900 hover:border-leaf-600"
          }
        >
          {t("organicOnly")}
        </Link>
      </div>

      {filtered.length === 0 ? (
        <p className="rounded-2xl border border-cream-200 bg-white p-8 text-center text-neutral-500">
          {t("noProducts")}
        </p>
      ) : (
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          {filtered.map((product) => (
            <ProductCard key={product.id} product={product} locale={loc} />
          ))}
        </div>
      )}
    </div>
  );
}
