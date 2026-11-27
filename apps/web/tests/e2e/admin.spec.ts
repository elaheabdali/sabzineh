import { expect, test, type Page } from "@playwright/test";

// The admin flows are long (register → approve → publish → buy →
// deliver → payout) and this VM has 1.5 shared CPUs, where Firefox
// is markedly slower than Chromium; the default 30s per test is too
// tight for the two longest flows.
test.describe.configure({ timeout: 120_000 });

/**
 * Admin panel + subscriptions + payouts E2E (Week 6).
 *
 * - Approve a pending vendor → the vendor can publish a product.
 * - Reject a pending vendor with a reason → the vendor sees it.
 * - Suspend a user → login is blocked; re-activate → login works.
 * - Subscribe to the weekly box (Mock gateway) → pause → resume.
 * - Payout end-to-end: a fresh vendor sells one product, delivers
 *   the order, requests a payout, admin approves and marks it paid.
 *
 * Tests share one prod server and one in-memory store across the
 * Chromium + Firefox projects, so every actor gets a unique email /
 * shop name / product title and assertions never rely on global
 * counts. The payout flow uses a freshly registered vendor (not the
 * shared demo vendor) so the two browser projects cannot collide
 * on the single open payout per vendor.
 */

const uniq = () => `${Date.now()}-${Math.floor(Math.random() * 1e6)}`;

async function loginAs(page: Page, which: "demoCustomer" | "demoVendor" | "demoAdmin") {
  await page.goto("/fa/auth/login");
  await page.getByTestId(`demo-login-${which}`).click();
  await expect(page.getByTestId("header-user")).toBeVisible();
}

async function loginWithEmail(page: Page, email: string, password = "secret123") {
  await page.goto("/fa/auth/login");
  await page.getByLabel("ایمیل").fill(email);
  await page.getByLabel("رمز عبور").fill(password);
  await page.getByTestId("login-submit").click();
  await expect(page.getByTestId("header-user")).toBeVisible();
}

async function logout(page: Page) {
  await page.getByTestId("logout-button").first().click();
  await expect(page.getByTestId("login-link")).toBeVisible();
}

async function registerCustomer(page: Page, email: string) {
  await page.goto("/fa/auth/register");
  await page.getByLabel("نام و نام خانوادگی").fill("E2E Customer");
  await page.getByLabel("ایمیل").fill(email);
  await page.getByLabel("موبایل").fill("09123456789");
  await page.getByLabel("رمز عبور").fill("secret123");
  await page.getByTestId("register-submit").click();
  await expect(page.getByTestId("header-user")).toBeVisible();
}

async function registerVendor(page: Page, email: string, shopName: string) {
  await page.goto("/fa/auth/vendor-register");
  await page.getByLabel("نام و نام خانوادگی").fill("New Vendor");
  await page.getByLabel("ایمیل").fill(email);
  await page.getByLabel("موبایل").fill("09123456789");
  await page.getByLabel("رمز عبور").fill("secret123");
  await page.getByLabel("نام فروشگاه").fill(shopName);
  await page.getByLabel("شهر").fill("تهران");
  await page.getByTestId("vendor-register-submit").click();
  await expect(page).toHaveURL(/\/fa\/vendor\/dashboard$/);
}

