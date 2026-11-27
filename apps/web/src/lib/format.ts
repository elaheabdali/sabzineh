/** Persian digits, Toman, Jalali calendar — all built-in Intl, no deps. */
export function formatToman(amount: number, locale: "fa" | "en" = "fa"): string {
  return new Intl.NumberFormat(locale === "fa" ? "fa-IR" : "en-US").format(amount);
}

export function formatPrice(amount: number, locale: "fa" | "en" = "fa"): string {
  return locale === "fa" ? `${formatToman(amount, locale)} تومان` : `${formatToman(amount, locale)} Toman`;
}

export function formatJalali(date: Date | string, locale: "fa" | "en" = "fa"): string {
  return new Intl.DateTimeFormat(locale === "fa" ? "fa-IR" : "en-US", {
    calendar: "persian",
    dateStyle: "medium",
  }).format(new Date(date));
}
