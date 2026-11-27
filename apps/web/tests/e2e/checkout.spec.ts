import { expect, test, type Page } from "@playwright/test";

/**
 * Checkout E2E (Week 3).
 *
 * Full purchase flow (login → add to cart → checkout with address →
 * Mock payment success → confirmation shows the order and the cart
 * is empty), the cancelled-payment flow (cart intact), and the role
 * guards (guest / customer / vendor / admin + cross-user order
 * isolation).
 *
 * Tests share one prod server and one in-memory store across the
 * Chromium + Firefox projects, so they never assert on order counts
 * and use products with ample stock (p001 / apples-pears-1, stock 33).
 */

async function loginAs(page: Page, which: "demoCustomer" | "demoVendor" | "demoAdmin") {
  await page.goto("/fa/auth/login");
  await page.getByTestId(`demo-login-${which}`).click();
  await expect(page.getByTestId("header-user")).toBeVisible();
}

async function logout(page: Page) {
  await page.getByTestId("logout-button").first().click();
  await expect(page.getByTestId("login-link")).toBeVisible();
}

async function addProductToCart(page: Page, qty: number) {
  await page.goto("/fa/product/apples-pears-1");
  for (let i = 1; i < qty; i++) {
    await page.getByTestId("qty-increase").click();
  }
  await page
    .getByTestId("purchase-box")
    .getByRole("button", { name: "افزودن به سبد" })
    .click();
  const cartLink = page.getByRole("link", { name: "سبد خرید" });
  await expect(cartLink.locator("span")).toHaveText(qty === 1 ? "۱" : "۲");
}

