import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";

/** Sub-navigation shared by every vendor page. */
export async function VendorNav() {
  const t = await getTranslations("vendor");
  const items = [
    { href: "/vendor/dashboard", label: t("dashboard") },
    { href: "/vendor/products", label: t("products") },
    { href: "/vendor/products/new", label: t("newProduct") },
    { href: "/vendor/subscription", label: t("subscription") },
    { href: "/vendor/settings", label: t("settings") },
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
