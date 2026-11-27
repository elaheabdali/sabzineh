import { expect, test, type Page } from "@playwright/test";

/**
 * Catalog E2E (Week 2).
 *
 * The headline test is the plan's acceptance test (page 9): apply a
 * combined filter (category + price + in-stock only + sort), copy the
 * URL, open it in a FRESH browser context, and assert the identical
 * product list in the identical order.
 */

async function productTitles(page: Page): Promise<string[]> {
  const texts = await page.getByTestId("product-title").allTextContents();
  return texts.map((t) => t.trim()).filter(Boolean);
}

test.describe("catalog — combined filter acceptance", () => {
  test("copied filter URL reproduces the identical list in a fresh context", async ({ page, browser }) => {
    await page.goto("/fa/category/fruits-vegetables");
    await expect(page.getByTestId("result-count")).toBeVisible();

    // In-stock only (link toggle → server navigation).
    await page.getByTestId("filter-inStock").click();
    await page.waitForURL(/inStock=true/);

    // Cheapest first (select → router.push).
    await page.getByTestId("sort-select").selectOption("cheapest");
    await page.waitForURL(/sort=cheapest/);

    // Max price 100,000 (debounced input → router.replace).
    await page.getByTestId("max-price").fill("100000");
    await page.waitForURL(/maxPrice=100000/);

    const titles = await productTitles(page);
    expect(titles.length).toBeGreaterThan(0);
    const url = page.url();

    // Fresh context, same URL — the acceptance assertion.
    const context2 = await browser.newContext();
    const page2 = await context2.newPage();
    await page2.goto(url);
    await expect(page2.getByTestId("result-count")).toBeVisible();
    expect(await productTitles(page2)).toEqual(titles);
    await context2.close();
  });

  test("pagination shows disjoint pages", async ({ page }) => {
    await page.goto("/fa/category/fruits-vegetables");
    const page1 = await productTitles(page);
    expect(page1.length).toBeGreaterThan(0);
    await page.goto("/fa/category/fruits-vegetables?page=2");
    const page2 = await productTitles(page);
    expect(page2.length).toBeGreaterThan(0);
    expect(page2).not.toEqual(page1);
    await expect(page.getByTestId("pagination")).toBeVisible();
  });

  test("mobile filter drawer opens and closes", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/fa/category/fruits-vegetables");
    await page.getByTestId("open-filters").click();
    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();
    await expect(dialog.getByTestId("filter-organic")).toBeVisible();
    await page.getByTestId("close-filters").click();
    await expect(dialog).toBeHidden();
  });
});

test.describe("catalog — search", () => {
  test("text search finds products by title", async ({ page }) => {
    await page.goto("/fa/search?q=%D8%B9%D8%B3%D9%84");
    const titles = await productTitles(page);
    expect(titles.length).toBeGreaterThan(0);
    expect(titles.every((t) => t.includes("عسل"))).toBe(true);
  });

  test("empty search shows the empty state", async ({ page }) => {
    await page.goto("/fa/search?q=zzzzzz-no-such-product");
    await expect(page.getByTestId("empty-state")).toBeVisible();
    await expect(page.getByTestId("result-count")).toContainText("۰");
  });

  test("smart search turns a phrase into filters", async ({ page }) => {
    await page.goto("/fa/search");
    await page.getByTestId("smart-search-input").fill("عسل ارگانیک ارزان");
    await page.getByTestId("smart-search-submit").click();
    await page.waitForURL(/organic=true/);
    await page.waitForURL(/sort=cheapest/);
    await expect(page.getByTestId("smart-matched")).toBeVisible();
    const titles = await productTitles(page);
    expect(titles.length).toBeGreaterThan(0);
    expect(titles.every((t) => t.includes("عسل"))).toBe(true);
  });
});

test.describe("catalog — product page", () => {
  test("gallery, quantity and add-to-cart work", async ({ page }) => {
    await page.goto("/fa/product/apples-pears-1");
    await expect(page.getByTestId("gallery-main")).toBeVisible();
    await page.getByTestId("gallery-thumb").nth(1).click();
    await page.getByTestId("qty-increase").click();
    await expect(page.getByTestId("qty-value")).toHaveText("۲");
    await page
      .getByTestId("purchase-box")
      .getByRole("button", { name: "افزودن به سبد" })
      .click();
    const cartLink = page.getByRole("link", { name: "سبد خرید" });
    await expect(cartLink.locator("span")).toHaveText("۲");
  });
});
