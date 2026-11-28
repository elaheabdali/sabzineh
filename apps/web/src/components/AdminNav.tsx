import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";

/** Sub-navigation shared by every admin page. */
export async function AdminNav() {
  const t = await getTranslations("admin");
  const items = [
    { href: "/admin/dashboard", label: t("dashboard") },
    { href: "/admin/users", label: t("users") },
    { href: "/admin/vendors", label: t("vendors") },
    { href: "/admin/categories", label: t("categories") },
    { href: "/admin/discounts", label: t("discounts") },
    { href: "/admin/orders", label: t("orders") },
    { href: "/admin/payouts", label: t("payouts") },
    { href: "/admin/audit", label: t("audit") },
  ];
  return (
    <nav aria-label={t("dashboard")} className="flex flex-wrap gap-2 border-b border-cream-200 pb-4">
      {items.map((item) => (
        <Link
          key={item.href}
          href={item.href}
          className="rounded-full bg-cream-100 px-4 py-2 text-sm font-bold text-ink-900 hover:bg-leaf-100 hover:text-leaf-700"
        >
          {item.label}
        </Link>
      ))}
    </nav>
  );
}
