import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { getCatalogRepository } from "@/features/catalog/repository";
import { getVendorRepository } from "@/features/vendor/repository";
import { ProductCard } from "@/components/ProductCard";
import type { Locale } from "@/i18n/routing";

/**
 * Public vendor shop page (Week 5): shop name, city, rating, bio and
 * the vendor's published products. Payout fields are never rendered.
 * Only APPROVED vendors have a public page.
 */
export default async function VendorShopPage({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}) {
  const { locale, slug } = await params;
  const loc = (locale === "en" ? "en" : "fa") as Locale;
  const t = await getTranslations("vendor");
  const repo = getVendorRepository();
  const profile = await repo.getVendorProfileBySlug(slug);
  if (!profile || profile.status !== "APPROVED") notFound();
  const { items } = await getCatalogRepository().listProducts({ vendor: profile.id });

  return (
    <div className="flex flex-col gap-6 pt-8" data-testid="vendor-shop" data-vendor-id={profile.id}>
      <div className="flex flex-col gap-2 rounded-3xl border border-cream-200 bg-white p-6">
        <h1 className="text-2xl font-black text-ink-900">{profile.shopName}</h1>
        <p className="text-sm text-neutral-500">
          {profile.city}
          <span className="ms-2" aria-label={`Rating ${profile.rating} of 5`}>
            ★ {profile.rating.toLocaleString(loc === "fa" ? "fa-IR" : "en-US")}
          </span>
        </p>
        {profile.bio ? <p className="text-sm leading-7 text-neutral-600">{profile.bio}</p> : null}
      </div>
      <h2 className="text-lg font-bold text-ink-900">{t("products")}</h2>
      {items.length === 0 ? (
        <p className="text-sm text-neutral-600">{t("noShopProducts")}</p>
      ) : (
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          {items.map((item) => (
            <ProductCard key={item.id} product={item} locale={loc} />
          ))}
        </div>
      )}
    </div>
  );
}
