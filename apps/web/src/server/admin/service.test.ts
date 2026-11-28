import { describe, expect, it } from "vitest";
import { registerCustomer, loginWithCredentials } from "@/lib/auth/service";
import { registerVendor } from "@/features/vendor/service";
import { getVendorRepository } from "@/features/vendor/repository";
import { getDataStore } from "@/server/store";
import { createOrder } from "@/server/orders/service";
import {
  AdminError,
  approveVendorAsAdmin,
  buildOrdersCsv,
  buildPayoutsCsv,
  createBannerAsAdmin,
  createCategoryAsAdmin,
  createDiscountAsAdmin,
  deleteBannerAsAdmin,
  deleteCategoryAsAdmin,
  deleteDiscountAsAdmin,
  getAdminReports,
  getAdminUserDetail,
  listAdminBanners,
  listAdminProducts,
  listAdminUsers,
  rejectVendorAsAdmin,
  setProductStatusAsAdmin,
  setUserStatusAsAdmin,
  updateBannerAsAdmin,
  updateCategoryAsAdmin,
  updateDiscountAsAdmin,
  validateDiscountInput,
} from "./service";

const ADMIN = "u-admin";
const P001 = "p001"; // v01, 90,000 Toman in seed

function uniqueEmail(prefix: string): string {
  return `${prefix}-${crypto.randomUUID().slice(0, 8)}@sabzineh.ir`;
}

async function makeCustomer() {
  const email = uniqueEmail("cust");
  const { user } = await registerCustomer({
    name: "Test Customer",
    email,
    phone: "09123456789",
    password: "secret123",
  });
  return user;
}

async function makeVendor() {
  const email = uniqueEmail("vendor");
  const shop = `Shop ${crypto.randomUUID().slice(0, 8)}`;
  const { vendorId } = await registerVendor({
    name: "Test Vendor",
    email,
    phone: "09123456789",
    password: "secret123",
    shopName: shop,
    city: "Tehran",
  });
  return { vendorId, email, shop };
}

describe("vendor approval", () => {
  it("approves a PENDING vendor and blocks a second approval", async () => {
    const { vendorId } = await makeVendor();
    const approved = await approveVendorAsAdmin(ADMIN, vendorId);
    expect(approved.status).toBe("APPROVED");
    await expect(approveVendorAsAdmin(ADMIN, vendorId)).rejects.toMatchObject({
      code: "invalid-transition",
    });
  });

  it("rejects with a reason the vendor can see, and blocks re-approval", async () => {
    const { vendorId } = await makeVendor();
    const rejected = await rejectVendorAsAdmin(ADMIN, vendorId, "Incomplete documents");
    expect(rejected.status).toBe("REJECTED");
    expect(rejected.rejectionReason).toBe("Incomplete documents");
    await expect(approveVendorAsAdmin(ADMIN, vendorId)).rejects.toMatchObject({
      code: "invalid-transition",
    });
  });

  it("rejects an empty reason and an unknown vendor", async () => {
    const { vendorId } = await makeVendor();
    await expect(rejectVendorAsAdmin(ADMIN, vendorId, " ")).rejects.toMatchObject({
      code: "invalid-input",
    });
    await expect(approveVendorAsAdmin(ADMIN, "no-such-vendor")).rejects.toMatchObject({
      code: "not-found",
    });
  });
});

describe("user suspension", () => {
  it("blocks login for a suspended user and allows it again after activation", async () => {
    const user = await makeCustomer();
    await loginWithCredentials(user.email, "secret123");
    await setUserStatusAsAdmin(ADMIN, user.id, "SUSPENDED");
    await expect(loginWithCredentials(user.email, "secret123")).rejects.toMatchObject({
      code: "suspended",
    });
    const detail = await getAdminUserDetail(user.id);
    expect(detail?.status).toBe("SUSPENDED");
    await setUserStatusAsAdmin(ADMIN, user.id, "ACTIVE");
    const again = await loginWithCredentials(user.email, "secret123");
    expect(again.user.id).toBe(user.id);
  });

  it("never suspends the admin themself, and never the last active admin", async () => {
    await expect(setUserStatusAsAdmin(ADMIN, ADMIN, "SUSPENDED")).rejects.toMatchObject({
      code: "forbidden",
    });
    // The demo admin is the only admin in the seed.
    const admins = (await listAdminUsers({ role: "ADMIN" })).filter(
      (u) => u.status === "ACTIVE",
    );
    expect(admins.length).toBe(1);
    await expect(setUserStatusAsAdmin("someone-else", ADMIN, "SUSPENDED")).rejects.toMatchObject({
      code: "last-admin",
    });
  });
});

