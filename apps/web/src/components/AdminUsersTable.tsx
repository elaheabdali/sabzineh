"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { DataTable } from "@sabzineh/ui";
import type { UserSummary } from "@/server/store";
import { setUserStatusAction } from "@/server/admin/actions";
import { Link } from "@/i18n/navigation";

/**
 * Admin users table (Week 6): the shared DataTable with client-side
 * pagination over the server-filtered list, plus per-row
 * suspend/activate actions and a detail link.
 */
export function AdminUsersTable({ users }: { users: UserSummary[] }) {
  const t = useTranslations("admin");
  const [page, setPage] = useState(1);
  const pageSize = 10;
  const pageCount = Math.max(1, Math.ceil(users.length / pageSize));
  const safePage = Math.min(page, pageCount);
  const rows = users.slice((safePage - 1) * pageSize, safePage * pageSize);

  return (
    <DataTable<UserSummary>
      columns={[
        { key: "name", header: t("name"), render: (u) => <span className="font-bold">{u.name}</span> },
        { key: "email", header: t("email"), render: (u) => u.email },
        { key: "role", header: t("role"), render: (u) => u.role },
        { key: "status", header: t("status"), render: (u) => u.status },
        {
          key: "actions",
          header: t("action"),
          render: (u) => (
            <span className="flex flex-wrap items-center gap-2">
              <Link
                href={`/admin/users/${u.id}`}
                className="rounded-full bg-cream-100 px-3 py-1 text-xs font-bold text-ink-900"
              >
                {t("viewDetail")}
              </Link>
              <form action={setUserStatusAction}>
                <input type="hidden" name="userId" value={u.id} />
                <input
                  type="hidden"
                  name="status"
                  value={u.status === "SUSPENDED" ? "ACTIVE" : "SUSPENDED"}
                />
                <button
                  type="submit"
                  data-testid={`user-${u.status === "SUSPENDED" ? "activate" : "suspend"}-${u.id}`}
                  className="cursor-pointer rounded-full bg-leaf-600 px-3 py-1 text-xs font-bold text-white"
                >
                  {u.status === "SUSPENDED" ? t("activate") : t("suspend")}
                </button>
              </form>
            </span>
          ),
        },
      ]}
      rows={rows}
      rowKey={(u) => u.id}
      page={safePage}
      pageSize={pageSize}
      total={users.length}
      onPageChange={setPage}
      emptyMessage={t("noUsers")}
    />
  );
}
