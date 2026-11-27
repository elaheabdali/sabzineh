import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { ForbiddenError, UnauthorizedError, requireRole } from "@/lib/auth/guards";
import { getDataStore } from "@/server/store";
import type { Locale } from "@/i18n/routing";

/**
 * Admin users — real user list from the store (Week 3 scope).
 * Bulk actions and audit logging land in Week 6.
 */
export default async function AdminUsersPage({
  params,
}: {
  params: Promise<{ locale: Locale }>;
}) {
  const { locale } = await params;
  try {
    await requireRole(["ADMIN"]);
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      redirect(`/${locale}/auth/login?next=/${locale}/admin/users`);
    }
    if (error instanceof ForbiddenError) {
      const t = await getTranslations("account");
      return (
        <div className="flex flex-col gap-4 pt-8" data-testid="admin-users">
          <h1 className="text-2xl font-black text-ink-900">{t("forbidden")}</h1>
          <p className="text-sm text-neutral-600">{t("forbiddenHint")}</p>
        </div>
      );
    }
    throw error;
  }
  const t = await getTranslations("admin");
  const users = await getDataStore().listUsers();

  return (
    <div className="flex flex-col gap-6 pt-8" data-testid="admin-users">
      <h1 className="text-2xl font-black text-ink-900">{t("users")}</h1>
      {users.length === 0 ? (
        <p className="text-sm text-neutral-600">{t("noUsers")}</p>
      ) : (
        <ul className="flex flex-col gap-3">
          {users.map((user) => (
            <li
              key={user.id}
              className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-cream-200 bg-white p-4 text-sm"
              data-testid="admin-user-row"
              data-user-id={user.id}
            >
              <span className="font-bold text-ink-900">{user.name}</span>
              <span className="text-neutral-600">{user.email}</span>
              <span className="rounded-full bg-cream-100 px-3 py-1 text-xs font-bold">{user.role}</span>
              <span className="rounded-full bg-cream-100 px-3 py-1 text-xs font-bold">{user.status}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