describe("validateDiscountInput", () => {
  it("accepts a valid percent and a valid fixed code", () => {
    expect(
      validateDiscountInput({
        code: "TEST10",
        type: "PERCENT",
        value: 10,
        minAmount: 0,
        usageLimit: null,
        expiresAt: null,
      }),
    ).toBeNull();
    expect(
      validateDiscountInput({
        code: "TEST50K",
        type: "FIXED",
        value: 50_000,
        minAmount: 100_000,
        usageLimit: 10,
        expiresAt: new Date(Date.now() + 86_400_000),
      }),
    ).toBeNull();
  });

  it("rejects bad codes, out-of-range values and past expiry", () => {
    const base = {
      code: "OK10",
      type: "PERCENT" as const,
      value: 10,
      minAmount: 0,
      usageLimit: null,
      expiresAt: null,
    };
    expect(validateDiscountInput({ ...base, code: "ab" })).toBe("invalid-code");
    expect(validateDiscountInput({ ...base, value: 0 })).toBe("invalid-value");
    expect(validateDiscountInput({ ...base, value: 101 })).toBe("invalid-value");
    expect(validateDiscountInput({ ...base, type: "FIXED", value: 500 })).toBe("invalid-value");
    expect(validateDiscountInput({ ...base, minAmount: -1 })).toBe("invalid-min-amount");
    expect(validateDiscountInput({ ...base, usageLimit: 0 })).toBe("invalid-usage-limit");
    expect(
      validateDiscountInput({ ...base, expiresAt: new Date(Date.now() - 1000) }),
    ).toBe("invalid-expiry");
  });
});

describe("discount CRUD", () => {
  it("creates, updates and deletes a code", async () => {
    const code = `T${crypto.randomUUID().slice(0, 6).toUpperCase()}`;
    const created = await createDiscountAsAdmin(ADMIN, {
      code,
      type: "PERCENT",
      value: 15,
      minAmount: 100_000,
      usageLimit: 5,
      expiresAt: null,
    });
    expect(created.code).toBe(code);
    expect(created.usedCount).toBe(0);
    const updated = await updateDiscountAsAdmin(ADMIN, created.id, { value: 20 });
    expect(updated.value).toBe(20);
    await deleteDiscountAsAdmin(ADMIN, created.id);
    const remaining = (await getDataStore().listDiscounts()).find((d) => d.id === created.id);
    expect(remaining).toBeUndefined();
  });

  it("rejects a duplicate code", async () => {
    await expect(
      createDiscountAsAdmin(ADMIN, {
        code: "WELCOME",
        type: "FIXED",
        value: 5000,
        minAmount: 0,
        usageLimit: null,
        expiresAt: null,
      }),
    ).rejects.toMatchObject({ code: "code-taken" });
  });

  it("refuses to delete a code that was used by an order", async () => {
    const code = `U${crypto.randomUUID().slice(0, 6).toUpperCase()}`;
    const created = await createDiscountAsAdmin(ADMIN, {
      code,
      type: "FIXED",
      value: 5000,
      minAmount: 0,
      usageLimit: null,
      expiresAt: null,
    });
    const user = await makeCustomer();
    const address = await getDataStore().createAddress(user.id, {
      title: "Home",
      city: "Tehran",
      text: "123 Green Street",
      postalCode: "1234567890",
      phone: "09123456789",
    });
    await createOrder(user.id, {
      items: [{ productId: P001, qty: 1 }],
      addressId: address.id,
      discountCode: code,
      idempotencyKey: crypto.randomUUID(),
    });
    await expect(deleteDiscountAsAdmin(ADMIN, created.id)).rejects.toBeInstanceOf(AdminError);
    await expect(deleteDiscountAsAdmin(ADMIN, created.id)).rejects.toMatchObject({
      code: "in-use",
    });
  });
});

