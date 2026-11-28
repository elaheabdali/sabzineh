# Architecture

## One app, three roles

A single Next.js App Router app serves customer, vendor and admin.
Separation is by route group, not by deployment:

```
src/app/[locale]/
  (shop)/     customer storefront: home, category/[slug], product/[slug]
  (account)/  customer panel: orders, profile, addresses, subscriptions
  (vendor)/   vendor panel: dashboard, products, orders, payouts
  (admin)/    admin panel: dashboard, users, vendors, categories, reports
```

Every route group is protected twice: `src/proxy.ts` (locale + public
routes) and a server-side guard in `src/lib/auth/guards.ts`
(`requireRole`) that runs before any data is read. A vendor can only
ever see their own rows — the filter is applied server-side from the
session's `vendorId`, never by hiding UI.

## Money rules

- The client never decides a price. `server/orders` recomputes the
  total from the database at order creation; the cart is a wish list
  with prices, not an invoice.
- `PaymentPort` (`src/lib/payments/port.ts`) is the only payment
  boundary: `createPayment`, `verify`, `refund`. The Mock
  implementation is the default; Zarinpal sandbox is a second
  implementation behind `PAYMENT_PROVIDER`. No business code imports
  a gateway directly.
- Commission is snapshotted on `OrderItem.commissionRate` at order
  time, so a later plan change never rewrites history. Payouts are
  `gross − commission` per vendor per period (`server/billing`).

## Catalog (Week 2)

One `CatalogRepository` interface (`features/catalog/repository.ts`),
two adapters, one switch — `getCatalogRepository()` returns the
Prisma adapter when `DATABASE_URL` is set, the seed adapter otherwise:

```
URL searchParams ──► parseFilterParams (Zod, @sabzineh/types)
       │                    │  single source of truth
       ▼                    ▼
getCatalogRepository() ──► SeedCatalogRepository   (no DATABASE_URL)
                       └─► PrismaCatalogRepository (DATABASE_URL set)
                               where/orderBy: features/catalog/prisma.ts
                               facets: groupBy / aggregate / count
```

- Filter state: category (slug → descendant ids), price range,
  vendor, organic / gluten-free / local, min rating, in-stock,
  text search `q` (title + vendor name), sort, page. Every change
  rewrites the URL; pages are server-rendered from it.
- Facet counts are computed on the set matching every filter
  *except* the facet being counted, so counts never collapse
  because of the facet itself.
- Sort: cheapest / priciest / bestselling (rating proxy until
  order-item aggregates exist) / newest. Page size is 12.
- Smart search (`features/catalog/smart-search.ts`) is deterministic
  heuristics — Persian synonym expansion, typo correction (Levenshtein
  ≤ 2) and phrase → structured filters. No AI call, no AI API key:
  there is no external model in this project by design (Iran
  constraints — no third-party scripts, everything runs on our own
  server). The same honesty applies to the other two Week 7 "AI"
  features: recommendations are a documented scoring formula over
  orders/cart/views (`features/ai/recommendations.ts`), and the
  assistant chat + vendor description drafts are fixed keyword rules
  and templates (`features/ai/assistant.ts`, `features/ai/description.ts`).
  The UI says "AI-assisted" only where the plan says so, and the
  assistant says when it cannot answer instead of inventing one.
- Reviews on the product page are deterministic demo data
  (`features/catalog/reviews.ts`) until real reviews exist.

## Data flow

```
browser ──► Next.js (RSC + Route Handlers)
              ├─ lib/payments (PaymentPort)
              ├─ server/billing, server/orders
              ├─ features/catalog (URL-synced filter state)
              └─ Prisma ──► PostgreSQL (Neon)
SSE: /api/events pushes per-user events (order status, box
     generated, vendor approval, payout) to the logged-in user's
     browser only — the route requires a session and subscribes that
     user on the in-process bus (`server/events.ts`). Every event is
     first persisted as a Notification row (`server/store.ts`, Prisma
     when DATABASE_URL is set, in-memory otherwise); the client falls
     back to polling GET /api/notifications with backoff when SSE
     drops. Limitation: on serverless hosting each function instance
     has its own bus, so SSE is a fast path, not the only path —
     nothing is lost when it drops.
```

## State

- Server state: TanStack Query, keyed by the filter URL.
- Cart + UI state: Zustand (`stores/cart.ts`, persisted to
  localStorage with an SSR-safe storage shim).
- Filter state: the URL is the only source of truth
  (`features/catalog/filter.ts` parses/builds `searchParams`),
  so a filtered link is shareable and back-button safe.

## i18n

next-intl, locales `fa` (default) and `en`, full RTL.
Messages live in `src/messages/fa.json` / `en.json`.
Vazirmatn is self-hosted from `@fontsource-variable/vazirmatn` —
no Google Fonts, no CDN, no third-party scripts.

## SEO (Week 8)

- `src/app/sitemap.ts` — 368 URLs (2 locales × home, search, 50
  categories, 120 products, 12 vendor shops), built from the seed
  catalog so it never depends on `DATABASE_URL`. `src/app/robots.ts`
  allows everything public and points at the sitemap.
- Per-locale metadata in `[locale]/layout.tsx` (`metadataBase`,
  canonical + `hreflang` alternates fa/en/x-default, Open Graph,
  favicon) and on category/product pages (`generateMetadata`).
- JSON-LD via a single `JsonLd` component (the only
  `dangerouslySetInnerHTML` in the app, static server data only):
  `Organization` + `WebSite` on home, `Product` + `BreadcrumbList`
  on product pages, `BreadcrumbList` on category pages. Prices use
  `priceCurrency: IRT` (Toman).
- `NEXT_PUBLIC_APP_URL` must be the production URL in Vercel —
  canonicals, Open Graph and the sitemap all derive from it
  (fallback: `https://sabzineh-web.vercel.app`).

## Accessibility (Week 8)

- `tests/e2e/a11y.spec.ts` — axe (`@axe-core/playwright`) over home,
  category, product, cart, checkout, login, vendor and admin
  dashboards, plus a keyboard-only checkout check (Tab reaches the
  address form and its submit button; typing works without a mouse).
- Fixes found by the suite: `text-neutral-500` on the cream page
  background was 4.42:1 (below WCAG 2.2 AA 4.5:1) — all 73 uses
  became `text-neutral-600` (≈7:1); `aria-pressed` on filter links
  is invalid on the `link` role — now `aria-current` on the active
  filter. Result: 0 axe violations on all 8 flows (was 20).

## Performance (Week 8, local prod build, Chromium)

- `.next/static` 1.2 MB total; largest JS chunk 224 KB (framework).
- Median of 3 runs, local server: home TTFB 41 ms / load 208 ms,
  category TTFB 114 ms / load 225 ms, product TTFB 97 ms / load 225 ms;
  document transfer ≈ 18–20 KB compressed. Images are data-URI SVG
  placeholders (no CDN, no external host — verified in built HTML)
  and uploaded images ride as data: URLs under the CSP
  `img-src 'self' data:`.
- No Lighthouse score is claimed: this VM has no Lighthouse-capable
  browser (only the headless shell), so the plan's "Performance > 90,
  LCP < 2.5s" item is UNVERIFIED — run Lighthouse on the deployed
  site to confirm it.

## Monorepo

Turborepo + pnpm workspaces. Shared code lives in `packages/`:
`ui` (components), `types` (DTOs + Zod schemas),
`config` (eslint / tsconfig / prettier / tailwind presets).
Apps import them as `@sabzineh/*` workspace packages.
