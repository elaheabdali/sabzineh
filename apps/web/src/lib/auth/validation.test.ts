import { describe, expect, it } from "vitest";
import {
  isValidIranianMobile,
  isValidPostalCode,
  normalizeDigits,
  normalizeIranianMobile,
  normalizePostalCode,
} from "./validation";

describe("normalizeDigits", () => {
  it("converts Persian and Arabic digits to Latin", () => {
    expect(normalizeDigits("۰۹۱۲۳۴۵۶۷۸۹")).toBe("09123456789");
    expect(normalizeDigits("٠٩١٢٣٤٥٦٧٨٩")).toBe("09123456789");
  });
});

describe("normalizeIranianMobile", () => {
  it("accepts 09… numbers", () => {
    expect(normalizeIranianMobile("09123456789")).toBe("09123456789");
  });

  it("accepts +98 and 98 prefixes", () => {
    expect(normalizeIranianMobile("+989123456789")).toBe("09123456789");
    expect(normalizeIranianMobile("989123456789")).toBe("09123456789");
  });

  it("accepts Persian digits", () => {
    expect(normalizeIranianMobile("۰۹۱۲۳۴۵۶۷۸۹")).toBe("09123456789");
  });

  it("rejects landlines, short numbers and non-Iranian mobiles", () => {
    expect(normalizeIranianMobile("02122334455")).toBeNull();
    expect(normalizeIranianMobile("0912345678")).toBeNull();
    expect(normalizeIranianMobile("091234567890")).toBeNull();
    expect(normalizeIranianMobile("abc")).toBeNull();
  });
});

describe("isValidIranianMobile", () => {
  it("validates 09… and rejects the rest", () => {
    expect(isValidIranianMobile("09123456789")).toBe(true);
    expect(isValidIranianMobile("+989123456789")).toBe(true);
    expect(isValidIranianMobile("02122334455")).toBe(false);
  });
});

describe("postal code", () => {
  it("accepts exactly 10 digits (Persian digits normalised)", () => {
    expect(normalizePostalCode("۱۲۳۴۵۶۷۸۹۰")).toBe("1234567890");
    expect(isValidPostalCode("1234567890")).toBe(true);
  });

  it("rejects 9 or 11 digits", () => {
    expect(normalizePostalCode("123456789")).toBeNull();
    expect(normalizePostalCode("12345678901")).toBeNull();
    expect(isValidPostalCode("123456789")).toBe(false);
  });
});
