import { beforeAll, describe, expect, it } from "vitest";
import {
  VendorProductInputSchema,
  VendorProductStep1Schema,
  VendorProductStep2Schema,
  VendorProductStep3Schema,
  type SessionUser,
} from "@sabzineh/types";
import { getCatalogRepository } from "@/features/catalog/repository";
import { getDataStore } from "@/server/store";
import { createOrder } from "@/server/orders/service";
import { AuthError } from "@/lib/auth/service";
import {
  adjustVendorProductStock,
  createVendorProduct,
  getVendorDashboard,
  getVendorProfile,
  registerVendor,
  setVendorProductStatus,
  slugifyTitle,
  transitionVendorOrder,
  updateVendorProduct,
  updateVendorProfile,
} from "./service";
import { getVendorRepository } from "./repository";
import { getBillingStore } from "@/server/billing/store";
import { approveVendorAsAdmin } from "@/server/admin/service";

// Phase 2: publishing requires an active vendor subscription, so
// the seed vendors used across this file hold a basic plan.
beforeAll(async () => {
  const store = getBillingStore();
  for (const userId of ["u-vendor", "u-vendor-2"]) {
    await store.createSubscription({
      userId,
      planId: "plan-vendor-basic",
      planKind: "VENDOR",
      status: "ACTIVE",
      currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      autoRenew: true,
    });
  }
});

const VENDOR_V01: SessionUser = {
  id: "u-vendor",
  email: "vendor@sabzineh.ir",
  name: "باغ سبز کرج",
  role: "VENDOR",
  vendorId: "v01",
};
const VENDOR_V02: SessionUser = {
  id: "u-vendor-2",
  email: "vendor2@sabzineh.ir",
  name: "مزرعه ارگانیک دماوند",
  role: "VENDOR",
  vendorId: "v02",
};
const CUSTOMER: SessionUser = {
  id: "u-customer",
  email: "customer@sabzineh.ir",
  name: "مشتری سبزینه",
  role: "CUSTOMER",
  vendorId: null,
};

