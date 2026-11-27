# Demo script — Sabzineh in 10 minutes

A step-by-step walkthrough for a job interview or portfolio review.
Run it against the live site (https://sabzineh-web.vercel.app) or a
local prod build (`pnpm build && pnpm start`). All demo logins use
password `demo1234` (one-click demo-login buttons on `/auth/login`).

> ⚠️ The live site currently serves category/product pages from the
> seed adapter only after the DATABASE_URL fix (see README →
> "Production status"). If a category page errors on the live site,
> run the same flow locally — it is identical data.

## 0. Setup (30 seconds)

1. Open `/fa` — Persian RTL storefront, hero, categories, featured
   products, "پیشنهاد برای شما".
2. Switch to English (header globe) and back — same pages, LTR,
   translated strings, Jalali dates become Gregorian.

## 1. Customer: search → filter → buy (3 minutes)

1. Search `بدون گلوتن` in the header search — the smart search parses
   the phrase into structured filters (show the applied chips).
2. Open `/fa/category/fruits-vegetables`, set a max price + "فقط موجود",
   sort by cheapest. Copy the URL into a new tab: the exact same list
   appears — filter state lives in the URL.
3. Open a product (`/fa/product/apples-pears-1`): gallery, vendor,
   attributes, reviews, related products.
4. Log in as customer (demo button), add 2 items, open the cart —
   items are grouped per vendor.
5. Checkout: add an address (Iranian postal code + mobile validation),
   apply code `WELCOME` (50,000 Toman off), pay part by wallet and the
   rest by Mock gateway → confirmation page shows the order as PAID
   and the cart is empty. Cancel a second payment to show the cart
   stays intact.

## 2. AI features (2 minutes)

1. On `/fa/search`, type `سیب ارزان برای دیابت` — synonyms + typo
   tolerance expand it; the correction is shown, never hidden.
2. Homepage "پیشنهاد برای شما": hover a card — the "why this" line
   explains the score (vendor/category affinity, same-vendor bundle).
3. Open the floating assistant (bottom corner), ask about a product
   and about "my orders" — answers come from real catalog/order data,
   scoped to the logged-in user; ask something it cannot answer to
   show the honest handoff to human support.

## 3. Vendor: publish a product (2 minutes)

1. Log in as vendor (demo button) → `/fa/vendor/dashboard`: revenue,
   orders, top products.
2. `/fa/vendor/products/new`: 4-step form (basics → images → attributes
   → review). Upload an image by drag-and-drop (max 4 × 1 MB), use the
   "draft description" button — the AI draft is editable, never
   auto-published.
3. Publish → the product appears in the storefront immediately.
   Show the fulfilment flow on an order: PAID → PREPARING → SHIPPED →
   DELIVERED.
4. `/fa/vendor/subscription`: box plan, commission rate, payout list.

## 4. Admin: approve, suspend, payout (2 minutes)

1. Log in as admin → `/fa/admin/dashboard`: real stats, low-stock
   alerts.
2. `/fa/admin/vendors`: approve the pending vendor (or reject with a
   reason — the vendor sees it). Every action lands in
   `/fa/admin/audit`.
3. `/fa/admin/users`: suspend a user → their login is blocked
   server-side; re-activate.
4. `/fa/admin/categories`: the 3-level tree — try moving a category
   under its own child (rejected: cycle guard).
5. `/fa/admin/payouts`: approve a requested payout, mark it PAID —
   the amount is gross − snapshotted commission.

## 5. Subscriptions (1 minute)

1. As customer, `/fa/account/subscription`: active weekly box —
   pause it, skip next week, resume, cancel. Each week generates a
   deterministic box + invoice.
2. As vendor, `/fa/vendor/subscription`: basic (12% / 20 products) vs
   pro (8% / 200) — the cap is enforced server-side on product
   creation.

## Talking points (if asked)

- **Pricing is server-side**: the client never decides the total —
  show `server/orders/service.ts` and the idempotency key.
- **Payment is a port**: `lib/payments/port.ts` — Mock ↔ Zarinpal
  sandbox is a one-env-var switch; verify happens server-side only.
- **No external AI**: smart search, recommendations and the assistant
  are deterministic server-side heuristics — no API key, no
  third-party script (Iran constraints), with a documented fallback.
- **Tests**: 222 Vitest unit tests + Playwright E2E on Chromium and
  Firefox, axe a11y suite, CI green on every push.
- **Known limitation, stated upfront**: the Neon database has no
  tables yet (migrations 0001–0005 never ran), so the live site
  falls back to seed data; `prisma migrate deploy` + seed is a
  5-minute fix once `DATABASE_URL` is set.
