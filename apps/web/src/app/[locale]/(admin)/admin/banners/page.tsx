import { getTranslations } from "next-intl/server";
import { adminGuard } from "@/server/admin/page-guard";
import { listAdminBanners } from "@/server/admin/service";
import { deleteBannerAction } from "@/server/admin/actions";
import { AdminNav } from "@/components/AdminNav";
import { AdminBannerForm } from "@/components/AdminBannerForm";
import type { Locale } from "@/i18n/routing";

/**
 * Admin banners (Phase 3): create, edit and delete the storefront
 * banners the home page renders (HOME_HERO / HOME_STRIP / CATEGORY),
 * with active flags and an optional date window.
 */
export default async function AdminBannersPage({
  params,
}: {
  params: Promise<{ locale: Locale }>;
}) {
  const { locale } = await params;
  const guard = await adminGuard(locale, `/${locale}/admin/banners`);
  if ("element" in guard) return guard.element;
  const t = await getTranslations("admin");
  const banners = await listAdminBanners();

  return (
    <div className="flex flex-col gap-8 pt-8" data-testid="admin-banners">
      <AdminNav />
      <h1 className="text-2xl font-black text-ink-900">{t("banners")}</h1>

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-black text-ink-900">{t("createBanner")}</h2>
        <AdminBannerForm />
      </section>

      <section className="flex flex-col gap-4">
        {banners.length === 0 ? (
          <p className="text-sm text-neutral-600">{t("noBanners")}</p>
        ) : (
          banners.map((banner) => (
            <article
              key={banner.id}
              className="flex flex-col gap-3 rounded-2xl border border-cream-200 bg-white p-4"
              data-testid={`admin-banner-${banner.id}`}
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="font-bold text-ink-900">
                  {banner.title} <span className="text-xs text-neutral-600">({banner.placement})</span>
                </p>
                <span className="text-xs text-neutral-600">{banner.active ? t("active") : t("suspended")}</span>
              </div>
              <AdminBannerForm banner={banner} />
              <form action={deleteBannerAction}>
                <input type="hidden" name="bannerId" value={banner.id} />
                <button
                  type="submit"
                  data-testid={`banner-delete-${banner.id}`}
                  className="cursor-pointer rounded-full bg-red-50 px-3 py-1 text-xs font-bold text-red-700"
                >
                  {t("deleteBanner")}
                </button>
              </form>
            </article>
          ))
        )}
      </section>
    </div>
  );
}