function uniqueTitle(): string {
  return `Test Product ${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
}

function validInput(overrides: Record<string, unknown> = {}) {
  return {
    title: uniqueTitle(),
    description: "A fresh test product with a long enough description.",
    categoryId: "apples-pears",
    price: 120_000,
    compareAtPrice: null,
    stock: 5,
    images: [],
    organic: true,
    glutenFree: false,
    local: true,
    tags: ["test"],
    originNote: "Karaj",
    ...overrides,
  };
}

async function makePaidOrderForV01() {
  const address = await getDataStore().createAddress("u-customer", {
    title: "Home",
    city: "Tehran",
    text: "123 Green Street, District 3",
    postalCode: "1234567890",
    phone: "09123456789",
  });
  const result = await createOrder(
    "u-customer",
    {
      items: [{ productId: "p001", qty: 1 }],
      addressId: address.id,
      useWallet: true,
      idempotencyKey: crypto.randomUUID(),
    },
    { locale: "fa" },
  );
  expect(result.order.status).toBe("PAID");
  return result.order;
}

describe("vendor product validation (per-step Zod schemas)", () => {
  it("step 1 rejects a price below 1,000 and a bad compare-at price", () => {
    expect(VendorProductStep1Schema.safeParse(validInput({ price: 500 })).success).toBe(false);
    expect(
      VendorProductStep1Schema.safeParse(validInput({ price: 100_000, compareAtPrice: 90_000 }))
        .success,
    ).toBe(false);
    expect(VendorProductStep1Schema.safeParse(validInput()).success).toBe(true);
  });

  it("step 1 rejects negative stock and a missing category", () => {
    expect(VendorProductStep1Schema.safeParse(validInput({ stock: -1 })).success).toBe(false);
    expect(VendorProductStep1Schema.safeParse(validInput({ categoryId: "" })).success).toBe(false);
  });

  it("step 2 rejects more than 4 images and non-image URLs", () => {
    const one = { url: "data:image/png;base64,iVBORw0KGgo=", alt: "a" };
    expect(
      VendorProductStep2Schema.safeParse({ images: [one, one, one, one, one] }).success,
    ).toBe(false);
    expect(
      VendorProductStep2Schema.safeParse({ images: [{ url: "https://example.com/x.txt", alt: "a" }] })
        .success,
    ).toBe(false);
    expect(VendorProductStep2Schema.safeParse({ images: [one] }).success).toBe(true);
  });

  it("step 3 rejects more than 10 tags", () => {
    expect(
      VendorProductStep3Schema.safeParse({
        organic: false,
        glutenFree: false,
        local: false,
        tags: Array.from({ length: 11 }, (_, i) => `t${i}`),
      }).success,
    ).toBe(false);
  });

  it("the combined input schema validates a full product", () => {
    expect(VendorProductInputSchema.safeParse(validInput()).success).toBe(true);
  });

  it("slugifyTitle falls back for Persian titles", () => {
    expect(slugifyTitle("سیب قرمز ارگانیک", "product")).toBe("product");
    expect(slugifyTitle("Organic Honey", "product")).toBe("organic-honey");
  });
});

describe("createVendorProduct — drafts vs published", () => {
  it("a draft is stored but invisible in the public catalog", async () => {
    const created = await createVendorProduct(VENDOR_V01, validInput(), false);
    expect(created.status).toBe("DRAFT");
    const catalog = getCatalogRepository();
    expect(await catalog.getProductBySlug(created.slug)).toBeNull();
    const listed = await catalog.listProducts({ q: created.title });
    expect(listed.items.some((p) => p.id === created.id)).toBe(false);
    const own = await getVendorRepository().listVendorProducts("v01", { status: "DRAFT" });
    expect(own.some((p) => p.id === created.id)).toBe(true);
  });

  it("a published product appears in the catalog and on its page lookup", async () => {
    const created = await createVendorProduct(VENDOR_V01, validInput(), true);
    expect(created.status).toBe("PUBLISHED");
    const found = await getCatalogRepository().getProductBySlug(created.slug);
    expect(found?.id).toBe(created.id);
    const listed = await getCatalogRepository().listProducts({ q: created.title });
    expect(listed.items.some((p) => p.id === created.id)).toBe(true);
  });

  it("rejects an unknown category and a non-vendor session", async () => {
    await expect(
      createVendorProduct(VENDOR_V01, validInput({ categoryId: "no-such-category" }), true),
    ).rejects.toMatchObject({ code: "invalid-input" });
    await expect(createVendorProduct(CUSTOMER, validInput(), true)).rejects.toMatchObject({
      code: "forbidden",
    });
  });

  it("two products with the same title get different slugs", async () => {
    const input = validInput({ title: "Same Title Test Product" });
    const a = await createVendorProduct(VENDOR_V01, { ...input }, true);
    const b = await createVendorProduct(VENDOR_V01, { ...input }, true);
    expect(a.slug).not.toBe(b.slug);
  });
});

describe("vendor scoping — cross-vendor isolation", () => {
  it("vendor B cannot read, update, publish or restock vendor A's product", async () => {
    const created = await createVendorProduct(VENDOR_V01, validInput(), false);
    const repo = getVendorRepository();
    expect(await repo.getVendorProduct("v02", created.id)).toBeNull();
    await expect(updateVendorProduct(VENDOR_V02, created.id, validInput())).rejects.toMatchObject({
      code: "not-found",
    });
    await expect(setVendorProductStatus(VENDOR_V02, created.id, "PUBLISHED")).rejects.toMatchObject({
      code: "not-found",
    });
    await expect(adjustVendorProductStock(VENDOR_V02, created.id, 1)).rejects.toMatchObject({
      code: "not-found",
    });
    // And the owner still can.
    expect(await repo.getVendorProduct("v01", created.id)).not.toBeNull();
  });

  it("a seed product of another vendor (p002, v02) is not editable by v01", async () => {
    await expect(
      updateVendorProduct(VENDOR_V01, "p002", validInput({ title: "Hijack attempt" })),
    ).rejects.toMatchObject({ code: "not-found" });
    await expect(setVendorProductStatus(VENDOR_V01, "p002", "ARCHIVED")).rejects.toMatchObject({
      code: "not-found",
    });
  });

  it("unpublish hides a published product from the catalog again", async () => {
    const created = await createVendorProduct(VENDOR_V01, validInput(), true);
    expect(await getCatalogRepository().getProductBySlug(created.slug)).not.toBeNull();
    await setVendorProductStatus(VENDOR_V01, created.id, "DRAFT");
    expect(await getCatalogRepository().getProductBySlug(created.slug)).toBeNull();
  });

  it("stock adjustment is capped by the catalog guard", async () => {
    const created = await createVendorProduct(VENDOR_V01, validInput({ stock: 2 }), true);
    expect(await adjustVendorProductStock(VENDOR_V01, created.id, 3)).toBe(5);
    await expect(adjustVendorProductStock(VENDOR_V01, created.id, -6)).rejects.toThrow(
      /Insufficient stock/,
    );
  });
});

describe("vendor order fulfilment", () => {
  it("follows PAID → PREPARING → SHIPPED → DELIVERED and rejects jumps", async () => {
    const order = await makePaidOrderForV01();
    await expect(
      transitionVendorOrder(VENDOR_V01, { orderId: order.id, toStatus: "SHIPPED" }),
    ).rejects.toMatchObject({ code: "invalid-transition" });
    await transitionVendorOrder(VENDOR_V01, { orderId: order.id, toStatus: "PREPARING" });
    expect((await getDataStore().getOrderById(order.id))?.status).toBe("PREPARING");
    await expect(
      transitionVendorOrder(VENDOR_V01, { orderId: order.id, toStatus: "PREPARING" }),
    ).rejects.toMatchObject({ code: "invalid-transition" });
    await transitionVendorOrder(VENDOR_V01, { orderId: order.id, toStatus: "SHIPPED" });
    await transitionVendorOrder(VENDOR_V01, { orderId: order.id, toStatus: "DELIVERED" });
    expect((await getDataStore().getOrderById(order.id))?.status).toBe("DELIVERED");
  });

  it("a vendor cannot transition an order with none of their items", async () => {
    // A PAID order containing only a v02 item, created directly in the store.
    const order = await getDataStore().createOrder({
      userId: "u-customer",
      items: [{ productId: "p002", vendorId: "v02", qty: 1, unitPrice: 50_000, commissionRate: 0.1 }],
      total: 50_000,
      discountId: null,
      discountAmount: 0,
      walletApplied: 0,
      payable: 0,
      addressId: "addr-test",
      idempotencyKey: crypto.randomUUID(),
    });
    expect(order.status).toBe("PAID");
    await expect(
      transitionVendorOrder(VENDOR_V01, { orderId: order.id, toStatus: "PREPARING" }),
    ).rejects.toMatchObject({ code: "forbidden" });
    await expect(
      transitionVendorOrder(VENDOR_V02, { orderId: order.id, toStatus: "PREPARING" }),
    ).resolves.toBeUndefined();
  });

  it("dashboard stats only count fulfilled orders of this vendor", async () => {
    const before = await getVendorDashboard(VENDOR_V01);
    // A PAID order for v01, created directly in the store (the wallet
    // only holds 150,000 تومان, so a second real purchase would overdraw).
    const order = await getDataStore().createOrder({
      userId: "u-customer",
      items: [{ productId: "p001", vendorId: "v01", qty: 1, unitPrice: 90_000, commissionRate: 0.1 }],
      total: 90_000,
      discountId: null,
      discountAmount: 0,
      // Synthetic PAID order for stats: walletApplied 0 so the shared
      // demo wallet is not debited (payable 0 still yields PAID).
      walletApplied: 0,
      payable: 0,
      addressId: "addr-test",
      idempotencyKey: crypto.randomUUID(),
    });
    expect(order.status).toBe("PAID");
    const after = await getVendorDashboard(VENDOR_V01);
    expect(after.orderCount).toBe(before.orderCount + 1);
    expect(after.revenue).toBe(before.revenue + 90_000);
    expect(after.topProducts.some((p) => p.productId === "p001")).toBe(true);
    expect(after.orders.some((o) => o.orderId === order.id)).toBe(true);
    const other = await getVendorDashboard(VENDOR_V02);
    expect(other.orders.some((o) => o.orderId === order.id)).toBe(false);
  });
});

describe("vendor profile + registration", () => {
  it("a vendor updates their own profile; the payout IBAN is validated", async () => {
    const updated = await updateVendorProfile(VENDOR_V01, {
      shopName: "باغ سبز کرج",
      city: "کرج",
      bio: "Fresh from Karaj",
      phone: "09123456789",
      payoutIban: "IR820150000001234567890123",
      payoutAccountHolder: "باغ سبز کرج",
    });
    expect(updated.city).toBe("کرج");
    expect(updated.payoutIban).toBe("IR820150000001234567890123");
    await expect(
      updateVendorProfile(VENDOR_V01, {
        shopName: "باغ سبز کرج",
        city: "کرج",
        payoutIban: "not-an-iban",
      }),
    ).rejects.toMatchObject({ code: "invalid-input" });
    // A different vendor cannot update v01's profile (session-bound).
    const profile = await getVendorProfile(VENDOR_V01);
    expect(profile?.shopName).toBe("باغ سبز کرج");
  });

  it("registration creates a PENDING vendor who can draft but not publish", async () => {
    const email = `vendor-${crypto.randomUUID()}@sabzineh.ir`;
    const { user, vendorId } = await registerVendor({
      name: "New Vendor",
      email,
      phone: "09123456789",
      password: "secret123",
      shopName: "New Test Shop",
      city: "تهران",
    });
    expect(user.role).toBe("VENDOR");
    expect(user.vendorId).toBe(vendorId);
    const profile = await getVendorRepository().getVendorProfileById(vendorId);
    expect(profile?.status).toBe("PENDING");
    const session: SessionUser = { ...user, vendorId };
    const dashboard = await getVendorDashboard(session);
    expect(dashboard.profile?.status).toBe("PENDING");
    await expect(createVendorProduct(session, validInput(), true)).rejects.toMatchObject({
      code: "forbidden",
    });
    const draft = await createVendorProduct(session, validInput(), false);
    expect(draft.status).toBe("DRAFT");
    await expect(setVendorProductStatus(session, draft.id, "PUBLISHED")).rejects.toMatchObject({
      code: "forbidden",
    });
  });

  it("Phase 2: an APPROVED vendor without an active subscription cannot publish", async () => {
    const email = `nosub-${crypto.randomUUID()}@sabzineh.ir`;
    const { user, vendorId } = await registerVendor({
      name: "No Sub Vendor",
      email,
      phone: "09123456789",
      password: "secret123",
      shopName: "No Sub Shop",
      city: "تهران",
    });
    await approveVendorAsAdmin("u-admin", vendorId);
    const session: SessionUser = { ...user, vendorId };
    // Drafts still work; publishing does not.
    const draft = await createVendorProduct(session, validInput(), false);
    expect(draft.status).toBe("DRAFT");
    await expect(createVendorProduct(session, validInput(), true)).rejects.toMatchObject({
      code: "no-active-subscription",
    });
    await expect(setVendorProductStatus(session, draft.id, "PUBLISHED")).rejects.toMatchObject({
      code: "no-active-subscription",
    });
  });

  it("registration rejects a duplicate email", async () => {
    const email = `dup-vendor-${crypto.randomUUID()}@sabzineh.ir`;
    await registerVendor({
      name: "Vendor A",
      email,
      phone: "09123456789",
      password: "secret123",
      shopName: "Shop A",
      city: "تهران",
    });
    await expect(
      registerVendor({
        name: "Vendor B",
        email,
        phone: "09123456789",
        password: "secret123",
        shopName: "Shop B",
        city: "تهران",
      }),
    ).rejects.toBeInstanceOf(AuthError);
  });
});
