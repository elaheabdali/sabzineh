import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { ForbiddenError, UnauthorizedError, requireRole } from "@/lib/auth/guards";
import { getCatalogRepository } from "@/features/catalog/repository";
import { flattenCategoryOptions } from "@/features/vendor/category-options";
import { ProductForm } from "@/components/ProductForm";
import { VendorNav } from "@/components/VendorNav";
import { VendorForbidden } from "@/components/VendorForbidden";
import type { Locale } from "@/i18n/routing";

/** New product — the 3-step form, empty. */
export default async function VendorNewProductPage({
  params,
}: {
  params: Promise<{ locale: Locale }>;
}) {
  const { locale } = await params;
  try {
    await requireRole(["VENDOR"]);
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      redirect(`/${locale}/auth/login?next=/${locale}/vendor/products/new`);
    }
    if (error instanceof ForbiddenError) return <VendorForbidden />;
    throw error;
  }
  const t = await getTranslations("vendor");
  const tree = await getCatalogRepository().getCategoryTree();
  const categories = flattenCategoryOptions(tree, locale);

  return (
    <div className="flex flex-col gap-6 pt-8" data-testid="vendor-new-product">
      <VendorNav />
      <h1 className="text-2xl font-black text-ink-900">{t("newProduct")}</h1>
      <ProductForm locale={locale} categories={categories} />
    </div>
  );
}
