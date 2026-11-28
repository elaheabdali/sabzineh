import { expect, test, type Page } from "@playwright/test";

/**
 * Zarinpal sandbox E2E (Week 4).
 *
 * GATED — this file is skipped everywhere unless explicitly enabled:
 *
 *   E2E_ZARINPAL=1 PAYMENT_PROVIDER=zarinpal \
 *     ZARINPAL_MERCHANT_ID=<test uuid> \
 *     pnpm --filter web exec playwright test tests/e2e/zarinpal-sandbox.spec.ts
 *
 * (Do NOT use `pnpm --filter web test:e2e -- <file>`: pnpm's `--`
 * swallows the file filter and the whole suite runs — the Mock
 * checkout tests then fail against the Zarinpal server.)
 *
 * Run ONLY this file with the sandbox env. The rest of the suite
 * assumes the Mock gateway (place-order redirects to /payment/mock);
 * running the whole suite with PAYMENT_PROVIDER=zarinpal would
 * break checkout.spec.ts. CI never sets E2E_ZARINPAL, so this file
 * is skipped there — the real sandbox is never hit from CI.
 *
 * What it proves (no real money moves — sandbox only):
 * 1. Checkout with the Zarinpal provider issues a redirect to the
 *    real sandbox StartPay URL with a real S000… authority. The
 *    browser in this VM cannot LOAD that page (the egress proxy
 *    refuses the tunnel to sandbox.zarinpal.com), so the tests
 *    capture the navigation request URL instead of waiting for the
 *    page — the request URL is the proof. A human click-through in
 *    a normal browser (or on the deployed site) loads StartPay.
 * 2. The callback with Status=NOK cancels the order (stock released,
 *    wallet refunded) and the cart stays intact.
 * 3. The callback with Status=OK for an UNPAID authority calls the
 *    real sandbox verify, gets a definitive failure, and the order
 *    ends CANCELLED — never PAID. This is the amount/authority
 *    safety net: PAID requires a successful server-side verify.
 *
 * The captcha on StartPay is never filled in: the tests stop at the
 * gateway redirect. A human click-through in a normal browser
 * completes the payment with the sandbox test card.
 */

const SANDBOX_ENABLED =
  process.env.E2E_ZARINPAL === "1" && process.env.PAYMENT_PROVIDER === "zarinpal";

async function loginAsCustomer(page: Page) {
  await page.goto("/fa/auth/login");
  await page.getByTestId("demo-login-demoCustomer").click();
  await expect(page.getByTestId("header-user")).toBeVisible();
}

async function addProductToCart(page: Page) {
  await page.goto("/fa/product/apples-pears-1");
  await page.getByTestId("purchase-box").getByRole("button", { name: "افزودن به سبد" }).click();
  const cartLink = page.getByRole("link", { name: "سبد خرید" });
  await expect(cartLink.locator("span")).toHaveText("۱");
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

/** Logs in, checks out one item and captures the StartPay redirect. Returns the authority. */
async function checkoutToStartPay(page: Page): Promise<string> {
  await loginAsCustomer(page);
  await addProductToCart(page);
  await page.goto("/fa/checkout");
  await fillAddress(page);
  await expect(page.getByTestId("checkout-step-payment")).toBeVisible();
  await page.getByTestId("to-review-step").click();
  await expect(page.getByTestId("checkout-step-review")).toBeVisible();
  // Capture the navigation REQUEST, not the loaded page: this VM's
  // egress proxy refuses the tunnel to sandbox.zarinpal.com, so the
  // browser can never render StartPay here (ERR_TUNNEL_CONNECTION_
  // FAILED). The issued request URL still proves checkout redirected
  // to a real S000… authority.
  const startPayRequest = page.waitForRequest(/sandbox\.zarinpal\.com\/pg\/StartPay\/S000/, {
    timeout: 60_000,
  });
  await page.getByTestId("place-order").click();
  const request = await startPayRequest;
  const match = request.url().match(/StartPay\/(S000\w+)/);
  expect(match).not.toBeNull();
  return match![1];
}

test.describe("zarinpal sandbox — live gateway flow", () => {
  test.skip(!SANDBOX_ENABLED, "Set E2E_ZARINPAL=1 with PAYMENT_PROVIDER=zarinpal to run the sandbox flow.");

  test("checkout redirects to sandbox StartPay with a real authority", async ({ page }) => {
    test.setTimeout(120_000);
    const authority = await checkoutToStartPay(page);
    expect(authority.startsWith("S000")).toBe(true);
  });

  test("callback with Status=NOK cancels the order, cart stays intact", async ({ page }) => {
    test.setTimeout(120_000);
    const authority = await checkoutToStartPay(page);

    const response = await page.request.get(
      `/api/payments/callback?Authority=${authority}&Status=NOK&locale=fa`,
      { maxRedirects: 0 },
    );
    expect([301, 302, 303, 307, 308]).toContain(response.status());
    const location = response.headers()["location"] ?? "";
    expect(location).toMatch(/\/fa\/account\/orders\/[^/]+\?payment=cancelled/);

    await page.goto(location);
    await expect(page.getByTestId("payment-cancelled-banner")).toBeVisible();
    await expect(page.getByTestId("order-status")).toHaveAttribute("data-status", "CANCELLED");

    await page.goto("/fa/cart");
    await expect(page.getByTestId("cart-line")).toHaveCount(1);
  });

  test("callback with Status=OK for an unpaid authority never marks the order PAID", async ({ page }) => {
    test.setTimeout(120_000);
    const authority = await checkoutToStartPay(page);

    // The customer never paid on StartPay, so the real sandbox
    // verify must fail and the order must end CANCELLED.
    const response = await page.request.get(
      `/api/payments/callback?Authority=${authority}&Status=OK&locale=fa`,
      { maxRedirects: 0 },
    );
    expect([301, 302, 303, 307, 308]).toContain(response.status());
    const location = response.headers()["location"] ?? "";
    expect(location).toMatch(/\/fa\/account\/orders\/[^/]+/);

    await page.goto(location);
    await expect(page.getByTestId("order-status")).toHaveAttribute("data-status", "CANCELLED");
  });
});
