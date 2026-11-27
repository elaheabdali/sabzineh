import { describe, expect, it } from "vitest";
import { canAccessVendor, hasAccess, type Session } from "./guards";

const admin: Session = { userId: "u1", email: "a@sabzineh.ir", role: "ADMIN" };
const vendor: Session = { userId: "u2", email: "v@sabzineh.ir", role: "VENDOR", vendorId: "v01" };
const customer: Session = { userId: "u3", email: "c@sabzineh.ir", role: "CUSTOMER" };

describe("hasAccess", () => {
  it("denies anonymous sessions", () => {
    expect(hasAccess(null, ["CUSTOMER"])).toBe(false);
  });

  it("lets admins into every panel", () => {
    expect(hasAccess(admin, ["VENDOR"])).toBe(true);
    expect(hasAccess(admin, ["CUSTOMER", "ADMIN"])).toBe(true);
  });

  it("denies a customer the vendor panel", () => {
    expect(hasAccess(customer, ["VENDOR"])).toBe(false);
    expect(hasAccess(customer, ["CUSTOMER"])).toBe(true);
  });
});

describe("canAccessVendor", () => {
  it("lets a vendor access only their own vendor id", () => {
    expect(canAccessVendor(vendor, "v01")).toBe(true);
    expect(canAccessVendor(vendor, "v02")).toBe(false);
  });

  it("lets admins access any vendor", () => {
    expect(canAccessVendor(admin, "v02")).toBe(true);
  });
});