describe("category admin", () => {
  it("creates a leaf category and deletes it again", async () => {
    const slug = `test-${crypto.randomUUID().slice(0, 8)}`;
    const created = await createCategoryAsAdmin(ADMIN, {
      parentId: null,
      slug,
      nameFa: "دسته تست",
      nameEn: "Test Category",
    });
    expect(created.slug).toBe(slug);
    const { deleted } = await deleteCategoryAsAdmin(ADMIN, created.id);
    expect(deleted).toBe(true);
  });

  it("rejects a duplicate slug", async () => {
    await expect(
      createCategoryAsAdmin(ADMIN, {
        parentId: null,
        slug: "fruits-vegetables",
        nameFa: "تکراری",
        nameEn: "Duplicate",
      }),
    ).rejects.toMatchObject({ code: "code-taken" });
  });

  it("refuses to delete a category that holds products, then moves them", async () => {
    const slug = `leaf-${crypto.randomUUID().slice(0, 8)}`;
    const leaf = await createCategoryAsAdmin(ADMIN, {
      parentId: null,
      slug,
      nameFa: "برگ تست",
      nameEn: "Test Leaf",
    });
    const { getCatalogRepository } = await import("@/features/catalog/repository");
    const repo = getCatalogRepository();
    const product = await repo.getProductById(P001);
    expect(product).not.toBeNull();
    const originalCategory = product!.categoryId;
    const countBefore = await repo.countProductsByCategory(originalCategory);
    expect(countBefore).toBeGreaterThan(0);
    // Move the whole category's products into the fresh leaf.
    await repo.reassignProducts(originalCategory, leaf.id);
    await expect(deleteCategoryAsAdmin(ADMIN, leaf.id)).rejects.toMatchObject({
      code: "has-products",
    });
    const moved = await deleteCategoryAsAdmin(ADMIN, leaf.id, originalCategory);
    expect(moved.deleted).toBe(true);
    expect(moved.movedProducts).toBe(countBefore);
    // Everything is back where it was.
    expect(await repo.countProductsByCategory(originalCategory)).toBe(countBefore);
  });

  it("rejects moving a category under its own descendant", async () => {
    const { getCatalogRepository } = await import("@/features/catalog/repository");
    const repo = getCatalogRepository();
    const tree = await repo.getCategoryTree();
    const root = tree[0];
    const child = root?.children[0];
    expect(root).toBeDefined();
    expect(child).toBeDefined();
    if (!root || !child) return;
    await expect(
      updateCategoryAsAdmin(ADMIN, root.id, { parentId: child.id }),
    ).rejects.toMatchObject({ code: "cycle" });
  });
});

describe("Phase 3 — admin products, banners, reports", () => {
  it("lists products with search, status filter, sort and pagination", async () => {
    const all = await listAdminProducts({ pageSize: 5 });
    expect(all.total).toBeGreaterThan(50);
    expect(all.rows).toHaveLength(5);
    const drafts = await listAdminProducts({ status: "DRAFT" });
    expect(drafts.rows.every((r) => r.status === "DRAFT")).toBe(true);
    const byPriceDesc = await listAdminProducts({ sort: "price", dir: "desc", pageSize: 50 });
    const prices = byPriceDesc.rows.map((r) => r.price);
    expect(prices).toEqual([...prices].sort((a, b) => b - a));
    expect(byPriceDesc.rows[0].shopName).toBeTruthy();
  });

  it("admin can archive and restore a product, audit-logged", async () => {
    await setProductStatusAsAdmin(ADMIN, P001, "ARCHIVED");
    const archived = await listAdminProducts({ status: "ARCHIVED", pageSize: 50 });
    expect(archived.rows.some((r) => r.id === P001)).toBe(true);
    await setProductStatusAsAdmin(ADMIN, P001, "PUBLISHED");
    const detail = await getVendorRepository().getVendorProduct("v01", P001);
    expect(detail?.status).toBe("PUBLISHED");
    await expect(setProductStatusAsAdmin(ADMIN, "no-such-product", "ARCHIVED")).rejects.toBeInstanceOf(
      AdminError,
    );
  });

  it("banner CRUD round-trips through the store", async () => {
    const before = await listAdminBanners();
    await createBannerAsAdmin(ADMIN, {
      title: "Phase 3 test banner",
      imageUrl: "https://example.com/b.png",
      linkUrl: "/fa/subscribe",
      placement: "HOME_STRIP",
      active: true,
    });
    const after = await listAdminBanners();
    expect(after).toHaveLength(before.length + 1);
    const created = after.find((b) => b.title === "Phase 3 test banner");
    expect(created).toBeTruthy();
    await updateBannerAsAdmin(ADMIN, created!.id, { active: false });
    const updated = (await listAdminBanners()).find((b) => b.id === created!.id);
    expect(updated?.active).toBe(false);
    await deleteBannerAsAdmin(ADMIN, created!.id);
    expect((await listAdminBanners()).some((b) => b.id === created!.id)).toBe(false);
  });

  it("reports aggregate orders and CSV exports have headers and rows", async () => {
    const reports = await getAdminReports();
    expect(reports.revenue).toBeGreaterThanOrEqual(0);
    expect(Array.isArray(reports.topVendors)).toBe(true);
    const ordersCsv = await buildOrdersCsv();
    expect(ordersCsv.split("\n")[0]).toContain("user_email");
    const payoutsCsv = await buildPayoutsCsv();
    expect(payoutsCsv.split("\n")[0]).toContain("vendor_id");
  });
});
