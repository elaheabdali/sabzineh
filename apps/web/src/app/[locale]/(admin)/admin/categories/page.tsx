import { getTranslations } from "next-intl/server";
import { adminGuard } from "@/server/admin/page-guard";
import { getCatalogRepository } from "@/features/catalog/repository";
import { AdminNav } from "@/components/AdminNav";
import {
  createCategoryAction,
  deleteCategoryAction,
  updateCategoryAction,
} from "@/server/admin/actions";
import type { Locale } from "@/i18n/routing";
import type { CategoryNode } from "@/data/seed";

/**
 * Admin category tree (Week 6): add / rename / move / reorder /
 * delete. The tree rules (max 3 levels, no cycles, no deleting a
 * category that still holds products unless they are reassigned)
 * are enforced in the admin service; changes show in the MegaMenu
 * and catalog immediately (same repository).
 */
export default async function AdminCategoriesPage({
  params,
}: {
  params: Promise<{ locale: Locale }>;
}) {
  const { locale } = await params;
  const guard = await adminGuard(locale, `/${locale}/admin/categories`);
  if ("element" in guard) return guard.element;
  const t = await getTranslations("admin");
  const repo = getCatalogRepository();
  const [tree, flat] = await Promise.all([repo.getCategoryTree(), repo.listAllCategories()]);

  const rows: { node: CategoryNode; depth: number }[] = [];
  const walk = (nodes: CategoryNode[], depth: number): void => {
    for (const node of nodes) {
      rows.push({ node, depth });
      walk(node.children, depth + 1);
    }
  };
  walk(tree, 0);

  return (
    <div className="flex flex-col gap-6 pt-8" data-testid="admin-categories">
      <AdminNav />
      <h1 className="text-2xl font-black text-ink-900">{t("categories")}</h1>
      <p className="text-sm text-neutral-600">{t("deleteCategoryHint")}</p>

      <form
        action={createCategoryAction}
        className="flex flex-wrap items-end gap-2 rounded-2xl border border-cream-200 bg-white p-4"
        data-testid="create-category-form"
      >
        <label className="flex flex-col gap-1 text-xs font-bold text-neutral-600">
          {t("slug")}
          <input
            type="text"
            name="slug"
            required
            pattern="[a-z0-9]+(-[a-z0-9]+)*"
            className="rounded-xl border border-cream-200 px-3 py-2 text-sm font-normal"
          />
        </label>
        <label className="flex flex-col gap-1 text-xs font-bold text-neutral-600">
          {t("nameFa")}
          <input
            type="text"
            name="nameFa"
            required
            minLength={2}
            className="rounded-xl border border-cream-200 px-3 py-2 text-sm font-normal"
          />
        </label>
        <label className="flex flex-col gap-1 text-xs font-bold text-neutral-600">
          {t("nameEn")}
          <input
            type="text"
            name="nameEn"
            required
            minLength={2}
            className="rounded-xl border border-cream-200 px-3 py-2 text-sm font-normal"
          />
        </label>
        <label className="flex flex-col gap-1 text-xs font-bold text-neutral-600">
          {t("parentCategory")}
          <select
            name="parentId"
            defaultValue=""
            className="rounded-xl border border-cream-200 px-3 py-2 text-sm font-normal"
          >
            <option value="">{t("noParent")}</option>
            {flat.map((c) => (
              <option key={c.id} value={c.id}>
                {locale === "fa" ? c.nameFa : c.nameEn}
              </option>
            ))}
          </select>
        </label>
        <button
          type="submit"
          className="cursor-pointer rounded-xl bg-leaf-600 px-4 py-2 text-sm font-bold text-white"
        >
          {t("addCategory")}
        </button>
      </form>

      <ul className="flex flex-col gap-2">
        {rows.map(({ node, depth }) => (
          <li
            key={node.id}
            className="rounded-2xl border border-cream-200 bg-white p-4"
            style={{ marginInlineStart: depth * 24 }}
            data-testid="admin-category-row"
            data-category-id={node.id}
          >
            <form action={updateCategoryAction} className="flex flex-wrap items-center gap-2 text-sm">
              <input type="hidden" name="id" value={node.id} />
              <span className="font-bold text-ink-900">
                {locale === "fa" ? node.nameFa : node.nameEn}
              </span>
              <span className="text-xs text-neutral-500">
                {node.slug} · {node.productCount}
              </span>
              <input
                type="text"
                name="nameFa"
                defaultValue={node.nameFa}
                aria-label={t("nameFa")}
                className="w-32 rounded-xl border border-cream-200 px-2 py-1 text-sm"
              />
              <input
                type="text"
                name="nameEn"
                defaultValue={node.nameEn}
                aria-label={t("nameEn")}
                className="w-32 rounded-xl border border-cream-200 px-2 py-1 text-sm"
              />
              <select
                name="parentId"
                defaultValue={node.parentId ?? ""}
                aria-label={t("parentCategory")}
                className="rounded-xl border border-cream-200 px-2 py-1 text-sm"
              >
                <option value="">{t("noParent")}</option>
                {flat
                  .filter((c) => c.id !== node.id)
                  .map((c) => (
                    <option key={c.id} value={c.id}>
                      {locale === "fa" ? c.nameFa : c.nameEn}
                    </option>
                  ))}
              </select>
              <input
                type="number"
                name="sortOrder"
                defaultValue={node.sortOrder}
                aria-label={t("sortOrder")}
                className="w-16 rounded-xl border border-cream-200 px-2 py-1 text-sm"
              />
              <button
                type="submit"
                data-testid={`save-category-${node.id}`}
                className="cursor-pointer rounded-full bg-leaf-600 px-3 py-1 text-xs font-bold text-white"
              >
                {t("save")}
              </button>
            </form>
            <form action={deleteCategoryAction} className="mt-2 flex flex-wrap items-center gap-2 text-sm">
              <input type="hidden" name="id" value={node.id} />
              <select
                name="reassignTo"
                defaultValue=""
                aria-label={t("reassignTo")}
                className="rounded-xl border border-cream-200 px-2 py-1 text-sm"
              >
                <option value="">{t("noReassign")}</option>
                {flat
                  .filter((c) => c.id !== node.id)
                  .map((c) => (
                    <option key={c.id} value={c.id}>
                      {locale === "fa" ? c.nameFa : c.nameEn}
                    </option>
                  ))}
              </select>
              <button
                type="submit"
                data-testid={`delete-category-${node.id}`}
                className="cursor-pointer rounded-full bg-red-600 px-3 py-1 text-xs font-bold text-white"
              >
                {t("deleteCategory")}
              </button>
            </form>
          </li>
        ))}
      </ul>
    </div>
  );
}
