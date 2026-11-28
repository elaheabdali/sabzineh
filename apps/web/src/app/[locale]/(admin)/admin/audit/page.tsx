import { getTranslations } from "next-intl/server";
import { adminGuard } from "@/server/admin/page-guard";
import { listAuditLogs } from "@/server/admin/service";
import { AdminNav } from "@/components/AdminNav";
import { formatJalali } from "@/lib/format";
import type { Locale } from "@/i18n/routing";

/** Admin audit log (Week 6): who did what, when. */
export default async function AdminAuditPage({
  params,
}: {
  params: Promise<{ locale: Locale }>;
}) {
  const { locale } = await params;
  const guard = await adminGuard(locale, `/${locale}/admin/audit`);
  if ("element" in guard) return guard.element;
  const t = await getTranslations("admin");
  const logs = await listAuditLogs(50);

  return (
    <div className="flex flex-col gap-6 pt-8" data-testid="admin-audit">
      <AdminNav />
      <h1 className="text-2xl font-black text-ink-900">{t("auditLog")}</h1>
      {logs.length === 0 ? (
        <p className="text-sm text-neutral-600">{t("noAuditLogs")}</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {logs.map((log) => (
            <li
              key={log.id}
              className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-cream-200 bg-white p-4 text-sm"
              data-testid="admin-audit-row"
            >
              <span className="font-bold text-ink-900">{log.action}</span>
              <span className="text-neutral-600">
                {log.entity} · {log.entityId.slice(0, 8)}
              </span>
              <span className="text-xs text-neutral-600">{log.actorId.slice(0, 8)}</span>
              <span className="text-xs text-neutral-600">{formatJalali(log.createdAt, locale)}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