async function fillAddress(page: Page) {
  // Tests run in parallel workers against one server and one shared
  // demo customer, so the address list is a moving target — a global
  // count is racy. Give this address a unique title and wait for
  // its own radio to become checked instead.
  const title = `خانه-${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
  await page.getByLabel("عنوان آدرس").fill(title);
  await page.getByLabel("شهر").fill("تهران");
  await page.getByLabel("آدرس کامل").fill("خیابان سبز، پلاک ۱۲۳، واحد ۴");
  await page.getByLabel("کد پستی").fill("1234567890");
  await page.getByLabel("موبایل گیرنده").fill("09123456789");
  await page.getByTestId("save-address").click();
  // The wrapper action selects the newly saved address.
  await expect(page.getByLabel(title)).toBeChecked();
  await page.getByTestId("to-payment-step").click();
}

async function goToReview(page: Page) {
  await expect(page.getByTestId("checkout-step-payment")).toBeVisible();
  await page.getByTestId("to-review-step").click();
  await expect(page.getByTestId("checkout-step-review")).toBeVisible();
}

test.describe("checkout — full purchase flow", () => {
  test("login → cart → checkout → mock pay → confirmation, cart emptied", async ({ page }) => {
    await loginAs(page, "demoCustomer");
    await addProductToCart(page, 2);

    await page.goto("/fa/cart");
    await expect(page.getByTestId("cart-line")).toHaveCount(1);
    await page.getByTestId("checkout-button").click();
    await expect(page.getByTestId("checkout-page")).toBeVisible();

    await fillAddress(page);
    await goToReview(page);

    await page.getByTestId("place-order").click();
    await page.waitForURL(/\/payment\/mock\?authority=/);
    await expect(page.getByTestId("mock-order-id")).toBeVisible();

    await page.getByTestId("mock-pay").click();
    await page.waitForURL(/\/account\/orders\/[^/]+\?payment=success/);
    await expect(page.getByTestId("payment-success-banner")).toBeVisible();
    await expect(page.getByTestId("order-status")).toHaveAttribute("data-status", "PAID");

    // The cart is cleared once the order is seen as PAID.
    const cartLink = page.getByRole("link", { name: "سبد خرید" });
    await expect(cartLink.locator("span")).toHaveCount(0);
    await page.goto("/fa/cart");
    await expect(page.getByText("سبد خرید شما خالی است")).toBeVisible();
  });

  test("discount code applies server-side for a fresh customer", async ({ page }) => {
    // A fresh account per test: WELCOME is once-per-user and the demo
    // customer is shared across the Chromium + Firefox projects.
    const email = `e2e-${Date.now()}-${Math.floor(Math.random() * 1e6)}@sabzineh.ir`;
    await page.goto("/fa/auth/register");
    await page.getByLabel("نام و نام خانوادگی").fill("Test Buyer");
    await page.getByLabel("ایمیل").fill(email);
    await page.getByLabel("موبایل").fill("09123456789");
    await page.getByLabel("رمز عبور").fill("secret123");
    await page.getByTestId("register-submit").click();
    await expect(page.getByTestId("header-user")).toBeVisible();

    await addProductToCart(page, 2);
    await page.goto("/fa/checkout");
    await fillAddress(page);

    await page.getByTestId("discount-input").fill("WELCOME");
    await page.getByTestId("apply-discount").click();
    await expect(page.getByTestId("discount-applied")).toBeVisible();
    // 180,000 − 50,000 = 130,000 payable.
    await expect(page.getByTestId("checkout-payable")).toContainText("۱۳۰٬۰۰۰");

    await goToReview(page);
    await page.getByTestId("place-order").click();
    await page.waitForURL(/\/payment\/mock\?authority=/);
    await page.getByTestId("mock-pay").click();
    await page.waitForURL(/\/account\/orders\/[^/]+\?payment=success/);
    await expect(page.getByTestId("order-status")).toHaveAttribute("data-status", "PAID");
  });

  test("cancelled payment leaves the cart intact", async ({ page }) => {
    await loginAs(page, "demoCustomer");
    await addProductToCart(page, 1);

    await page.goto("/fa/checkout");
    await fillAddress(page);
    await goToReview(page);
    await page.getByTestId("place-order").click();
    await page.waitForURL(/\/payment\/mock\?authority=/);

    await page.getByTestId("mock-cancel").click();
    await page.waitForURL(/\/account\/orders\/[^/]+\?payment=cancelled/);
    await expect(page.getByTestId("payment-cancelled-banner")).toBeVisible();
    await expect(page.getByTestId("order-status")).toHaveAttribute("data-status", "CANCELLED");

    await page.goto("/fa/cart");
    await expect(page.getByTestId("cart-line")).toHaveCount(1);
    await expect(page.getByTestId("cart-qty")).toHaveText("۱");
  });
});

test.describe("auth — role guards", () => {
  test("guests are sent to login for protected groups", async ({ page }) => {
    await page.goto("/fa/vendor/dashboard");
    await expect(page).toHaveURL(/\/fa\/auth\/login\?next=/);
    await page.goto("/fa/admin/dashboard");
    await expect(page).toHaveURL(/\/fa\/auth\/login\?next=/);
    await page.goto("/fa/account/orders");
    await expect(page).toHaveURL(/\/fa\/auth\/login\?next=/);
  });

  test("customer cannot open vendor or admin panels", async ({ page }) => {
    await loginAs(page, "demoCustomer");
    await page.goto("/fa/vendor/dashboard");
    await expect(page.getByText("به این صفحه دسترسی ندارید")).toBeVisible();
    await page.goto("/fa/admin/dashboard");
    await expect(page.getByText("به این صفحه دسترسی ندارید")).toBeVisible();
    // …but their own orders page works.
    await page.goto("/fa/account/orders");
    await expect(page.getByTestId("orders-page")).toBeVisible();
  });

  test("vendor sees only their own dashboard, admin sees the admin panel", async ({ page }) => {
    await loginAs(page, "demoVendor");
    await page.goto("/fa/vendor/dashboard");
    await expect(page.getByTestId("vendor-dashboard")).toHaveAttribute("data-vendor-id", "v01");
    await page.goto("/fa/admin/dashboard");
    await expect(page.getByText("به این صفحه دسترسی ندارید")).toBeVisible();

    await logout(page);
    await loginAs(page, "demoAdmin");
    await page.goto("/fa/admin/dashboard");
    await expect(page.getByTestId("admin-dashboard")).toBeVisible();
    await page.goto("/fa/admin/users");
    await expect(page.getByTestId("admin-users")).toBeVisible();
  });

  test("a vendor cannot open a customer's order page", async ({ page }) => {
    // Create an order as the customer and capture its URL.
    await loginAs(page, "demoCustomer");
    await addProductToCart(page, 1);
    await page.goto("/fa/checkout");
    await fillAddress(page);
    await goToReview(page);
    await page.getByTestId("place-order").click();
    await page.waitForURL(/\/payment\/mock\?authority=/);
    await page.getByTestId("mock-pay").click();
    await page.waitForURL(/\/account\/orders\/[^/]+\?payment=success/);
    const orderUrl = page.url();

    await logout(page);
    await loginAs(page, "demoVendor");
    await page.goto(orderUrl);
    await expect(page.getByText("سفارش پیدا نشد")).toBeVisible();
  });
});
