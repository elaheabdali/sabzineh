import { describe, expect, it } from "vitest";
import { getVendorRepository } from "./repository";

/** Repository-level checks (memory adapter): filters + shop lookup. */

describe("MemoryVendorRepository — product list filters", () => {
  it("filters by status and searches by title", async () => {
    const repo = getVendorRepository();
    const all = await repo.listVendorProducts("v01");
    expect(all.length).toBeGreaterThan(0);
    expect(all.every((p) => p.vendorId === "v01")).toBe(true);
    const published = await repo.listVendorProducts("v01", { status: "PUBLISHED" });
    expect(published.every((p) => p.status === "PUBLISHED")).toBe(true);
    expect(published.length).toBeLessThanOrEqual(all.length);
    const first = all[0];
    const found = await repo.listVendorProducts("v01", { q: first.title.slice(0, 6) });
    expect(found.some((p) => p.id === first.id)).toBe(true);
    const none = await repo.listVendorProducts("v01", { q: "zzz-no-such-title" });
    expect(none).toEqual([]);
  });

  it("lists only the vendor's own products", async () => {
    const repo = getVendorRepository();
    const v01 = await repo.listVendorProducts("v01");
    const v02 = await repo.listVendorProducts("v02");
    expect(v01.some((p) => p.vendorId === "v02")).toBe(false);
    expect(v02.some((p) => p.vendorId === "v01")).toBe(false);
    expect(v02.length).toBeGreaterThan(0);
  });
});

describe("MemoryVendorRepository — profiles", () => {
  it("resolves the demo vendor profile by slug and by user", async () => {
    const repo = getVendorRepository();
    const bySlug = await repo.getVendorProfileBySlug("bagh-sabz-karaj");
    expect(bySlug?.id).toBe("v01");
    expect(bySlug?.status).toBe("APPROVED");
    const byUser = await repo.getVendorProfileByUserId("u-vendor");
    expect(byUser?.id).toBe("v01");
    expect(await repo.getVendorProfileBySlug("no-such-shop")).toBeNull();
  });

  it("no pending registrations exist in the seed", async () => {
    const repo = getVendorRepository();
    expect(await repo.listPendingVendorProfiles()).toEqual([]);
  });
});
