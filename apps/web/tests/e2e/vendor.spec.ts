import { expect, test, type Page } from "@playwright/test";

/**
 * Vendor panel E2E (Week 5).
 *
 * Dashboard stats + scoping, the full multi-step product flow
 * (create → publish → public catalog, draft stays hidden), edit +
 * stock controls, cross-vendor isolation in the UI, vendor
 * registration (PENDING), the public shop page, and order
 * fulfilment (PAID → PREPARING) from a real purchase.
 *
 * Tests share one prod server and one in-memory store across the
 * Chromium + Firefox projects, so they use unique product titles and
 * never assert on global counts.
 */

async function loginAs(page: Page, which: "demoCustomer" | "demoVendor") {
  await page.goto("/fa/auth/login");
  await page.getByTestId(`demo-login-${which}`).click();
  await expect(page.getByTestId("header-user")).toBeVisible();
}

async function logout(page: Page) {
  await page.getByTestId("logout-button").first().click();
  await expect(page.getByTestId("login-link")).toBeVisible();
}

async function fillAddress(page: Page) {
  const title = `خانه-${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
  await page.getByLabel("عنوان آدرس").fill(title);
  await page.getByLabel("شهر").fill("تهران");
  await page.getByLabel("آدرس کامل").fill("خیابان سبز، پلاک ۱۲۳، واحد ۴");
  await page.getByLabel("کد پستی").fill("1234567890");
  await page.getByLabel("موبایل گیرنده").fill("09123456789");
  await page.getByTestId("save-address").click();
  await expect(page.getByLabel(title)).toBeChecked();
  await page.getByTestId("to-payment-step").click();
}

async function fillStep1(page: Page, title: string) {
  await page.getByTestId("product-title").fill(title);
  await page.getByTestId("product-description").fill("A fresh E2E test product, grown in Karaj.");
  await page.getByTestId("product-category").selectOption({ index: 1 });
  await page.getByTestId("product-price").fill("120000");
  await page.getByTestId("product-stock").fill("5");
  await page.getByTestId("to-step-2").click();
  await expect(page.getByTestId("form-step-2")).toBeVisible();
}

const TINY_PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
  "base64",
);

async function uploadTinyPng(page: Page) {
  await page.locator('input[type="file"]').setInputFiles({
    name: "test.png",
    mimeType: "image/png",
    buffer: TINY_PNG,
  });
}

async function finishToReview(page: Page) {
  await page.getByTestId("to-step-3").click();
  await expect(page.getByTestId("form-step-3")).toBeVisible();
  await page.getByTestId("product-organic").check();
  await page.getByTestId("to-review").click();
  await expect(page.getByTestId("form-step-review")).toBeVisible();
}

async function productRow(page: Page, title: string) {
  return page.getByTestId("vendor-product-row").filter({ hasText: title });
}

test.describe("vendor dashboard", () => {
  test("loads with stats and the vendor's own id", async ({ page }) => {
    await loginAs(page, "demoVendor");
    await page.goto("/fa/vendor/dashboard");
    await expect(page.getByTestId("vendor-dashboard")).toHaveAttribute("data-vendor-id", "v01");
    await expect(page.getByTestId("vendor-stat-revenue")).toBeVisible();
    await expect(page.getByTestId("vendor-stat-orders")).toBeVisible();
    await expect(page.getByTestId("vendor-stat-products")).toBeVisible();
  });
});

test.describe("vendor product flow", () => {
  test("create → publish → visible in the public catalog", async ({ page }) => {
    const title = `E2E Product ${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
    await loginAs(page, "demoVendor");
    await page.goto("/fa/vendor/products/new");
    await fillStep1(page, title);
    await uploadTinyPng(page);
    await finishToReview(page);
    await page.getByTestId("publish-product").click();
    await expect(page).toHaveURL(/\/fa\/vendor\/products$/);

    const row = await productRow(page, title);
    await expect(row).toBeVisible();
    const slug = await row.getAttribute("data-product-slug");
    expect(slug).toBeTruthy();

    await page.goto(`/fa/product/${slug}`);
    await expect(page.getByRole("heading", { name: title })).toBeVisible();
    await expect(page.getByTestId("gallery-main")).toBeVisible();
  });

  test("a draft is stored but the public product page 404s", async ({ page }) => {
    const title = `E2E Draft ${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
    await loginAs(page, "demoVendor");
    await page.goto("/fa/vendor/products/new");
    await fillStep1(page, title);
    await finishToReview(page);
    await page.getByTestId("save-draft").click();
    await expect(page).toHaveURL(/\/fa\/vendor\/products$/);

    const row = await productRow(page, title);
    await expect(row).toBeVisible();
    await expect(row).toHaveAttribute("data-status", "DRAFT");
    const slug = await row.getAttribute("data-product-slug");
    expect(slug).toBeTruthy();

    await page.goto(`/fa/product/${slug}`);
    await expect(page.getByText("404")).toBeVisible();
  });

  test("edit stock through the form and quick +/- buttons", async ({ page }) => {
    const title = `E2E Stock ${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
    await loginAs(page, "demoVendor");
    await page.goto("/fa/vendor/products/new");
    await fillStep1(page, title);
    await finishToReview(page);
    await page.getByTestId("publish-product").click();
    await expect(page).toHaveURL(/\/fa\/vendor\/products$/);

    const row = await productRow(page, title);
    await expect(row.getByTestId("vendor-product-stock")).toContainText("۵");
    await row.getByTestId("stock-increase").click();
    await expect(row.getByTestId("vendor-product-stock")).toContainText("۶");

    await row.getByRole("link", { name: "ویرایش محصول" }).click();
    await expect(page.getByTestId("vendor-edit-product")).toBeVisible();
    await page.getByTestId("product-stock").fill("42");
    await page.getByTestId("to-step-2").click();
    await page.getByTestId("to-step-3").click();
    await page.getByTestId("to-review").click();
    await page.getByTestId("save-product").click();
    await expect(page).toHaveURL(/\/fa\/vendor\/products$/);
    const updated = await productRow(page, title);
    await expect(updated.getByTestId("vendor-product-stock")).toContainText("۴۲");
  });

  test("a vendor cannot open another vendor's product for editing", async ({ page }) => {
    await loginAs(page, "demoVendor");
    // p002 belongs to v02 (مزرعه ارگانیک دماوند).
    await page.goto("/fa/vendor/products/p002/edit");
    await expect(page.getByTestId("vendor-product-not-found")).toBeVisible();
  });

  test("products list filters by status and search", async ({ page }) => {
    await loginAs(page, "demoVendor");
    await page.goto("/fa/vendor/products?status=PUBLISHED");
    await expect(page.getByTestId("vendor-products")).toBeVisible();
    const rows = page.getByTestId("vendor-product-row");
    await expect(rows.first()).toBeVisible();
    for (const row of await rows.all()) {
      await expect(row).toHaveAttribute("data-status", "PUBLISHED");
    }
    await page.goto("/fa/vendor/products?q=zzz-no-such-title");
    await expect(page.getByTestId("vendor-product-row")).toHaveCount(0);
  });
});

