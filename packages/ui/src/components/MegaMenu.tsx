"use client";

import { useState } from "react";
import { ChevronDown, ChevronLeft } from "lucide-react";
import { cn } from "../cn";

export interface MegaMenuNode {
  id: string;
  slug: string;
  nameFa: string;
  nameEn: string;
  children?: MegaMenuNode[];
}

export interface MegaMenuProps {
  tree: MegaMenuNode[];
  /** Locale for the label language. */
  locale: "fa" | "en";
  /** Builds the href for a category node. */
  hrefFor: (node: MegaMenuNode) => string;
  onNavigate?: () => void;
}

/**
 * Mega menu fed by the 3-level category tree.
 * Desktop: hover/focus opens a full-width panel with level-2 columns
 * and their level-3 links. Mobile: accordion inside the drawer.
 * Week 1 renders it in the header (desktop) and the mobile menu.
 */
export function MegaMenu({ tree, locale, hrefFor, onNavigate }: MegaMenuProps) {
  const [openId, setOpenId] = useState<string | null>(null);
  const [mobileOpen, setMobileOpen] = useState<Record<string, boolean>>({});

  const label = (node: MegaMenuNode) => (locale === "fa" ? node.nameFa : node.nameEn);

  return (
    <nav aria-label="Categories" className="w-full">
      {/* Desktop */}
      <ul className="hidden items-stretch gap-1 lg:flex" onMouseLeave={() => setOpenId(null)}>
        {tree.map((top) => (
          <li key={top.id} className="relative" onMouseEnter={() => setOpenId(top.id)}>
            <a
              href={hrefFor(top)}
              aria-expanded={openId === top.id}
              onClick={onNavigate}
              className={cn(
                "flex items-center gap-1 rounded-lg px-3 py-2 text-sm font-medium text-ink-900 hover:bg-cream-100",
                openId === top.id && "bg-cream-100",
              )}
            >
              {label(top)}
              <ChevronDown className="size-4 text-neutral-600" aria-hidden="true" />
            </a>
            {openId === top.id && top.children?.length ? (
              <div className="absolute start-0 top-full z-50 mt-1 w-[36rem] rounded-2xl border border-cream-200 bg-white p-6 shadow-xl">
                <div className="grid grid-cols-3 gap-6">
                  {(top.children ?? []).map((level2) => (
                    <div key={level2.id}>
                      <a
                        href={hrefFor(level2)}
                        onClick={onNavigate}
                        className="mb-2 block text-sm font-bold text-leaf-700 hover:underline"
                      >
                        {label(level2)}
                      </a>
                      <ul className="flex flex-col gap-1">
                        {(level2.children ?? []).map((level3) => (
                          <li key={level3.id}>
                            <a
                              href={hrefFor(level3)}
                              onClick={onNavigate}
                              className="text-sm text-neutral-600 hover:text-leaf-700 hover:underline"
                            >
                              {label(level3)}
                            </a>
                          </li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}
          </li>
        ))}
      </ul>

      {/* Mobile accordion */}
      <ul className="flex flex-col lg:hidden">
        {tree.map((top) => {
          const expanded = mobileOpen[top.id] ?? false;
          return (
            <li key={top.id} className="border-b border-cream-100">
              <button
                type="button"
                aria-expanded={expanded}
                onClick={() => setMobileOpen((prev) => ({ ...prev, [top.id]: !prev[top.id] }))}
                className="flex w-full cursor-pointer items-center justify-between px-2 py-3 text-start text-sm font-medium text-ink-900"
              >
                {label(top)}
                <ChevronLeft
                  className={cn("size-4 text-neutral-600 transition-transform", expanded && "-rotate-90")}
                  aria-hidden="true"
                />
              </button>
              {expanded ? (
                <ul className="flex flex-col gap-1 pb-3 ps-4">
                  {(top.children ?? []).map((level2) => (
                    <li key={level2.id}>
                      <a
                        href={hrefFor(level2)}
                        onClick={onNavigate}
                        className="block py-1 text-sm font-semibold text-leaf-700"
                      >
                        {label(level2)}
                      </a>
                      <ul className="flex flex-col gap-1 ps-3">
                        {(level2.children ?? []).map((level3) => (
                          <li key={level3.id}>
                            <a
                              href={hrefFor(level3)}
                              onClick={onNavigate}
                              className="block py-1 text-sm text-neutral-600"
                            >
                              {label(level3)}
                            </a>
                          </li>
                        ))}
                      </ul>
                    </li>
                  ))}
                </ul>
              ) : null}
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
