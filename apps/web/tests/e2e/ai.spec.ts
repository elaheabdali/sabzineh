import { expect, test, type Page } from "@playwright/test";

/**
 * AI + realtime E2E (Week 7).
 *
 * Smart search (synonyms, typo correction, phrase → filters),
 * recommendations on home + cart, the rule-based assistant answering
 * from real catalog data, the SSE endpoint streaming a hello event,
 * and an order-status change (payment verified) appearing in the
 * notifications center. Everything here is deterministic heuristics —
 * no AI API is called.
 *
 * Tests share one prod server and one in-memory store across the
 * Chromium + Firefox projects, so they never assert on global counts
 * and use products with ample stock (p001 / apples-pears-1, stock 33).
 */

async function loginAs(page: Page, which: "demoCustomer" | "demoVendor" | "demoAdmin") {
  await page.goto("/fa/auth/login");
  await page.getByTestId(`demo-login-${which}`).click();
  await expect(page.getByTestId("header-user")).toBeVisible();
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

test.describe("smart search", () => {
  test("Persian phrase → structured filters with matched chips", async ({ page }) => {
    await page.goto("/fa/search?smart=" + encodeURIComponent("عسل ارگانیک"));
    await expect(page.getByTestId("smart-matched")).toBeVisible();
    await expect(page.getByTestId("smart-matched")).toContainText("ارگانیک");
    await expect(page.getByTestId("product-card").first()).toBeVisible();
    // Every result is honey (the query term survives as q).
    await expect(page.getByTestId("product-title").first()).toContainText("عسل");
  });

  test("a typo is corrected and the correction is shown", async ({ page }) => {
    await page.goto("/fa/search?smart=" + encodeURIComponent("عسلل ارگانیک"));
    await expect(page.getByTestId("smart-corrected")).toBeVisible();
    await expect(page.getByTestId("smart-corrected")).toContainText("عسلل");
    await expect(page.getByTestId("smart-corrected")).toContainText("عسل");
    await expect(page.getByTestId("product-card").first()).toBeVisible();
  });

  test("an English word maps to the Persian catalog term", async ({ page }) => {
    await page.goto("/fa/search?smart=" + encodeURIComponent("honey"));
    await expect(page.getByTestId("product-card").first()).toBeVisible();
    await expect(page.getByTestId("product-title").first()).toContainText("عسل");
  });
});

test.describe("recommendations", () => {
  test("homepage shows best-sellers for guests with a reason line", async ({ page }) => {
    await page.goto("/fa");
    const section = page.getByTestId("recommendations");
    await expect(section).toBeVisible();
    await expect(section.getByTestId("product-card").first()).toBeVisible();
    await expect(section.getByTestId("recommendation-reason").first()).toBeVisible();
  });

  test("cart page shows bundle recommendations for the cart vendor", async ({ page }) => {
    await loginAs(page, "demoCustomer");
    await addProductToCart(page, 1);
    await page.goto("/fa/cart");
    const section = page.getByTestId("recommendations");
    await expect(section).toBeVisible();
    await expect(section.getByTestId("product-card").first()).toBeVisible();
    // The added product itself is excluded from its own recommendations.
    const titles = await section.getByTestId("product-title").allTextContents();
    expect(titles.some((title) => title.includes("سیب قرمز ارگانیک"))).toBe(false);
  });
});

test.describe("assistant chat", () => {
  test("answers a product question from real catalog data", async ({ page }) => {
    await page.goto("/fa");
    await page.getByTestId("assistant-toggle").click();
    await expect(page.getByTestId("assistant-panel")).toBeVisible();
    await page.getByTestId("assistant-input").fill("عسل چی داری؟");
    await page.getByTestId("assistant-send").click();
    const reply = page.getByTestId("assistant-reply").last();
    await expect(reply).toContainText("عسل");
    await expect(page.getByTestId("assistant-product-link").first()).toBeVisible();
  });

  test("asks a guest to sign in for order status", async ({ page }) => {
    await page.goto("/fa");
    await page.getByTestId("assistant-toggle").click();
    await page.getByTestId("assistant-input").fill("وضعیت سفارشم چیه؟");
    await page.getByTestId("assistant-send").click();
    const reply = page.getByTestId("assistant-reply").last();
    await expect(reply).toContainText("وارد");
  });
});

test.describe("realtime — SSE + notifications", () => {
  test("SSE endpoint streams a hello event for a logged-in user", async ({ page }) => {
    await loginAs(page, "demoCustomer");
    const gotHello = await page.evaluate(async () => {
      const res = await fetch("/api/events");
      if (!res.ok || !res.body) return false;
      const reader = res.body.getReader();
      const { value } = await reader.read();
      await reader.cancel();
      return new TextDecoder().decode(value).includes("event: hello");
    });
    expect(gotHello).toBe(true);
  });

  test("a verified payment appears in the notifications center", async ({ page }) => {
    await loginAs(page, "demoCustomer");
    await addProductToCart(page, 1);
    await page.goto("/fa/checkout");
    await fillAddress(page);
    await page.getByTestId("to-review-step").click();
    await expect(page.getByTestId("checkout-step-review")).toBeVisible();
    await page.getByTestId("place-order").click();
    await page.waitForURL(/\/payment\/mock\?authority=/);
    await page.getByTestId("mock-pay").click();
    await page.waitForURL(/\/account\/orders\/[^/]+\?payment=success/);
    await expect(page.getByTestId("order-status")).toHaveAttribute("data-status", "PAID");

    // The header bell picks the new notification up (polling fallback).
    await expect(page.getByTestId("notifications-count")).toBeVisible();
    await page.goto("/fa/account/notifications");
    await expect(page.getByTestId("notifications-page")).toBeVisible();
    const paid = page.locator('[data-testid="notification-item"][data-type="order-paid"]').first();
    await expect(paid).toBeVisible();

    // Mark-all-read clears the unread badge.
    await page.getByTestId("notifications-mark-all-read").click();
    await expect(page.getByTestId("notifications-count")).toHaveCount(0);
  });
});

test.describe("vendor description draft", () => {
  test("generates an editable Persian draft from title + attributes", async ({ page }) => {
    await loginAs(page, "demoVendor");
    await page.goto("/fa/vendor/products/new");
    await expect(page.getByTestId("product-form")).toBeVisible();
    await page.getByTestId("product-title").fill("عسل کوهی");
    await page.getByTestId("generate-description").click();
    await expect(page.getByTestId("product-description")).toHaveValue(/عسل کوهی/);
    // The draft is editable before save — it is not auto-published.
    await page.getByTestId("product-description").fill("توضیح ویرایش‌شده توسط فروشنده");
    await expect(page.getByTestId("product-description")).toHaveValue("توضیح ویرایش‌شده توسط فروشنده");
  });
});
