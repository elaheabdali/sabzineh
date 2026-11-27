import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { ForbiddenError, UnauthorizedError, requireRole } from "@/lib/auth/guards";
import { getCatalogRepository } from "@/features/catalog/repository";
import { formatPrice } from "@/lib/format";
import type { Locale } from "@/i18n/routing";

/**
 * Vendor products — only the signed-in vendor's own products.
 * vendorId comes from the session; the filter is applied server-side.
 * (The full product form + uploader land in Week 5.)
 */
export default async function VendorProductsPage({
  params,
}: {
  params: Promise<{ locale: Locale }>;
}) {
  const { locale } = await params;
  let session;
  try {
    session = await requireRole(["VENDOR"]);
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      redirect(`/${locale}/auth/login?next=/${locale}/vendor/products`);
    }
    if (error instanceof ForbiddenError) {
      const t = await getTranslations("account");
      return (
        <div className="flex flex-col gap-4 pt-8" data-testid="vendor-products">
          <h1 className="text-2xl font-black text-ink-900">{t("forbidden")}</h1>
          <p className="text-sm text-neutral-600">{t("forbiddenHint")}</p>
        </div>
      );
    }
    throw error;
  }
  const t = await getTranslations("vendor");
  const vendorId = session.vendorId;
  if (!vendorId) {
    const tAccount = await getTranslations("account");
    return (
      <div className="flex flex-col gap-4 pt-8" data-testid="vendor-products">
        <h1 className="text-2xl font-black text-ink-900">{tAccount("forbidden")}</h1>
      </div>
    );
  }
  const { items } = await getCatalogRepository().listProducts({ vendor: vendorId });

  return (
    <div className="flex flex-col gap-6 pt-8" data-testid="vendor-products" data-vendor-id={vendorId}>
      <h1 className="text-2xl font-black text-ink-900">{t("products")}</h1>
      {items.length === 0 ? (
        <p className="text-sm text-neutral-600">{t("noProducts")}</p>
      ) : (
        <ul className="flex flex-col gap-3">
          {items.map((product) => (
            <li
              key={product.id}
              className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-cream-200 bg-white p-4 text-sm"
              data-testid="vendor-product-row"
              data-product-id={product.id}
            >
              <span className="font-bold text-ink-900">{product.title}</span>
              <span>{t("price")}: {formatPrice(product.price, locale)}</span>
              <span>{t("stock")}: {product.stock}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
