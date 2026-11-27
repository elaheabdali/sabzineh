"use client";

import { useState, useSyncExternalStore } from "react";
import { Menu, ShoppingBasket, X } from "lucide-react";
import { MegaMenu, type MegaMenuNode } from "@sabzineh/ui";
import { Link, usePathname } from "@/i18n/navigation";
import { useCartStore } from "@/stores/cart";
import { HeaderSearch } from "./SearchForm";
import type { Locale } from "@/i18n/routing";
import type { SessionUser } from "@sabzineh/types";
import { logoutAction } from "@/server/auth/actions";
import { useTranslations } from "next-intl";

interface HeaderProps {
  locale: Locale;
  categoryTree: MegaMenuNode[];
  sessionUser: SessionUser | null;
}

/** Site header: brand, MegaMenu (desktop + mobile accordion), cart, locale switch. */
export function Header({ locale, categoryTree, sessionUser }: HeaderProps) {
  const t = useTranslations("nav");
  const [mobileOpen, setMobileOpen] = useState(false);
  const count = useCartStore((state) => state.count());
  const pathname = usePathname();

  // Cart count lives in localStorage: render it only on the client to
  // avoid a server/client hydration mismatch (no setState-in-effect).
  const mounted = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );

  const otherLocale: Locale = locale === "fa" ? "en" : "fa";

  return (
    <header className="sticky top-0 z-40 border-b border-cream-200 bg-cream-50/95 backdrop-blur">
      <div className="mx-auto flex w-full max-w-7xl items-center gap-4 px-4 py-3">
        <button
          type="button"
          aria-label={mobileOpen ? "Close menu" : "Open menu"}
          aria-expanded={mobileOpen}
          onClick={() => setMobileOpen((v) => !v)}
          className="cursor-pointer rounded-lg p-2 hover:bg-cream-100 lg:hidden"
        >
          {mobileOpen ? <X className="size-5" aria-hidden="true" /> : <Menu className="size-5" aria-hidden="true" />}
        </button>
        <Link href="/" className="text-xl font-black text-leaf-700">
          {locale === "fa" ? "سبزینه" : "Sabzineh"}
        </Link>
        <div className="hidden flex-1 lg:block">
          <MegaMenu
            tree={categoryTree}
            locale={locale}
            hrefFor={(node) => `/${locale}/category/${node.slug}`}
          />
        </div>
        <HeaderSearch />
        <div className="ms-auto flex items-center gap-2">
          {sessionUser ? (
            <>
              <span className="hidden text-sm font-medium text-ink-900 md:block" data-testid="header-user">
                {sessionUser.name}
              </span>
              <Link
                href={
                  sessionUser.role === "ADMIN"
                    ? "/admin/dashboard"
                    : sessionUser.role === "VENDOR"
                      ? "/vendor/dashboard"
                      : "/account/orders"
                }
                className="hidden rounded-lg px-3 py-2 text-sm font-medium text-ink-900 hover:bg-cream-100 sm:block"
              >
                {sessionUser.role === "ADMIN"
                  ? t("adminPanel")
                  : sessionUser.role === "VENDOR"
                    ? t("vendorPanel")
                    : t("orders")}
              </Link>
              <form action={logoutAction}>
                <button
                  type="submit"
                  data-testid="logout-button"
                  className="cursor-pointer rounded-lg px-3 py-2 text-sm font-medium text-ink-900 hover:bg-cream-100"
                >
                  {t("logout")}
                </button>
              </form>
            </>
          ) : (
            <Link
              href="/auth/login"
              data-testid="login-link"
              className="rounded-lg px-3 py-2 text-sm font-medium text-ink-900 hover:bg-cream-100"
            >
              {t("login")}
            </Link>
          )}
          <Link
            href={pathname}
            locale={otherLocale}
            className="rounded-lg border border-cream-200 px-3 py-2 text-sm font-medium text-ink-900 hover:bg-cream-100"
          >
            {otherLocale === "fa" ? "فارسی" : "English"}
          </Link>
          <Link
            href="/cart"
            aria-label={t("cart")}
            className="relative rounded-lg p-2 hover:bg-cream-100"
          >
            <ShoppingBasket className="size-5" aria-hidden="true" />
            {mounted && count > 0 ? (
              <span className="absolute -end-1 -top-1 flex size-5 items-center justify-center rounded-full bg-leaf-700 text-[11px] font-bold text-white">
                {count.toLocaleString(locale === "fa" ? "fa-IR" : "en-US")}
              </span>
            ) : null}
          </Link>
        </div>
      </div>
      {mobileOpen ? (
        <div className="border-t border-cream-200 bg-cream-50 px-4 py-2 lg:hidden">
          <MegaMenu
            tree={categoryTree}
            locale={locale}
            hrefFor={(node) => `/${locale}/category/${node.slug}`}
            onNavigate={() => setMobileOpen(false)}
          />
        </div>
      ) : null}
    </header>
  );
}
