/**
 * Iranian phone + postal-code validation (pure functions).
 *
 * Persian digits (۰-۹) and Arabic digits are normalised to Latin
 * digits before any check, so forms accept what users actually type.
 */

const FA_DIGITS = "۰۱۲۳۴۵۶۷۸۹";
const AR_DIGITS = "٠١٢٣٤٥٦٧٨٩";

/** Converts Persian/Arabic digits to Latin digits; trims whitespace. */
export function normalizeDigits(value: string): string {
  let out = "";
  for (const ch of value.trim()) {
    const fa = FA_DIGITS.indexOf(ch);
    if (fa >= 0) {
      out += String(fa);
      continue;
    }
    const ar = AR_DIGITS.indexOf(ch);
    if (ar >= 0) {
      out += String(ar);
      continue;
    }
    out += ch;
  }
  return out;
}

/** Accepts 09xxxxxxxxx and +989xxxxxxxxx; returns the 09… form or null. */
export function normalizeIranianMobile(raw: string): string | null {
  const value = normalizeDigits(raw).replace(/[\s-]/g, "");
  if (/^09\d{9}$/.test(value)) return value;
  if (/^\+989\d{9}$/.test(value)) return `0${value.slice(3)}`;
  if (/^989\d{9}$/.test(value)) return `0${value.slice(2)}`;
  return null;
}

export function isValidIranianMobile(raw: string): boolean {
  return normalizeIranianMobile(raw) !== null;
}

/** Postal code: exactly 10 digits after normalisation. */
export function normalizePostalCode(raw: string): string | null {
  const value = normalizeDigits(raw).replace(/[\s-]/g, "");
  return /^\d{10}$/.test(value) ? value : null;
}

export function isValidPostalCode(raw: string): boolean {
  return normalizePostalCode(raw) !== null;
}
