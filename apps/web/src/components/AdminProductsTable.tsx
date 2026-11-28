"use client";

import { useTranslations } from "next-intl";
import { DataTable } from "@sabzineh/ui";
import { usePathname, useRouter } from "@/i18n/navigation";
import { formatPrice } from "@/lib/format";
import { setProductStatusAction } from "@/server/admin/actions";
import type { AdminProductRow } from "@/server/admin/service";
import type { Locale } from "@/i18n/routing";

/**
 * Admin products table (Phase 3): the shared DataTable driven
 * entirely by the URL — sorting and pagination are server-side, so
 * the callbacks just rewrite the query string and let the server
 * component re-render with the requested slice.
 */
export function AdminProductsTable({
  rows,
  total,
  page,
  pageSize,
  sort,
  dir,
  locale,
  query,
}: {
  rows: AdminProductRow[];
  total: number;
  page: number;
  pageSize: number;
  sort: string;
  dir: "asc" | "desc";
  locale: Locale;
  query: Record<string, string | undefined>;
}) {
  const t = useTranslations("admin");
  const router = useRouter();
  const pathname = usePathname();

  const navigate = (patch: Record<string, string | undefined>) => {
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries({ ...query, ...patch })) {
      if (value) params.set(key, value);
    }
    const qs = params.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname);
  };

  return (
    <DataTable<AdminProductRow>
      columns={[
        { key: "title", header: t("name"), sortable: true, render: (p) => <span className="font-bold">{p.title}</span> },
        { key: "shop", header: t("shopName"), render: (p) => p.shopName ?? p.vendorId },
        {
          key: "price",
          header: t("total"),
          sortable: true,
          render: (p) => formatPrice(p.price, locale),
        },
        { key: "stock", header: t("stock"), sortable: true, render: (p) => p.stock },
        { key: "status", header: t("status"), render: (p) => p.status },
        {
          key: "actions",
          header: t("action"),
          render: (p) => (
            <span className="flex flex-wrap items-center gap-2">
              {p.status !== "PUBLISHED" ? (
                <form action={setProductStatusAction}>
                  <input type="hidden" name="productId" value={p.id} />
                  <input type="hidden" name="status" value="PUBLISHED" />
                  <button
                    type="submit"
                    data-testid={`product-publish-${p.id}`}
                    className="cursor-pointer rounded-full bg-leaf-600 px-3 py-1 text-xs font-bold text-white"
                  >
                    {t("approve")}
                  </button>
                </form>
              ) : null}
              {p.status !== "ARCHIVED" ? (
                <form action={setProductStatusAction}>
                  <input type="hidden" name="productId" value={p.id} />
                  <input type="hidden" name="status" value="ARCHIVED" />
                  <button
                    type="submit"
                    data-testid={`product-archive-${p.id}`}
                    className="cursor-pointer rounded-full bg-cream-100 px-3 py-1 text-xs font-bold text-ink-900"
                  >
                    {t("archiveProduct")}
                  </button>
                </form>
              ) : null}
              {p.status === "ARCHIVED" ? (
                <form action={setProductStatusAction}>
                  <input type="hidden" name="productId" value={p.id} />
                  <input type="hidden" name="status" value="DRAFT" />
                  <button
                    type="submit"
                    data-testid={`product-restore-${p.id}`}
                    className="cursor-pointer rounded-full bg-cream-100 px-3 py-1 text-xs font-bold text-ink-900"
                  >
                    {t("restoreProduct")}
                  </button>
                </form>
              ) : null}
            </span>
          ),
        },
      ]}
      rows={rows}
      rowKey={(p) => p.id}
      page={page}
      pageSize={pageSize}
      total={total}
      onPageChange={(next) => navigate({ page: String(next) })}
      sort={{ key: sort, dir }}
      onSortChange={(key, nextDir) => navigate({ sort: key, dir: nextDir, page: "1" })}
      emptyMessage={t("noProducts")}
    />
  );
}
