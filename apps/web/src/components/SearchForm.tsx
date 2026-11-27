"use client";

import { useState } from "react";
import { useRouter } from "@/i18n/navigation";
import { useTranslations } from "next-intl";
import { Search } from "lucide-react";
import { buildFilterSearchParams } from "@/features/catalog/filter";
import { parseSmartQuery } from "@/features/catalog/smart-search";

/** Header search box → /search?q=… */
export function HeaderSearch() {
  const t = useTranslations("common");
  const router = useRouter();
  const [value, setValue] = useState("");
  return (
    <form
      role="search"
      className="hidden min-w-0 flex-1 sm:block"
      onSubmit={(e) => {
        e.preventDefault();
        const q = value.trim();
        if (q) router.push(`/search?q=${encodeURIComponent(q)}`);
      }}
    >
      <label className="sr-only" htmlFor="header-search">
        {t("search")}
      </label>
      <div className="flex items-center gap-2 rounded-lg border border-cream-200 bg-white px-3 py-2">
        <Search className="size-4 shrink-0 text-neutral-400" aria-hidden="true" />
        <input
          id="header-search"
          data-testid="header-search-input"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder={t("searchPlaceholder")}
          className="w-full min-w-0 bg-transparent text-sm text-ink-900 outline-none placeholder:text-neutral-400"
        />
      </div>
    </form>
  );
}

/**
 * Natural-language search box (search page).
 * Parses the phrase with parseSmartQuery (deterministic heuristics —
 * synonyms, typo correction, phrase → filters; no AI call) and
 * navigates to /search with the derived filters; the original phrase
 * rides along as `smart=` so the page can show which rules matched.
 */
export function SmartSearchForm() {
  const t = useTranslations("category");
  const router = useRouter();
  const [value, setValue] = useState("");
  return (
    <form
      role="search"
      aria-label={t("smartSearch")}
      onSubmit={(e) => {
        e.preventDefault();
        const input = value.trim();
        if (!input) return;
        const { params } = parseSmartQuery(input);
        const query = buildFilterSearchParams(params);
        const separator = query ? "&" : "?";
        router.push(`/search${query}${separator}smart=${encodeURIComponent(input)}`);
      }}
      className="flex flex-col gap-2 rounded-2xl border border-dashed border-leaf-600 bg-leaf-100/50 p-4"
    >
      <label htmlFor="smart-search" className="text-sm font-bold text-ink-900">
        {t("smartSearch")}
      </label>
      <p className="text-xs leading-5 text-neutral-500">{t("smartSearchHint")}</p>
      <div className="flex gap-2">
        <input
          id="smart-search"
          data-testid="smart-search-input"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder={t("smartSearchPlaceholder")}
          className="w-full min-w-0 rounded-lg border border-cream-200 bg-white px-3 py-2 text-sm text-ink-900 outline-none placeholder:text-neutral-400"
        />
        <button
          type="submit"
          data-testid="smart-search-submit"
          className="shrink-0 cursor-pointer rounded-lg bg-leaf-700 px-4 py-2 text-sm font-bold text-white"
        >
          {t("search")}
        </button>
      </div>
    </form>
  );
}
