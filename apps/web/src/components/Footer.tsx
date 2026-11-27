import type { Locale } from "@/i18n/routing";
import { Link } from "@/i18n/navigation";

/** Minimal footer (Week 1). Real links, contact and newsletter land later. */
export function Footer({ locale }: { locale: Locale }) {
  return (
    <footer className="border-t border-cream-200 bg-leaf-900 py-10 text-cream-100">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-lg font-black">{locale === "fa" ? "سبزینه" : "Sabzineh"}</p>
          <p className="mt-1 max-w-sm text-sm text-cream-200/80">
            {locale === "fa"
              ? "مارکت‌پلیس محصولات ارگانیک و غذایی محلی، با باکس اشتراک هفتگی."
              : "Marketplace for organic and local food, with a weekly subscription box."}
          </p>
        </div>
        <nav aria-label="Footer" className="flex flex-col gap-2 text-sm">
          <Link href="/account/orders" className="hover:underline">
            {locale === "fa" ? "سفارش‌های من" : "My orders"}
          </Link>
          <Link href="/vendor/dashboard" className="hover:underline">
            {locale === "fa" ? "پنل فروشنده" : "Vendor panel"}
          </Link>
          <Link href="/admin/dashboard" className="hover:underline">
            {locale === "fa" ? "پنل مدیریت" : "Admin panel"}
          </Link>
        </nav>
      </div>
    </footer>
  );
}
