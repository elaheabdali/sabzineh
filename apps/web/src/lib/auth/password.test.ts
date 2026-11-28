import { describe, expect, it } from "vitest";
import { hashPassword, validatePasswordStrength, verifyPassword } from "./password";

describe("password hashing", () => {
  it("hashes and verifies the same password", async () => {
    const hash = await hashPassword("demo1234");
    expect(hash).not.toBe("demo1234");
    expect(await verifyPassword("demo1234", hash)).toBe(true);
  });

  it("rejects the wrong password", async () => {
    const hash = await hashPassword("demo1234");
    expect(await verifyPassword("wrongpass1", hash)).toBe(false);
  });

  it("fails closed on a malformed stored hash", async () => {
    expect(await verifyPassword("demo1234", "not-a-bcrypt-hash")).toBe(false);
    expect(await verifyPassword("demo1234", "")).toBe(false);
  });

  it("produces a different hash each time (salted)", async () => {
    const a = await hashPassword("demo1234");
    const b = await hashPassword("demo1234");
    expect(a).not.toBe(b);
    expect(await verifyPassword("demo1234", a)).toBe(true);
    expect(await verifyPassword("demo1234", b)).toBe(true);
  });
});

describe("validatePasswordStrength", () => {
  it("accepts a password with 8+ chars, a letter and a digit", () => {
    expect(validatePasswordStrength("demo1234")).toEqual([]);
  });

  it("flags short passwords", () => {
    expect(validatePasswordStrength("abc123").map((i) => i.code)).toContain("too-short");
  });

  it("flags passwords without a digit", () => {
    expect(validatePasswordStrength("password").map((i) => i.code)).toContain("no-digit");
  });

  it("flags passwords without a letter", () => {
    expect(validatePasswordStrength("12345678").map((i) => i.code)).toContain("no-letter");
  });
});
