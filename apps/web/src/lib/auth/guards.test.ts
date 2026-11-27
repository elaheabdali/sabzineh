import { describe, expect, it } from "vitest";
import { canAccessVendor, hasAccess, type Session } from "./guards";

const admin: Session = { id: "u1", email: "a@sabzineh.ir", name: "Admin", role: "ADMIN", vendorId: null };
const vendor: Session = { id: "u2", email: "v@sabzineh.ir", name: "Vendor", role: "VENDOR", vendorId: "v01" };
const customer: Session = { id: "u3", email: "c@sabzineh.ir", name: "Customer", role: "CUSTOMER", vendorId: null };

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