async function addAddress(page: Page) {
  await page.goto("/fa/account/addresses");
  await page.getByLabel("عنوان آدرس").fill(`خانه-${uniq()}`);
  await page.getByLabel("شهر").fill("تهران");
  await page.getByLabel("آدرس کامل").fill("خیابان سبز، پلاک ۱۲۳، واحد ۴");
  await page.getByLabel("کد پستی").fill("1234567890");
  await page.getByLabel("موبایل گیرنده").fill("09123456789");
  await page.getByTestId("save-address").click();
  await expect(page.getByTestId("address-saved")).toBeVisible();
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

async function finishToReview(page: Page) {
  await page.locator('input[type="file"]').setInputFiles({
    name: "test.png",
    mimeType: "image/png",
    buffer: TINY_PNG,
  });
  await page.getByTestId("to-step-3").click();
  await expect(page.getByTestId("form-step-3")).toBeVisible();
  await page.getByTestId("product-organic").check();
  await page.getByTestId("to-review").click();
  await expect(page.getByTestId("form-step-review")).toBeVisible();
}

function vendorRow(page: Page, shopName: string) {
  return page.getByTestId("admin-vendor-row").filter({ hasText: shopName });
}

test.describe("admin vendor approval", () => {
  test("approve a pending vendor → the vendor can publish a product", async ({ page }) => {
    const email = `e2e-approve-${uniq()}@sabzineh.ir`;
    const shopName = `E2E Approve Shop ${uniq()}`;
    await registerVendor(page, email, shopName);
    await expect(page.getByTestId("vendor-pending")).toBeVisible();
    await logout(page);

    await loginAs(page, "demoAdmin");
    await page.goto("/fa/admin/vendors");
    const row = vendorRow(page, shopName);
    await expect(row).toBeVisible();
    const vendorId = await row.getAttribute("data-vendor-id");
    expect(vendorId).toBeTruthy();
    await row.getByTestId(`approve-vendor-${vendorId}`).click();
    await expect(vendorRow(page, shopName)).toHaveCount(0);
    await logout(page);

    await loginWithEmail(page, email);
    await page.goto("/fa/vendor/dashboard");
    await expect(page.getByTestId("vendor-pending")).toHaveCount(0);

    const title = `E2E Approved Product ${uniq()}`;
    await page.goto("/fa/vendor/products/new");
    await fillStep1(page, title);
    await finishToReview(page);
    await page.getByTestId("publish-product").click();
    await expect(page).toHaveURL(/\/fa\/vendor\/products$/);
    await expect(
      page.getByTestId("vendor-product-row").filter({ hasText: title }),
    ).toBeVisible();
  });

  test("reject a pending vendor with a reason → the vendor sees it", async ({ page }) => {
    const email = `e2e-reject-${uniq()}@sabzineh.ir`;
    const shopName = `E2E Reject Shop ${uniq()}`;
    const reason = "Incomplete documents — please resend your licence.";
    await registerVendor(page, email, shopName);
    await logout(page);

    await loginAs(page, "demoAdmin");
    await page.goto("/fa/admin/vendors");
    const row = vendorRow(page, shopName);
    await expect(row).toBeVisible();
    const vendorId = await row.getAttribute("data-vendor-id");
    expect(vendorId).toBeTruthy();
    await row.locator('input[name="reason"]').fill(reason);
    await row.getByTestId(`reject-vendor-${vendorId}`).click();
    await expect(vendorRow(page, shopName)).toHaveCount(0);
    await logout(page);

    await loginWithEmail(page, email);
    await page.goto("/fa/vendor/dashboard");
    await expect(page.getByTestId("vendor-rejected")).toBeVisible();
    await expect(page.getByTestId("vendor-rejection-reason")).toContainText(
      "Incomplete documents",
    );
  });
});

test.describe("admin user suspension", () => {
  test("suspend a user → login blocked; re-activate → login works", async ({ page }) => {
    const email = `e2e-suspend-${uniq()}@sabzineh.ir`;
    await registerCustomer(page, email);
    await logout(page);

    await loginAs(page, "demoAdmin");
    await page.goto(`/fa/admin/users?q=${encodeURIComponent(email)}`);
    const suspendButton = page.locator('[data-testid^="user-suspend-"]');
    await expect(suspendButton).toHaveCount(1);
    const userId = (await suspendButton.getAttribute("data-testid"))!.replace(
      "user-suspend-",
      "",
    );
    await suspendButton.click();
    await expect(page.getByTestId(`user-activate-${userId}`)).toBeVisible();
    await logout(page);

    await page.goto("/fa/auth/login");
    await page.getByLabel("ایمیل").fill(email);
    await page.getByLabel("رمز عبور").fill("secret123");
    await page.getByTestId("login-submit").click();
    await expect(page.getByTestId("login-error")).toBeVisible();

    await loginAs(page, "demoAdmin");
    await page.goto(`/fa/admin/users?q=${encodeURIComponent(email)}`);
    await page.getByTestId(`user-activate-${userId}`).click();
    await expect(page.getByTestId(`user-suspend-${userId}`)).toBeVisible();
    await logout(page);

    await loginWithEmail(page, email);
  });
});

test.describe("weekly box subscription", () => {
  test("subscribe via the gateway, then pause and resume", async ({ page }) => {
    const email = `e2e-box-${uniq()}@sabzineh.ir`;
    await registerCustomer(page, email);
    await addAddress(page);

    await page.goto("/fa/account/subscription");
    await expect(page.getByTestId("subscription-page")).toBeVisible();
    // Two box plans render the same radio group — scope to the
    // weekly plan's form before choosing the gateway.
    const weeklyForm = page.locator("form", {
      has: page.getByTestId("subscribe-box-plan-box-weekly"),
    });
    await weeklyForm.locator('input[name="payWith"][value="gateway"]').check();
    await page.getByTestId("subscribe-box-plan-box-weekly").click();
    await page.waitForURL(/\/payment\/mock\?authority=/);
    await page.getByTestId("mock-pay").click();
    await page.waitForURL(/\/account\/orders\/[^/]+\?payment=success/);

    await page.goto("/fa/account/subscription");
    await expect(page.getByTestId("current-subscription")).toBeVisible();
    await expect(page.getByTestId("subscription-status")).toHaveText("ACTIVE");

    await page.getByTestId("pause-subscription").click();
    await expect(page.getByTestId("subscription-status")).toHaveText("PAUSED");
    await expect(page.getByTestId("resume-subscription")).toBeVisible();

    await page.getByTestId("resume-subscription").click();
    await expect(page.getByTestId("subscription-status")).toHaveText("ACTIVE");
  });
});

test.describe("payouts end-to-end", () => {
  test("sell → deliver → request payout → admin approves → paid", async ({ page }) => {
    const vendorEmail = `e2e-payout-vendor-${uniq()}@sabzineh.ir`;
    const shopName = `E2E Payout Shop ${uniq()}`;
    await registerVendor(page, vendorEmail, shopName);
    await logout(page);

    await loginAs(page, "demoAdmin");
    await page.goto("/fa/admin/vendors");
    const row = vendorRow(page, shopName);
    await expect(row).toBeVisible();
    const pendingVendorId = await row.getAttribute("data-vendor-id");
    await row.getByTestId(`approve-vendor-${pendingVendorId}`).click();
    await expect(vendorRow(page, shopName)).toHaveCount(0);
    await logout(page);

    // The approved vendor publishes one product.
    await loginWithEmail(page, vendorEmail);
    await page.goto("/fa/vendor/dashboard");
    const vendorId = await page
      .getByTestId("vendor-dashboard")
      .getAttribute("data-vendor-id");
    expect(vendorId).toBeTruthy();
    const title = `E2E Payout Product ${uniq()}`;
    await page.goto("/fa/vendor/products/new");
    await fillStep1(page, title);
    await finishToReview(page);
    await page.getByTestId("publish-product").click();
    await expect(page).toHaveURL(/\/fa\/vendor\/products$/);
    const productRow = page
      .getByTestId("vendor-product-row")
      .filter({ hasText: title });
    const slug = await productRow.getAttribute("data-product-slug");
    expect(slug).toBeTruthy();
    await logout(page);

    // A fresh customer buys it and pays through the mock gateway.
    const customerEmail = `e2e-payout-customer-${uniq()}@sabzineh.ir`;
    await registerCustomer(page, customerEmail);
    await page.goto(`/fa/product/${slug}`);
    await page
      .getByTestId("purchase-box")
      .getByRole("button", { name: "افزودن به سبد" })
      .click();
    // Wait for the cart store to pick the item up before leaving the page.
    await expect(page.getByLabel("سبد خرید")).toContainText("۱");
    await page.goto("/fa/cart");
    await page.getByTestId("checkout-button").click();
    const addressTitle = `خانه-${uniq()}`;
    await page.getByLabel("عنوان آدرس").fill(addressTitle);
    await page.getByLabel("شهر").fill("تهران");
    await page.getByLabel("آدرس کامل").fill("خیابان سبز، پلاک ۱۲۳، واحد ۴");
    await page.getByLabel("کد پستی").fill("1234567890");
    await page.getByLabel("موبایل گیرنده").fill("09123456789");
    await page.getByTestId("save-address").click();
    await expect(page.getByLabel(addressTitle)).toBeChecked();
    await page.getByTestId("to-payment-step").click();
    await page.getByTestId("to-review-step").click();
    await page.getByTestId("place-order").click();
    await page.waitForURL(/\/payment\/mock\?authority=/);
    await page.getByTestId("mock-pay").click();
    await page.waitForURL(/\/account\/orders\/[^/]+\?payment=success/);
    const orderId = page.url().split("/account/orders/")[1].split("?")[0];
    await logout(page);

    // The vendor delivers the order: PAID → PREPARING → SHIPPED → DELIVERED.
    await loginWithEmail(page, vendorEmail);
    await page.goto("/fa/vendor/dashboard");
    const orderRow = page.locator(
      `[data-testid="vendor-order-row"][data-order-id="${orderId}"]`,
    );
    await expect(orderRow).toBeVisible();
    for (const status of ["PREPARING", "SHIPPED", "DELIVERED"]) {
      await orderRow.getByTestId("vendor-order-advance").click();
      await expect(orderRow.getByTestId("vendor-order-status")).toHaveAttribute(
        "data-status",
        status,
      );
    }

    // The vendor requests the payout for the last 30 days.
    await page.goto("/fa/vendor/subscription");
    await expect(page.getByTestId("request-payout")).toBeVisible();
    await page.getByTestId("request-payout").click();
    await expect(
      page.getByTestId("vendor-payout-row").first(),
    ).toHaveAttribute("data-payout-status", "REQUESTED");
    await logout(page);

    // The admin approves it and marks it paid.
    await loginAs(page, "demoAdmin");
    await page.goto("/fa/admin/payouts");
    const payoutRow = page
      .getByTestId("admin-payout-row")
      .filter({ hasText: vendorId! });
    await expect(payoutRow).toHaveCount(1);
    const payoutId = await payoutRow.getAttribute("data-payout-id");
    expect(payoutId).toBeTruthy();
    await payoutRow.getByTestId(`approve-payout-${payoutId}`).click();
    await expect(payoutRow.getByTestId("payout-status")).toHaveText("APPROVED");
    await payoutRow.getByTestId(`pay-payout-${payoutId}`).click();
    await expect(payoutRow.getByTestId("payout-status")).toHaveText("PAID");
  });
});