test.describe("vendor registration + shop page", () => {
  test("registration creates a pending vendor shown as under review", async ({ page }) => {
    const email = `e2e-vendor-${Date.now()}-${Math.floor(Math.random() * 1e6)}@sabzineh.ir`;
    await page.goto("/fa/auth/vendor-register");
    await page.getByLabel("نام و نام خانوادگی").fill("New Vendor");
    await page.getByLabel("ایمیل").fill(email);
    await page.getByLabel("موبایل").fill("09123456789");
    await page.getByLabel("رمز عبور").fill("secret123");
    await page.getByLabel("نام فروشگاه").fill("E2E Test Shop");
    await page.getByLabel("شهر").fill("تهران");
    await page.getByTestId("vendor-register-submit").click();
    await expect(page).toHaveURL(/\/fa\/vendor\/dashboard$/);
    await expect(page.getByTestId("vendor-pending")).toBeVisible();
    await expect(page.getByTestId("vendor-dashboard")).toHaveAttribute("data-vendor-id", /.+/);
  });

  test("public shop page shows the vendor and its products", async ({ page }) => {
    await page.goto("/fa/vendor/bagh-sabz-karaj");
    await expect(page.getByTestId("vendor-shop")).toHaveAttribute("data-vendor-id", "v01");
    await expect(page.getByRole("heading", { name: "باغ سبز کرج", exact: true })).toBeVisible();
    await expect(page.getByTestId("product-card").first()).toBeVisible();
    // Payout details are never rendered on the public page.
    await expect(page.getByText("شبا")).toHaveCount(0);
  });
});

test.describe("vendor order fulfilment", () => {
  test("a real purchase shows up and advances PAID → PREPARING", async ({ page }) => {
    await loginAs(page, "demoCustomer");
    await page.goto("/fa/product/apples-pears-1");
    await page
      .getByTestId("purchase-box")
      .getByRole("button", { name: "افزودن به سبد" })
      .click();
    await page.goto("/fa/cart");
    await page.getByTestId("checkout-button").click();
    await fillAddress(page);
    await page.getByTestId("to-review-step").click();
    await page.getByTestId("place-order").click();
    await page.waitForURL(/\/payment\/mock\?authority=/);
    await page.getByTestId("mock-pay").click();
    await page.waitForURL(/\/account\/orders\/[^/]+\?payment=success/);
    const orderUrl = page.url();
    const orderId = orderUrl.split("/account/orders/")[1].split("?")[0];

    await logout(page);
    await loginAs(page, "demoVendor");
    await page.goto("/fa/vendor/dashboard");
    const row = page.locator(
      `[data-testid="vendor-order-row"][data-order-id="${orderId}"]`,
    );
    await expect(row).toBeVisible();
    await expect(row.getByTestId("vendor-order-status")).toHaveAttribute("data-status", "PAID");
    await row.getByTestId("vendor-order-advance").click();
    await expect(row.getByTestId("vendor-order-status")).toHaveAttribute(
      "data-status",
      "PREPARING",
    );
  });
});
