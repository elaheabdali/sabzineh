import { getTranslations } from "next-intl/server";
import { adminGuard } from "@/server/admin/page-guard";
import { listAdminUsers } from "@/server/admin/service";
import { AdminNav } from "@/components/AdminNav";
import { AdminUsersTable } from "@/components/AdminUsersTable";
import type { Locale } from "@/i18n/routing";
import type { Role } from "@sabzineh/types";

/**
 * Admin users (Week 6): search + role filter (server, via URL) and
 * the shared DataTable with suspend/activate actions.
 */
export default async function AdminUsersPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: Locale }>;
  searchParams: Promise<{ q?: string; role?: string }>;
}) {
  const { locale } = await params;
  const { q, role } = await searchParams;
  const guard = await adminGuard(locale, `/${locale}/admin/users`);
  if ("element" in guard) return guard.element;
  const t = await getTranslations("admin");
  const validRole = role === "CUSTOMER" || role === "VENDOR" || role === "ADMIN" ? (role as Role) : undefined;
  const users = await listAdminUsers({ q, role: validRole });

  return (
    <div className="flex flex-col gap-6 pt-8" data-testid="admin-users">
      <AdminNav />
      <h1 className="text-2xl font-black text-ink-900">{t("users")}</h1>
      <form method="get" className="flex flex-wrap gap-2" data-testid="admin-users-filter">
        <input
          type="search"
          name="q"
          defaultValue={q ?? ""}
          placeholder={t("searchPlaceholder")}
          aria-label={t("search")}
          className="rounded-xl border border-cream-200 bg-white px-3 py-2 text-sm"
        />
        <select
          name="role"
          defaultValue={role ?? ""}
          aria-label={t("role")}
          className="rounded-xl border border-cream-200 bg-white px-3 py-2 text-sm"
        >
          <option value="">{t("allRoles")}</option>
          <option value="CUSTOMER">CUSTOMER</option>
          <option value="VENDOR">VENDOR</option>
          <option value="ADMIN">ADMIN</option>
        </select>
        <button
          type="submit"
          className="cursor-pointer rounded-xl bg-leaf-600 px-4 py-2 text-sm font-bold text-white"
        >
          {t("search")}
        </button>
      </form>
      <AdminUsersTable users={users} />
    </div>
  );
}
