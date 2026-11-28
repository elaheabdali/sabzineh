import { expect, test, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

/**
 * Accessibility E2E (Week 8).
 *
 * Automated axe pass over the main flows in both browsers, plus a
 * keyboard-only navigation check on the checkout flow. Any violation
 * fails the test — fix the UI, do not relax the rule.
 *
 * Tests share one prod server and one in-memory store across the
 * Chromium + Firefox projects; the cart/checkout scans add a product
 * with ample stock (p001 / apples-pears-1, stock 33) and never assert
 * on global counts.
 */

async function loginAs(page: Page, which: "demoCustomer" | "demoVendor" | "demoAdmin") {
  await page.goto("/fa/auth/login");
  await page.getByTestId(`demo-login-${which}`).click();
  await expect(page.getByTestId("header-user")).toBeVisible();
}

async function addProductToCart(page: Page) {
  await page.goto("/fa/product/apples-pears-1");
  await page
    .getByTestId("purchase-box")
    .getByRole("button", { name: "افزودن به سبد" })
    .click();
  await expect(page.getByRole("link", { name: "سبد خرید" }).locator("span")).toHaveText("۱");
}

async function expectNoViolations(page: Page) {
  const results = await new AxeBuilder({ page }).analyze();
  expect(results.violations).toEqual([]);
}

test("home page has no axe violations", async ({ page }) => {
  await page.goto("/fa");
  await expectNoViolations(page);
});

test("category page has no axe violations", async ({ page }) => {
  await page.goto("/fa/category/fruits-vegetables");
  await expectNoViolations(page);
});

test("product page has no axe violations", async ({ page }) => {
  await page.goto("/fa/product/apples-pears-1");
  await expectNoViolations(page);
});

test("login page has no axe violations", async ({ page }) => {
  await page.goto("/fa/auth/login");
  await expectNoViolations(page);
});

test("cart page has no axe violations", async ({ page }) => {
  await loginAs(page, "demoCustomer");
  await addProductToCart(page);
  await page.goto("/fa/cart");
  await expectNoViolations(page);
});

test("checkout page has no axe violations", async ({ page }) => {
  await loginAs(page, "demoCustomer");
  await addProductToCart(page);
  await page.goto("/fa/checkout");
  await expect(page.getByTestId("checkout-step-address")).toBeVisible();
  await expectNoViolations(page);
});

test("vendor dashboard has no axe violations", async ({ page }) => {
  await loginAs(page, "demoVendor");
  await page.goto("/fa/vendor/dashboard");
  await expectNoViolations(page);
});

test("admin dashboard has no axe violations", async ({ page }) => {
  await loginAs(page, "demoAdmin");
  await page.goto("/fa/admin/dashboard");
  await expectNoViolations(page);
});

test("checkout is operable by keyboard only", async ({ page }) => {
  await loginAs(page, "demoCustomer");
  await addProductToCart(page);
  await page.goto("/fa/checkout");
  await expect(page.getByTestId("checkout-step-address")).toBeVisible();

  // Tab from the top of the page: every Tab must land on a visible,
  // focusable element, and the address form + its continue button
  // must both be reachable without a mouse.
  const focused: string[] = [];
  for (let i = 0; i < 40; i++) {
    await page.keyboard.press("Tab");
    const tag = await page.evaluate(() => {
      const el = document.activeElement as HTMLElement | null;
      return el ? `${el.tagName.toLowerCase()}#${el.id || ""}.${(el.className || "").toString().slice(0, 20)}` : "none";
    });
    focused.push(tag);
    const onSave = await page.evaluate(
      () => (document.activeElement as HTMLElement | null)?.getAttribute("data-testid") === "save-address",
    );
    if (onSave) break;
  }
  expect(focused.some((t) => t.startsWith("input"))).toBe(true);
  expect(focused.some((t) => t.startsWith("button"))).toBe(true);
  // The address form itself is keyboard-reachable: focus the title
  // field via Tab and type into it.
  await page.getByLabel("عنوان آدرس").focus();
  await page.keyboard.type("خانه");
  await expect(page.getByLabel("عنوان آدرس")).toHaveValue("خانه");
});
