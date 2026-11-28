import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { ForbiddenError, UnauthorizedError, requireRole } from "@/lib/auth/guards";
import { getVendorRepository } from "@/features/vendor/repository";
import {
  adjustVendorStockAction,
  setVendorProductStatusAction,
} from "@/server/vendor/actions";
import { formatPrice } from "@/lib/format";
import { Link } from "@/i18n/navigation";
import { VendorNav } from "@/components/VendorNav";
import { VendorForbidden } from "@/components/VendorForbidden";
import { ConfirmSubmitButton } from "@/components/ConfirmSubmitButton";
import type { VendorProductStatus } from "@sabzineh/types";
import type { Locale } from "@/i18n/routing";

/**
 * Vendor products (Week 5): search + status filter, quick stock
 * controls, publish / unpublish / archive. All rows are scoped to
 * the session vendor server-side.
 */

const STATUS_OPTIONS: (VendorProductStatus | "ALL")[] = ["ALL", "DRAFT", "PUBLISHED", "ARCHIVED"];

export default async function VendorProductsPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: Locale }>;
  searchParams: Promise<{ q?: string; status?: string }>;
}) {
  const { locale } = await params;
  const query = await searchParams;
  let session;
  try {
    session = await requireRole(["VENDOR"]);
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      redirect(`/${locale}/auth/login?next=/${locale}/vendor/products`);
    }
    if (error instanceof ForbiddenError) return <VendorForbidden />;
    throw error;
  }
  const t = await getTranslations("vendor");
  const vendorId = session.vendorId;
  if (!vendorId) return <VendorForbidden />;
  const status =
    query.status && STATUS_OPTIONS.includes(query.status as VendorProductStatus)
      ? (query.status as VendorProductStatus)
      : undefined;
  const items = await getVendorRepository().listVendorProducts(vendorId, {
    q: query.q?.trim() || undefined,
    status,
  });

  return (
    <div className="flex flex-col gap-6 pt-8" data-testid="vendor-products" data-vendor-id={vendorId}>
      <VendorNav />
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-black text-ink-900">{t("products")}</h1>
        <Link
          href="/vendor/products/new"
          data-testid="new-product-link"
          className="rounded-full bg-leaf-700 px-4 py-2 text-sm font-bold text-white hover:bg-leaf-800"
        >
          {t("newProduct")}
        </Link>
      </div>

      <form method="get" className="flex flex-wrap gap-2" data-testid="vendor-products-filter">
        <input
          type="search"
          name="q"
          defaultValue={query.q ?? ""}
          placeholder={t("searchProducts")}
          aria-label={t("searchProducts")}
          className="min-w-48 flex-1 rounded-xl border border-cream-200 bg-white px-4 py-2 text-sm outline-none focus:border-leaf-600"
        />
        <select
          name="status"
          defaultValue={query.status ?? "ALL"}
          aria-label={t("allStatuses")}
          className="rounded-xl border border-cream-200 bg-white px-4 py-2 text-sm outline-none focus:border-leaf-600"
        >
          {STATUS_OPTIONS.map((option) => (
            <option key={option} value={option}>
              {option === "ALL" ? t("allStatuses") : t(option.toLowerCase() as "draft" | "published" | "archived")}
            </option>
          ))}
        </select>
        <button
          type="submit"
          className="cursor-pointer rounded-xl bg-cream-100 px-4 py-2 text-sm font-bold text-ink-900 hover:bg-cream-200"
        >
          {t("searchProducts")}
        </button>
      </form>

      {items.length === 0 ? (
        <p className="text-sm text-neutral-600">
          {t("noProducts")}{" "}
          <Link href="/vendor/products/new" className="font-bold text-leaf-700 hover:underline">
            {t("createFirstProduct")}
          </Link>
        </p>
      ) : (
        <ul className="flex flex-col gap-3">
          {items.map((product) => (
            <li
              key={product.id}
              className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-cream-200 bg-white p-4 text-sm"
              data-testid="vendor-product-row"
              data-product-id={product.id}
              data-product-slug={product.slug}
              data-status={product.status}
            >
              <span className="font-bold text-ink-900">{product.title}</span>
              <span>
                {t("price")}: {formatPrice(product.price, locale)}
              </span>
              <span data-testid="vendor-product-stock">
                {t("stock")}: {product.stock.toLocaleString(locale === "fa" ? "fa-IR" : "en-US")}
              </span>
              <span className="rounded-full bg-cream-100 px-3 py-1 text-xs font-bold">
                {t(product.status.toLowerCase() as "draft" | "published" | "archived")}
              </span>
              <span className="flex flex-wrap items-center gap-2">
                <Link
                  href={`/vendor/products/${product.id}/edit`}
                  className="font-bold text-leaf-700 hover:underline"
                >
                  {t("editProduct")}
                </Link>
                {product.status === "DRAFT" ? (
                  <form action={setVendorProductStatusAction}>
                    <input type="hidden" name="productId" value={product.id} />
                    <input type="hidden" name="status" value="PUBLISHED" />
                    <button
                      type="submit"
                      data-testid="publish-product-button"
                      className="cursor-pointer rounded-full bg-leaf-700 px-3 py-1 text-xs font-bold text-white"
                    >
                      {t("publish")}
                    </button>
                  </form>
                ) : null}
                {product.status === "PUBLISHED" ? (
                  <form action={setVendorProductStatusAction}>
                    <input type="hidden" name="productId" value={product.id} />
                    <input type="hidden" name="status" value="DRAFT" />
                    <button
                      type="submit"
                      data-testid="unpublish-product-button"
                      className="cursor-pointer rounded-full bg-cream-100 px-3 py-1 text-xs font-bold text-ink-900"
                    >
                      {t("unpublish")}
                    </button>
                  </form>
                ) : null}
                {product.status !== "ARCHIVED" ? (
                  <form action={setVendorProductStatusAction}>
                    <input type="hidden" name="productId" value={product.id} />
                    <input type="hidden" name="status" value="ARCHIVED" />
                    <ConfirmSubmitButton
                      message={t("archiveConfirm")}
                      className="cursor-pointer rounded-full bg-red-50 px-3 py-1 text-xs font-bold text-red-700"
                    >
                      {t("archive")}
                    </ConfirmSubmitButton>
                  </form>
                ) : null}
                <form action={adjustVendorStockAction} className="flex items-center gap-1">
                  <input type="hidden" name="productId" value={product.id} />
                  <input type="hidden" name="delta" value="-1" />
                  <button
                    type="submit"
                    data-testid="stock-decrease"
                    aria-label={t("decreaseStock")}
                    className="cursor-pointer rounded-full bg-cream-100 px-2 py-1 text-xs font-bold"
                  >
                    −
                  </button>
                </form>
                <form action={adjustVendorStockAction} className="flex items-center gap-1">
                  <input type="hidden" name="productId" value={product.id} />
                  <input type="hidden" name="delta" value="1" />
                  <button
                    type="submit"
                    data-testid="stock-increase"
                    aria-label={t("increaseStock")}
                    className="cursor-pointer rounded-full bg-cream-100 px-2 py-1 text-xs font-bold"
                  >
                    +
                  </button>
                </form>
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
