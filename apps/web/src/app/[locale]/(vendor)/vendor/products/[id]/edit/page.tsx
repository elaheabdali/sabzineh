import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { ForbiddenError, UnauthorizedError, requireRole } from "@/lib/auth/guards";
import { getCatalogRepository } from "@/features/catalog/repository";
import { getVendorRepository } from "@/features/vendor/repository";
import { flattenCategoryOptions } from "@/features/vendor/category-options";
import { ProductForm } from "@/components/ProductForm";
import { VendorNav } from "@/components/VendorNav";
import { VendorForbidden } from "@/components/VendorForbidden";
import type { Locale } from "@/i18n/routing";

/** Edit product — the same 3-step form, prefilled. Another vendor's
 *  product (or a missing one) renders "not found": existence is never
 *  leaked across vendors. */
export default async function VendorEditProductPage({
  params,
}: {
  params: Promise<{ locale: Locale; id: string }>;
}) {
  const { locale, id } = await params;
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
  const product = await getVendorRepository().getVendorProduct(vendorId, id);
  if (!product) {
    return (
      <div className="flex flex-col gap-6 pt-8" data-testid="vendor-edit-product">
        <VendorNav />
        <p role="alert" className="text-sm font-bold text-red-700" data-testid="vendor-product-not-found">
          {t("productNotFound")}
        </p>
      </div>
    );
  }
  const tree = await getCatalogRepository().getCategoryTree();
  const categories = flattenCategoryOptions(tree, locale);

  return (
    <div className="flex flex-col gap-6 pt-8" data-testid="vendor-edit-product">
      <VendorNav />
      <h1 className="text-2xl font-black text-ink-900">{t("editProduct")}</h1>
      <ProductForm locale={locale} categories={categories} initial={product} />
    </div>
  );
}
