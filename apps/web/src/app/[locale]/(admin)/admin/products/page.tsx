import { getTranslations } from "next-intl/server";
import { adminGuard } from "@/server/admin/page-guard";
import { listAdminProducts, type AdminProductSort } from "@/server/admin/service";
import { AdminNav } from "@/components/AdminNav";
import { AdminProductsTable } from "@/components/AdminProductsTable";
import type { Locale } from "@/i18n/routing";

/**
 * Admin products (Phase 3): every product in the marketplace with
 * URL-driven search, status filter, server-side sorting and
 * pagination, plus moderation actions (publish / archive / restore).
 */
export default async function AdminProductsPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: Locale }>;
  searchParams: Promise<{ q?: string; status?: string; sort?: string; dir?: string; page?: string }>;
}) {
  const { locale } = await params;
  const sp = await searchParams;
  const guard = await adminGuard(locale, `/${locale}/admin/products`);
  if ("element" in guard) return guard.element;
  const t = await getTranslations("admin");
  const status =
    sp.status === "DRAFT" || sp.status === "PUBLISHED" || sp.status === "ARCHIVED"
      ? sp.status
      : undefined;
  const sort: AdminProductSort =
    sp.sort === "price" || sp.sort === "stock" ? sp.sort : "title";
  const dir = sp.dir === "desc" ? "desc" : "asc";
  const page = Math.max(1, Number.parseInt(sp.page ?? "1", 10) || 1);
  const result = await listAdminProducts({ status, q: sp.q, sort, dir, page, pageSize: 10 });

  return (
    <div className="flex flex-col gap-6 pt-8" data-testid="admin-products">
      <AdminNav />
      <h1 className="text-2xl font-black text-ink-900">{t("products")}</h1>
      <form method="get" className="flex flex-wrap gap-2" data-testid="admin-products-filter">
        <input
          type="search"
          name="q"
          defaultValue={sp.q ?? ""}
          placeholder={t("searchPlaceholder")}
          aria-label={t("search")}
          className="rounded-xl border border-cream-200 bg-white px-3 py-2 text-sm"
        />
        <select
          name="status"
          defaultValue={status ?? ""}
          aria-label={t("status")}
          className="rounded-xl border border-cream-200 bg-white px-3 py-2 text-sm"
        >
          <option value="">{t("allStatuses")}</option>
          <option value="PUBLISHED">PUBLISHED</option>
          <option value="DRAFT">DRAFT</option>
          <option value="ARCHIVED">ARCHIVED</option>
        </select>
        <button
          type="submit"
          className="cursor-pointer rounded-xl bg-leaf-600 px-4 py-2 text-sm font-bold text-white"
        >
          {t("search")}
        </button>
      </form>
      <AdminProductsTable
        rows={result.rows}
        total={result.total}
        page={result.page}
        pageSize={result.pageSize}
        sort={sort}
        dir={dir}
        locale={locale}
        query={{ q: sp.q, status, sort, dir }}
      />
    </div>
  );
}
